import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientInsurance, InsurancePriority } from './entities/patient-insurance.entity';

export interface CobSuggestion {
  insuranceId: string;
  priority: string;
  payerName: string;
  reason: string;
}

export interface CobOrderResult {
  suggestedOrder: CobSuggestion[];
  confidence: number;
  rules: string[];
}

@Injectable()
export class CobService {
  private readonly logger = new Logger(CobService.name);

  constructor(
    private readonly aiService: AiService,
    @InjectRepository(PatientInsurance)
    private readonly insuranceRepository: Repository<PatientInsurance>,
  ) {}

  /**
   * AI-powered COB order detection.
   * Applies CMS MSP (Medicare Secondary Payer) rules and standard COB
   * guidelines to suggest the correct primary/secondary/tertiary order.
   */
  async suggestCobOrder(
    tenantId: string,
    patientId: string,
    patientContext: { age?: number; employmentStatus?: string; hasEsrD?: boolean; esrdCoordinationStartDate?: string },
  ): Promise<CobOrderResult> {
    const insurances = await this.insuranceRepository.find({
      where: { patientId, tenantId, status: 'active' },
      relations: ['payer'],
      order: { priority: 'ASC' },
    });

    if (insurances.length === 0) {
      throw new NotFoundException('Patient has no active insurance policies');
    }

    if (insurances.length === 1) {
      return {
        suggestedOrder: [
          {
            insuranceId: insurances[0].id,
            priority: 'primary',
            payerName: insurances[0].payer?.name || 'Unknown',
            reason: 'Only one active policy — automatically primary.',
          },
        ],
        confidence: 100,
        rules: ['Single policy — no COB determination needed.'],
      };
    }

    // Build context for AI
    const policies = insurances.map((ins) => ({
      id: ins.id,
      currentPriority: ins.priority,
      payerName: ins.payer?.name || 'Unknown',
      payerType: ins.payer?.payerType || 'commercial',
      policyNumber: ins.policyNumber,
      subscriberRelation: ins.subscriberRelation,
      effectiveDate: ins.effectiveDate,
      expirationDate: ins.expirationDate,
    }));

    const prompt = `You are an expert in CMS Coordination of Benefits (COB) and Medicare Secondary Payer (MSP) rules.

Determine the correct primary/secondary/tertiary billing order for this patient's insurance policies.

Patient Context:
- Age: ${patientContext.age || 'unknown'}
- Employment status: ${patientContext.employmentStatus || 'unknown'}
- Has ESRD (End-Stage Renal Disease): ${patientContext.hasEsrD || false}
- ESRD coordination start date: ${patientContext.esrdCoordinationStartDate || 'N/A'}

Active Insurance Policies:
${JSON.stringify(policies, null, 2)}

Apply these CMS COB rules:
1. Medicare + Group Health Plan (GHP) with 20+ employees, age 65+: GHP is primary, Medicare is secondary
2. Medicare + GHP with <20 employees, age 65+: Medicare is primary, GHP is secondary
3. ESRD: GHP is primary for first 30 months of coordination period, then Medicare becomes primary
4. Medicaid is always the payer of last resort (always last priority)
5. Auto insurance is primary for auto accident claims
6. Workers' comp is primary for work-related injuries
7. Commercial plans: the plan covering the patient as a subscriber (not dependent) is primary
8. If two commercial plans cover the patient as subscriber, the longer-established plan is primary
9. TRICARE is secondary to most other coverage except Medicaid
10. VA coverage is primary for VA care, secondary for non-VA care

Return JSON:
{
  "suggestedOrder": [
    {
      "insuranceId": "uuid",
      "priority": "primary|secondary|tertiary",
      "payerName": "name",
      "reason": "Brief explanation of why this policy is in this position"
    }
  ],
  "confidence": 0-100,
  "rules": ["List of specific CMS rules that were applied to determine this order"]
}`;

    try {
      const result = await this.aiService.generateStructured<CobOrderResult>(
        prompt,
        { temperature: 0.1, maxTokens: 2048 },
      );
      return result;
    } catch (err: any) {
      this.logger.error(`COB AI suggestion failed: ${err.message}`);

      // Fallback: rule-based COB using payer types
      return this.ruleBasedCob(insurances, patientContext);
    }
  }

  /**
   * Rule-based COB fallback when AI is unavailable.
   */
  private ruleBasedCob(
    insurances: PatientInsurance[],
    patientContext: { age?: number; hasEsrD?: boolean },
  ): CobOrderResult {
    const rules: string[] = [];
    const sorted = [...insurances];

    // Sort by payer type priority
    const payerTypePriority: Record<string, number> = {
      auto: 0,
      workers_comp: 0,
      commercial: 1,
      medicare: 2,
      tricare: 3,
      medicaid: 4,
    };

    sorted.sort((a, b) => {
      const aPriority = payerTypePriority[a.payer?.payerType || 'commercial'] ?? 1;
      const bPriority = payerTypePriority[b.payer?.payerType || 'commercial'] ?? 1;
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Same type: subscriber (self) is primary over dependent
      if (a.subscriberRelation === 'self' && b.subscriberRelation !== 'self') return -1;
      if (a.subscriberRelation !== 'self' && b.subscriberRelation === 'self') return 1;

      // Same relationship: earlier effective date is primary
      const aDate = a.effectiveDate ? new Date(a.effectiveDate).getTime() : Infinity;
      const bDate = b.effectiveDate ? new Date(b.effectiveDate).getTime() : Infinity;
      return aDate - bDate;
    });

    rules.push('Rule-based fallback: sorted by payer type (auto/workers_comp → commercial → Medicare → TRICARE → Medicaid)');
    rules.push('Within same type: subscriber (self) is primary over dependent coverage');
    rules.push('Within same relationship: earlier effective date is primary');

    if (patientContext.hasEsrD) {
      rules.push('ESRD detected: GHP should be primary for 30-month coordination period, then Medicare primary');
    }

    const priorities = ['primary', 'secondary', 'tertiary'];
    const suggestedOrder: CobSuggestion[] = sorted.map((ins, idx) => ({
      insuranceId: ins.id,
      priority: priorities[idx] || 'tertiary',
      payerName: ins.payer?.name || 'Unknown',
      reason: `Rule-based: ${ins.payer?.payerType || 'commercial'} payer, ${ins.subscriberRelation} relationship`,
    }));

    return {
      suggestedOrder,
      confidence: 70,
      rules,
    };
  }

  /**
   * Apply a COB order suggestion — updates the priority of each policy.
   */
  async applyCobOrder(
    tenantId: string,
    patientId: string,
    order: Array<{ insuranceId: string; priority: string }>,
  ): Promise<void> {
    for (const item of order) {
      const insurance = await this.insuranceRepository.findOne({
        where: { id: item.insuranceId, tenantId },
      });
      if (insurance) {
        insurance.priority = item.priority as InsurancePriority;
        await this.insuranceRepository.save(insurance);
      }
    }
  }
}
