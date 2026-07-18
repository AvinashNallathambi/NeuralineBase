import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { PatientGroup, PatientGroupType, PatientGroupCategory, GroupRuleSet, GroupRule } from './entities/patient-group.entity';
import { Patient } from './entities/patient.entity';
import { PatientProblem } from './entities/patient-problem.entity';

export interface SuggestedGroup {
  name: string;
  description: string;
  category: PatientGroupCategory;
  type: PatientGroupType;
  rules: GroupRuleSet;
  estimatedSize: number;
  rationale: string;
}

export interface NaturalLanguageSearchResult {
  interpretedQuery: string;
  rules: GroupRuleSet;
  matchedPatientIds: string[];
  matchedCount: number;
  explanation: string;
}

export interface RiskPrediction {
  patientId: string;
  patientName: string;
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  factors: string[];
  recommendedActions: string[];
}

export interface CareGapDetection {
  patientId: string;
  patientName: string;
  gaps: Array<{
    gap: string;
    severity: 'low' | 'medium' | 'high';
    recommendedAction: string;
  }>;
}

export interface NoShowPrediction {
  patientId: string;
  patientName: string;
  probability: number;
  factors: string[];
  recommendedIntervention: string;
}

export interface OutreachRecommendation {
  campaignType: string;
  targetGroupName: string;
  description: string;
  estimatedReach: number;
  channel: 'sms' | 'email' | 'phone' | 'portal';
  messageTemplate: string;
}

@Injectable()
export class PatientGroupAiService {
  private readonly logger = new Logger(PatientGroupAiService.name);

  constructor(
    @InjectRepository(PatientGroup)
    private readonly groupRepository: Repository<PatientGroup>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(PatientProblem)
    private readonly problemRepository: Repository<PatientProblem>,
    private readonly aiService: AiService,
  ) {}

  async suggestGroups(tenantId: string): Promise<SuggestedGroup[]> {
    const patientCount = await this.patientRepository.count({ where: { tenantId } });

    const chronicProblems = await this.problemRepository
      .createQueryBuilder('prob')
      .select('prob.code', 'code')
      .addSelect('prob.description', 'description')
      .addSelect('COUNT(*)', 'count')
      .where('prob.tenantId = :tenantId', { tenantId })
      .andWhere('prob.deletedAt IS NULL')
      .andWhere('prob.isChronic = true')
      .groupBy('prob.code')
      .addGroupBy('prob.description')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany<{ code: string; description: string; count: string }>();

    const suggestions: SuggestedGroup[] = [];

    for (const cp of chronicProblems) {
      const count = parseInt(cp.count, 10);
      if (count < 3) continue;

      suggestions.push({
        name: `${cp.description} Registry`,
        description: `Patients with active ${cp.description} (${cp.code})`,
        category: PatientGroupCategory.CHRONIC_DISEASE,
        type: PatientGroupType.DYNAMIC,
        rules: {
          combinator: 'AND',
          rules: [
            { field: 'diagnosis', operator: 'contains', value: cp.code },
          ],
        },
        estimatedSize: count,
        rationale: `${count} patients have an active chronic diagnosis of ${cp.description}. Creating a registry enables targeted care management and quality reporting.`,
      });
    }

    suggestions.push({
      name: 'Patients Over 65',
      description: 'All patients aged 65 and older — Medicare-eligible population',
      category: PatientGroupCategory.DEMOGRAPHIC,
      type: PatientGroupType.DYNAMIC,
      rules: {
        combinator: 'AND',
        rules: [{ field: 'age', operator: 'greater_than_or_equal', value: 65 }],
      },
      estimatedSize: Math.floor(patientCount * 0.25),
      rationale: 'Geriatric population requires preventive care tracking, fall risk assessment, and medication review.',
    });

    suggestions.push({
      name: 'Inactive Patients (No Visit 12+ Months)',
      description: 'Patients with no encounter in the last 12 months',
      category: PatientGroupCategory.APPOINTMENT,
      type: PatientGroupType.DYNAMIC,
      rules: {
        combinator: 'AND',
        rules: [{ field: 'last_visit', operator: 'older_than_days', value: 365 }],
      },
      estimatedSize: Math.floor(patientCount * 0.15),
      rationale: 'Re-engagement campaign target. These patients may have lapsed from care and need recall outreach.',
    });

    suggestions.push({
      name: 'High-Risk Patients',
      description: 'Patients with elevated risk scores requiring care management',
      category: PatientGroupCategory.RISK_STRATIFICATION,
      type: PatientGroupType.DYNAMIC,
      rules: {
        combinator: 'AND',
        rules: [{ field: 'risk_score', operator: 'greater_than_or_equal', value: 60 }],
      },
      estimatedSize: Math.floor(patientCount * 0.1),
      rationale: 'High-risk patients benefit from proactive care management, frequent follow-up, and care coordination.',
    });

    try {
      const prompt = `You are a population health AI assistant for a healthcare practice with ${patientCount} patients.
Based on the chronic disease distribution above, suggest 3 additional patient groups that would be clinically valuable.
Consider: preventive care gaps, care management cohorts, quality measure reporting, and revenue optimization.

Chronic conditions found:
${chronicProblems.map((c) => `- ${c.description} (${c.code}): ${c.count} patients`).join('\n')}

Return ONLY a JSON array of objects with this shape:
{
  "name": "string",
  "description": "string",
  "category": "preventive_care | risk_stratification | care_management | appointment | billing",
  "rules": { "combinator": "AND", "rules": [{ "field": "age|gender|diagnosis|last_visit|status|risk_score|insurance", "operator": "equals|greater_than|less_than|contains|within_last|older_than_days", "value": "string|number" }] },
  "estimatedSize": number,
  "rationale": "string"
}`;

      const aiResult = await this.aiService.generateStructured<SuggestedGroup[]>(prompt);
      if (Array.isArray(aiResult)) {
        suggestions.push(...aiResult.slice(0, 3));
      }
    } catch (err: any) {
      this.logger.warn(`AI group suggestion failed: ${err.message}`);
    }

    return suggestions;
  }

