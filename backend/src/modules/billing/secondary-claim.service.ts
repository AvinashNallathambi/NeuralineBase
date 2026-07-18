import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncounterClaim, ClaimStatus } from './entities/encounter-claim.entity';
import { PatientInsurance, InsurancePriority } from './entities/patient-insurance.entity';
import { BillingService } from './billing.service';

export interface SecondaryClaimSuggestion {
  shouldGenerateSecondary: boolean;
  reason: string;
  secondaryInsuranceId?: string;
  secondaryPayerName?: string;
  remainingBalance?: number;
  primaryPaidAmount?: number;
  primaryAdjustmentAmount?: number;
  patientResponsibilityAmount?: number;
  claimFrequency: string; // '7' for replacement, '8' for void
  estimatedSecondaryPayment?: number;
  notes: string[];
}

@Injectable()
export class SecondaryClaimService {
  private readonly logger = new Logger(SecondaryClaimService.name);

  constructor(
    private readonly aiService: AiService,
    @InjectRepository(EncounterClaim)
    private readonly claimRepository: Repository<EncounterClaim>,
    @InjectRepository(PatientInsurance)
    private readonly insuranceRepository: Repository<PatientInsurance>,
    private readonly billingService: BillingService,
  ) {}

  /**
   * Analyze a paid/partially-paid primary claim and determine if a secondary
   * claim should be generated. Uses AI to estimate the secondary payment.
   */
  async analyzeForSecondaryClaim(
    tenantId: string,
    primaryClaimId: string,
  ): Promise<SecondaryClaimSuggestion> {
    const primaryClaim = await this.claimRepository.findOne({
      where: { id: primaryClaimId, tenantId },
      relations: ['lineItems'],
    });

    if (!primaryClaim) {
      throw new NotFoundException(`Claim ${primaryClaimId} not found`);
    }

    // Check if primary claim is in a state that allows secondary billing
    const validStatuses = [ClaimStatus.PAID, ClaimStatus.PARTIALLY_PAID];
    if (!validStatuses.includes(primaryClaim.status)) {
      return {
        shouldGenerateSecondary: false,
        reason: `Primary claim status is '${primaryClaim.status}'. Secondary claims can only be generated after primary claim is paid or partially paid.`,
        claimFrequency: '7',
        notes: [`Primary claim must be in 'paid' or 'partially_paid' status before generating secondary claim.`],
      };
    }

    // Find secondary insurance for this patient
    const secondaryInsurance = await this.insuranceRepository.findOne({
      where: {
        patientId: primaryClaim.patientId,
        tenantId,
        priority: InsurancePriority.SECONDARY,
        status: 'active',
      },
      relations: ['payer'],
    });

    if (!secondaryInsurance) {
      return {
        shouldGenerateSecondary: false,
        reason: 'Patient has no active secondary insurance policy.',
        claimFrequency: '7',
        notes: ['No secondary insurance on file. Patient balance may need to be billed to patient.'],
      };
    }

    // Calculate remaining balance
    const totalBilled = Number(primaryClaim.totalBilled);
    const totalPaid = Number(primaryClaim.totalPaid);
    const adjustmentAmount = Number(primaryClaim.adjustmentAmount);
    const patientResponsibility = Number(primaryClaim.patientResponsibility);

    const remainingBalance = totalBilled - totalPaid - adjustmentAmount;

    if (remainingBalance <= 0) {
      return {
        shouldGenerateSecondary: false,
        reason: `No remaining balance after primary payment. Total billed: $${totalBilled}, paid: $${totalPaid}, adjusted: $${adjustmentAmount}.`,
        secondaryInsuranceId: secondaryInsurance.id,
        secondaryPayerName: secondaryInsurance.payer?.name,
        claimFrequency: '7',
        notes: ['Primary claim paid in full with adjustments. No secondary claim needed.'],
      };
    }

    // Use AI to estimate secondary payment
    let estimatedSecondaryPayment: number | undefined;
    let aiNotes: string[] = [];

    try {
      const estimate = await this.aiService.generateStructured<{
        estimatedPayment: number;
        reasoning: string;
        notes: string[];
      }>(
        `You are a medical billing expert specializing in COB (Coordination of Benefits) claims.

Estimate the expected secondary insurance payment for this claim:

Primary Claim:
- Total billed: $${totalBilled}
- Primary paid: $${totalPaid}
- Primary adjustment: $${adjustmentAmount}
- Patient responsibility: $${patientResponsibility}
- Remaining balance: $${remainingBalance}

Secondary Insurance:
- Payer: ${secondaryInsurance.payer?.name}
- Payer type: ${secondaryInsurance.payer?.payerType}
- Copay: ${secondaryInsurance.copayAmount ?? 'N/A'}
- Deductible: ${secondaryInsurance.deductibleAmount ?? 'N/A'}
- Coinsurance: ${secondaryInsurance.coinsurancePercentage ?? 'N/A'}%

COB Rules:
- Secondary insurance typically pays the remaining balance after primary, up to their allowed amount
- If secondary has a deductible, patient must meet it first
- Secondary coinsurance applies to the remaining balance after deductible
- Secondary payment + primary payment should not exceed total billed

Return JSON:
{
  "estimatedPayment": number (estimated secondary payment in dollars),
  "reasoning": "Brief explanation of calculation",
  "notes": ["Any important notes about the secondary claim"]
}`,
        { temperature: 0.1, maxTokens: 1024 },
      );

      estimatedSecondaryPayment = estimate.estimatedPayment;
      aiNotes = estimate.notes || [];
    } catch (err: any) {
      this.logger.warn(`AI secondary estimate failed, using rule-based: ${err.message}`);
      // Fallback: simple calculation
      const coinsurancePct = secondaryInsurance.coinsurancePercentage
        ? Number(secondaryInsurance.coinsurancePercentage) / 100
        : 0.8; // Assume 80/20 as default
      estimatedSecondaryPayment = Math.round(remainingBalance * coinsurancePct * 100) / 100;
      aiNotes = ['Rule-based estimate: assumed 80% coinsurance on remaining balance. Verify with actual plan details.'];
    }

    return {
      shouldGenerateSecondary: true,
      reason: `Primary claim paid $${totalPaid} of $${totalBilled}. Remaining balance $${remainingBalance} can be billed to secondary insurance ${secondaryInsurance.payer?.name}.`,
      secondaryInsuranceId: secondaryInsurance.id,
      secondaryPayerName: secondaryInsurance.payer?.name,
      remainingBalance,
      primaryPaidAmount: totalPaid,
      primaryAdjustmentAmount: adjustmentAmount,
      patientResponsibilityAmount: patientResponsibility,
      claimFrequency: '7', // 7 = replacement claim (secondary)
      estimatedSecondaryPayment,
      notes: [
        `Secondary claim should use claim frequency code '7' (replacement) to indicate COB.`,
        `Attach primary EOB/ERA to secondary claim.`,
        ...aiNotes,
      ],
    };
  }

