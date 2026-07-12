import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

export interface PreSubmissionClaim {
  payerName: string;
  payerId?: string;
  patientId?: string;
  patientName?: string;
  cptCodes: string[];
  diagnosisCodes: string[];
  modifiers?: string[];
  placeOfService?: string;
  serviceDate?: string;
  billedAmount: number;
  providerNPI?: string;
  providerName?: string;
  priorAuthorizationNumber?: string;
  eligibilityVerified?: boolean;
  hasMedicalNecessity?: boolean;
  hasReferral?: boolean;
}

export interface DenialRiskAssessment {
  riskScore: number; // 0-100 (higher = more likely to be denied)
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedDenialReasons: {
    reason: string;
    probability: number;
    carcCode?: string;
    preventable: boolean;
    preventionAction?: string;
  }[];
  recommendations: string[];
  estimatedDenialCost: number;
  confidenceLevel: 'low' | 'medium' | 'high';
}

/**
 * Predictive denial prevention service.
 * Scores claims BEFORE submission to identify denial risk and
 * recommend corrective actions.
 */
@Injectable()
export class DenialPreventionService {
  private readonly logger = new Logger(DenialPreventionService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Assess the denial risk of a claim before submission.
   */
  async assessClaimRisk(claim: PreSubmissionClaim): Promise<DenialRiskAssessment> {
    this.logger.log(`Assessing denial risk for claim: ${claim.cptCodes.join(', ')} to ${claim.payerName}`);

    const prompt = `You are a predictive denial prevention AI for healthcare revenue cycle management.

Analyze this claim BEFORE submission and predict the likelihood of denial.

Claim Details:
- Payer: ${claim.payerName}
- CPT Codes: ${claim.cptCodes.join(', ')}
- Diagnosis Codes (ICD-10): ${claim.diagnosisCodes.join(', ')}
- Modifiers: ${(claim.modifiers || []).join(', ') || 'None'}
- Place of Service: ${claim.placeOfService || 'N/A'}
- Service Date: ${claim.serviceDate || 'N/A'}
- Billed Amount: $${claim.billedAmount.toFixed(2)}
- Provider: ${claim.providerName || 'N/A'} (NPI: ${claim.providerNPI || 'N/A'})
- Prior Authorization #: ${claim.priorAuthorizationNumber || 'None'}
- Eligibility Verified: ${claim.eligibilityVerified ? 'Yes' : 'No'}
- Medical Necessity Documented: ${claim.hasMedicalNecessity ? 'Yes' : 'No'}
- Referral on File: ${claim.hasReferral ? 'Yes' : 'No'}

Identify:
1. Overall denial risk score (0-100, higher = more likely to be denied)
2. Specific predicted denial reasons with:
   - The reason description
   - Probability (0-100)
   - The likely CARC code
   - Whether it's preventable
   - The specific prevention action
3. Actionable recommendations to prevent denial
4. Estimated financial cost if denied
5. Confidence level of the prediction

Common denial patterns to check:
- Missing prior authorization (CARC 197)
- Medical necessity not documented (CARC 50, 151)
- Eligibility issues (CARC 48, 49)
- Coding errors (CARC 11-15)
- Missing information (CARC 16, 26, 27)
- Duplicate claims (CARC 18)
- Timely filing (CARC 29)
- Bundling issues (CARC 97)
- Frequency limits (CARC 243)

Respond with JSON:
{
  "riskScore": <0-100>,
  "riskLevel": "<low | medium | high | critical>",
  "predictedDenialReasons": [
    {
      "reason": "<description>",
      "probability": <0-100>,
      "carcCode": "<code>",
      "preventable": <true/false>,
      "preventionAction": "<action>"
    }
  ],
  "recommendations": ["<rec1>", "<rec2>", ...],
  "estimatedDenialCost": <dollar amount>,
  "confidenceLevel": "<low | medium | high>"
}`;

    try {
      const result = await this.aiService.generateStructured<DenialRiskAssessment>(prompt, {
        temperature: 0.2,
        maxTokens: 2048,
      });

      return {
        riskScore: Math.min(100, Math.max(0, result.riskScore || 50)),
        riskLevel: result.riskLevel || 'medium',
        predictedDenialReasons: result.predictedDenialReasons || [],
        recommendations: result.recommendations || [],
        estimatedDenialCost: result.estimatedDenialCost || 0,
        confidenceLevel: result.confidenceLevel || 'medium',
      };
    } catch (err: any) {
      this.logger.error(`Denial risk assessment failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Quick heuristic-based risk check (no AI) for real-time pre-submission validation.
   */
  quickRiskCheck(claim: PreSubmissionClaim): {
    riskScore: number;
    flags: string[];
  } {
    let riskScore = 0;
    const flags: string[] = [];

    // No eligibility verification
    if (!claim.eligibilityVerified) {
      riskScore += 20;
      flags.push('Eligibility not verified — high risk of coverage denial');
    }

    // No prior auth for codes that typically require it
    const authRequiredCodes = ['27447', '29881', '29827', '70553', '72148', '78452', '93458', '92928'];
    const needsAuth = claim.cptCodes.some((c) => authRequiredCodes.includes(c));
    if (needsAuth && !claim.priorAuthorizationNumber) {
      riskScore += 30;
      flags.push('Prior authorization likely required but not provided (CARC 197)');
    }

    // No medical necessity documentation
    if (!claim.hasMedicalNecessity) {
      riskScore += 15;
      flags.push('Medical necessity not documented — risk of CARC 50/151 denial');
    }

    // No referral
    if (!claim.hasReferral && claim.placeOfService === '11') {
      riskScore += 10;
      flags.push('No referral on file for office visit — some HMO plans require this');
    }

    // Missing modifiers
    if (claim.cptCodes.length > 1 && (!claim.modifiers || claim.modifiers.length === 0)) {
      riskScore += 10;
      flags.push('Multiple CPT codes with no modifiers — check for bundling/NCCI issues');
    }

    // High billed amount
    if (claim.billedAmount > 10000) {
      riskScore += 5;
      flags.push('High-value claim — payers scrutinize more closely');
    }

    return {
      riskScore: Math.min(100, riskScore),
      flags,
    };
  }
}