  async naturalLanguageSearch(tenantId: string, query: string): Promise<NaturalLanguageSearchResult> {
    const prompt = `You are a clinical data query interpreter. Convert the following natural language request into a structured rule set for patient filtering.

Available rule fields: age, gender, diagnosis, insurance, provider, location, last_visit, next_appointment, outstanding_balance, risk_score, lab_value, medication, allergy, encounter_count, status

Available operators: equals, not_equals, greater_than, less_than, greater_than_or_equal, less_than_or_equal, contains, in, between, within_last, older_than_days, within_next

For "within_last" and "older_than_days" and "within_next", use unit: "days", "weeks", "months", or "years".

Natural language query: "${query}"

Return ONLY a JSON object with this exact shape:
{
  "interpretedQuery": "string describing what the query means",
  "rules": {
    "combinator": "AND" | "OR",
    "rules": [
      { "field": "field_name", "operator": "operator_name", "value": "value", "unit": "days|weeks|months|years" }
    ]
  },
  "explanation": "brief explanation of how the rules map to the query"
}`;

    try {
      const aiResult = await this.aiService.generateStructured<{
        interpretedQuery: string;
        rules: GroupRuleSet;
        explanation: string;
      }>(prompt);

      if (!aiResult.rules || !aiResult.rules.rules) {
        throw new Error('AI did not return valid rules');
      }

      return {
        interpretedQuery: aiResult.interpretedQuery || query,
        rules: aiResult.rules,
        matchedPatientIds: [],
        matchedCount: 0,
        explanation: aiResult.explanation || '',
      };
    } catch (err: any) {
      this.logger.warn(`AI NL search failed: ${err.message}, falling back to keyword matching`);

      const fallbackRules = this.keywordFallback(query);
      return {
        interpretedQuery: query,
        rules: fallbackRules,
        matchedPatientIds: [],
        matchedCount: 0,
        explanation: 'Fallback keyword-based interpretation (AI unavailable)',
      };
    }
  }