  /**
   * Generate a secondary claim from a paid primary claim.
   */
  async generateSecondaryClaim(
    tenantId: string,
    primaryClaimId: string,
  ): Promise<EncounterClaim> {
    const analysis = await this.analyzeForSecondaryClaim(tenantId, primaryClaimId);

    if (!analysis.shouldGenerateSecondary) {
      throw new BadRequestException(analysis.reason);
    }

    const primaryClaim = await this.claimRepository.findOne({
      where: { id: primaryClaimId, tenantId },
      relations: ['lineItems'],
    });

    if (!primaryClaim) {
      throw new NotFoundException(`Primary claim not found`);
    }

    const secondaryInsurance = await this.insuranceRepository.findOne({
      where: { id: analysis.secondaryInsuranceId!, tenantId },
      relations: ['payer'],
    });

    if (!secondaryInsurance) {
      throw new NotFoundException('Secondary insurance not found');
    }

    // Create secondary claim with COB indicators
    const claimNumber = `CLM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const secondaryClaim = this.claimRepository.create({
      tenantId,
      claimNumber,
      patientId: primaryClaim.patientId,
      patientName: primaryClaim.patientName,
      encounterId: primaryClaim.encounterId,
      providerId: primaryClaim.providerId,
      providerName: primaryClaim.providerName,
      providerNPI: primaryClaim.providerNPI,
      insurancePayerId: secondaryInsurance.insurancePayerId,
      patientInsuranceId: secondaryInsurance.id,
      insurancePayerName: secondaryInsurance.payer?.name || null,
      policyNumber: secondaryInsurance.policyNumber,
      groupNumber: secondaryInsurance.groupNumber,
      claimFrequency: '7', // Replacement/secondary claim
      serviceDate: primaryClaim.serviceDate,
      status: ClaimStatus.READY_TO_BILL,
      totalBilled: analysis.remainingBalance!,
      totalPaid: 0,
      patientResponsibility: 0,
      deductibleApplied: 0,
      copayApplied: 0,
      coinsuranceApplied: 0,
      adjustmentAmount: 0,
      notes: `Secondary claim generated from primary claim ${primaryClaim.claimNumber}.\nPrimary paid: $${analysis.primaryPaidAmount}\nRemaining balance: $${analysis.remainingBalance}\n${analysis.notes.join('\n')}`,
      metadata: {
        primaryClaimId: primaryClaim.id,
        primaryClaimNumber: primaryClaim.claimNumber,
        cobClaim: true,
        claimFrequency: '7',
        primaryPaidAmount: analysis.primaryPaidAmount,
        primaryAdjustmentAmount: analysis.primaryAdjustmentAmount,
        estimatedSecondaryPayment: analysis.estimatedSecondaryPayment,
      },
    });

    // Copy line items from primary claim (with updated amounts)
    const primaryLineItems = primaryClaim.lineItems as any[];
    if (primaryLineItems && primaryLineItems.length > 0) {
      secondaryClaim.lineItems = primaryLineItems.map((item) => ({
        ...item,
        id: undefined, // Let TypeORM generate new IDs
        unitPrice: Number(item.unitPrice) - Number(item.paidAmount || 0),
        totalCharge: Number(item.totalCharge || item.unitPrice) - Number(item.paidAmount || 0),
      }));
    }

    return this.claimRepository.save(secondaryClaim);
  }
}