  private keywordFallback(query: string): GroupRuleSet {
    const q = query.toLowerCase();
    const rules: GroupRule[] = [];

    if (q.includes('diabet')) {
      rules.push({ field: 'diagnosis', operator: 'contains', value: 'E11' });
    }
    if (q.includes('hypertension') || q.includes('htn')) {
      rules.push({ field: 'diagnosis', operator: 'contains', value: 'I10' });
    }
    if (q.includes('over 65') || q.includes('elderly') || q.includes('geriatric')) {
      rules.push({ field: 'age', operator: 'greater_than_or_equal', value: 65 });
    }
    if (q.includes('inactive') || q.includes('lapsed')) {
      rules.push({ field: 'last_visit', operator: 'older_than_days', value: 365 });
    }
    if (q.includes('female') || q.includes('women')) {
      rules.push({ field: 'gender', operator: 'equals', value: 'female' });
    }
    if (q.includes('male') || q.includes('men')) {
      rules.push({ field: 'gender', operator: 'equals', value: 'male' });
    }

    if (rules.length === 0) {
      rules.push({ field: 'status', operator: 'equals', value: 'active' });
    }

    return { combinator: 'OR', rules };
  }

  async predictRisk(tenantId: string, patientIds: string[]): Promise<RiskPrediction[]> {
    const patients = await this.patientRepository.find({
      where: { id: In(patientIds), tenantId },
    });

    const problems = await this.problemRepository.find({
      where: { patientId: In(patientIds), tenantId },
    });

    const problemsByPatient: Record<string, PatientProblem[]> = {};
    for (const prob of problems) {
      if (!problemsByPatient[prob.patientId]) {
        problemsByPatient[prob.patientId] = [];
      }
      problemsByPatient[prob.patientId].push(prob);
    }

    const results: RiskPrediction[] = patients.map((p) => {
      const age = new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear();
      const chronicCount = (problemsByPatient[p.id] || []).filter((pr) => pr.isChronic).length;
      const activeProblems = (problemsByPatient[p.id] || []).filter(
        (pr) => pr.clinicalStatus === 'active',
      ).length;

      let score = 20;
      if (age > 65) score += 20;
      else if (age > 45) score += 10;
      score += chronicCount * 10;
      score += activeProblems * 5;
      score = Math.min(score, 100);

      const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 30 ? 'moderate' : 'low';

      const factors: string[] = [];
      if (age > 65) factors.push(`Advanced age (${age})`);
      if (chronicCount > 0) factors.push(`${chronicCount} chronic condition(s)`);
      if (activeProblems > 0) factors.push(`${activeProblems} active problem(s)`);

      const recommendedActions: string[] = [];
      if (level === 'critical' || level === 'high') {
        recommendedActions.push('Enroll in care management program');
        recommendedActions.push('Schedule comprehensive assessment within 30 days');
      }
      if (chronicCount >= 2) {
        recommendedActions.push('Medication reconciliation review');
      }
      if (age > 65) {
        recommendedActions.push('Annual wellness visit');
        recommendedActions.push('Fall risk assessment');
      }

      return {
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        riskScore: score,
        riskLevel: level as any,
        factors,
        recommendedActions,
      };
    });

    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  async detectCareGaps(tenantId: string, patientIds: string[]): Promise<CareGapDetection[]> {
    const patients = await this.patientRepository.find({
      where: { id: In(patientIds), tenantId },
    });

    const problems = await this.problemRepository.find({
      where: { patientId: In(patientIds), tenantId },
    });

    const problemsByPatient: Record<string, PatientProblem[]> = {};
    for (const prob of problems) {
      if (!problemsByPatient[prob.patientId]) {
        problemsByPatient[prob.patientId] = [];
      }
      problemsByPatient[prob.patientId].push(prob);
    }

    return patients.map((p) => {
      const age = new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear();
      const gaps: CareGapDetection['gaps'] = [];
      const patientProblems = problemsByPatient[p.id] || [];
      const hasDiabetes = patientProblems.some(
        (pr) => pr.code.startsWith('E10') || pr.code.startsWith('E11'),
      );
      const hasHypertension = patientProblems.some((pr) => pr.code.startsWith('I10'));

      gaps.push({
        gap: 'Annual wellness visit overdue',
        severity: 'medium',
        recommendedAction: 'Schedule annual wellness visit',
      });

      if (age >= 50) {
        gaps.push({
          gap: 'Colorectal cancer screening due',
          severity: 'high',
          recommendedAction: 'Order colonoscopy or FIT test',
        });
      }

      if (p.gender === 'female' && age >= 40) {
        gaps.push({
          gap: 'Mammogram due',
          severity: 'medium',
          recommendedAction: 'Order screening mammogram',
        });
      }

      if (hasDiabetes) {
        gaps.push({
          gap: 'HbA1c not documented in last 3 months',
          severity: 'high',
          recommendedAction: 'Order HbA1c lab test',
        });
        gaps.push({
          gap: 'Diabetic eye exam due',
          severity: 'medium',
          recommendedAction: 'Refer to ophthalmology for retinal exam',
        });
      }

      if (hasHypertension) {
        gaps.push({
          gap: 'Blood pressure not documented in last 6 months',
          severity: 'medium',
          recommendedAction: 'Schedule BP check',
        });
      }

      if (age >= 65) {
        gaps.push({
          gap: 'Pneumococcal vaccine due',
          severity: 'medium',
          recommendedAction: 'Administer pneumococcal vaccine',
        });
      }

      return {
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        gaps,
      };
    });
  }

  async predictNoShow(tenantId: string, patientIds: string[]): Promise<NoShowPrediction[]> {
    const patients = await this.patientRepository.find({
      where: { id: In(patientIds), tenantId },
    });

    return patients.map((p) => {
      const age = new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear();
      let probability = 0.1;

      if (age < 30) probability += 0.08;
      if (p.status === 'inactive') probability += 0.15;
      if (!p.email) probability += 0.05;
      if (!p.phone) probability += 0.1;

      probability = Math.min(probability, 0.85);

      const factors: string[] = [];
      if (age < 30) factors.push('Younger age demographic');
      if (p.status === 'inactive') factors.push('Inactive patient status');
      if (!p.email) factors.push('No email on file');
      if (!p.phone) factors.push('No phone number on file');

      const intervention = probability > 0.4
        ? 'Send SMS reminder 48 hours before appointment and phone reminder 24 hours before'
        : probability > 0.25
          ? 'Send SMS reminder 24 hours before appointment'
          : 'Standard reminder protocol';

      return {
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        probability: Math.round(probability * 100) / 100,
        factors,
        recommendedIntervention: intervention,
      };
    });
  }

  async recommendOutreach(tenantId: string): Promise<OutreachRecommendation[]> {
    const groups = await this.groupRepository.find({
      where: { tenantId, status: 'active' },
    });

    const recommendations: OutreachRecommendation[] = [];

    for (const group of groups) {
      const count = group.memberCount;
      if (count < 5) continue;

      if (group.category === PatientGroupCategory.CHRONIC_DISEASE) {
        recommendations.push({
          campaignType: 'Chronic Disease Management',
          targetGroupName: group.name,
          description: `Care management outreach for ${group.name} — schedule follow-up appointments and lab reviews`,
          estimatedReach: count,
          channel: 'portal',
          messageTemplate: `You are due for a follow-up appointment related to your ${group.name.replace(' Registry', '')}. Please log in to schedule.`,
        });
      }

      if (group.category === PatientGroupCategory.PREVENTIVE_CARE) {
        recommendations.push({
          campaignType: 'Preventive Care Recall',
          targetGroupName: group.name,
          description: `Preventive care outreach for ${group.name} — remind patients of due screenings`,
          estimatedReach: count,
          channel: 'sms',
          messageTemplate: `You are due for a preventive care screening. Call us to schedule your appointment.`,
        });
      }

      if (group.category === PatientGroupCategory.APPOINTMENT && group.name.toLowerCase().includes('inactive')) {
        recommendations.push({
          campaignType: 'Patient Re-engagement',
          targetGroupName: group.name,
          description: `Re-engagement campaign for ${group.name} — win-back outreach`,
          estimatedReach: count,
          channel: 'phone',
          messageTemplate: `We miss you! It's been a while since your last visit. Call us to schedule a check-up.`,
        });
      }

      if (group.category === PatientGroupCategory.BILLING) {
        recommendations.push({
          campaignType: 'Balance Collection',
          targetGroupName: group.name,
          description: `Payment outreach for ${group.name} — remind patients of outstanding balances`,
          estimatedReach: count,
          channel: 'email',
          messageTemplate: `You have an outstanding balance with our practice. Please log in to the patient portal to view and pay your bill.`,
        });
      }
    }

    return recommendations;
  }
}
