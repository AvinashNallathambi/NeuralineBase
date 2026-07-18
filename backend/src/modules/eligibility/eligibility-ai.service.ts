import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

@Injectable()
export class EligibilityAiService {
  private readonly logger = new Logger(EligibilityAiService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Parse a raw X12 271 response payload and extract structured benefits data.
   */
  async parse271Response(responsePayload: Record<string, unknown>): Promise<object> {
    const systemPrompt = `You are a medical billing specialist with deep expertise in X12 EDI 271 eligibility response transactions.
Your task is to parse raw 271 response data and extract structured benefits information.
Always respond with valid JSON only. Do not include markdown, explanations, or any text outside the JSON object.`;

    const userPrompt = `Parse the following raw 271 eligibility response payload and extract structured benefits data.

Raw 271 Response Payload:
${JSON.stringify(responsePayload, null, 2)}

Return a JSON object with the following structure:
{
  "benefits": [
    {
      "benefitCode": "string (e.g. 30=Health Benefit Plan Coverage, 1=Medical Care)",
      "benefitDescription": "string",
      "coverageLevel": "string (e.g. IND=Individual, FAM=Family)",
      "inNetwork": "boolean or null",
      "serviceType": "string",
      "amount": "number or null",
      "percentage": "number or null",
      "timePeriod": "string or null"
    }
  ],
  "deductibles": {
    "individual": "number or null",
    "family": "number or null",
    "individualRemaining": "number or null",
    "familyRemaining": "number or null"
  },
  "outOfPocket": {
    "individual": "number or null",
    "family": "number or null",
    "individualRemaining": "number or null",
    "familyRemaining": "number or null"
  },
  "copays": [
    {
      "serviceType": "string",
      "amount": "number",
      "inNetwork": "boolean or null"
    }
  ],
  "coinsurance": "number or null (percentage, e.g. 20 for 20%)",
  "flags": {
    "authorizationRequired": "boolean",
    "referralRequired": "boolean",
    "coverageActive": "boolean",
    "coordinationOfBenefits": "boolean"
  },
  "planInfo": {
    "planName": "string or null",
    "planType": "string or null",
    "network": "string or null",
    "effectiveDate": "string (YYYY-MM-DD) or null",
    "terminationDate": "string (YYYY-MM-DD) or null"
  },
  "parsedAt": "${new Date().toISOString()}"
}`;

    try {
      const result = await this.aiService.generateStructured<object>(
        `${systemPrompt}\n\n${userPrompt}`,
        { temperature: 0.1, maxTokens: 2048 },
      );
      return result;
    } catch (err: any) {
      this.logger.error(`parse271Response failed: ${err.message}`);
      return {
        error: 'Failed to parse 271 response',
        message: err.message,
        benefits: [],
        deductibles: { individual: null, family: null, individualRemaining: null, familyRemaining: null },
        outOfPocket: { individual: null, family: null, individualRemaining: null, familyRemaining: null },
        copays: [],
        coinsurance: null,
        flags: { authorizationRequired: false, referralRequired: false, coverageActive: false, coordinationOfBenefits: false },
        planInfo: { planName: null, planType: null, network: null, effectiveDate: null, terminationDate: null },
      };
    }
  }

  /**
   * Generate a plain-English eligibility summary suitable for front-desk staff.
   */
  async generateEligibilitySummary(verification: any): Promise<string> {
    const systemPrompt = `You are a knowledgeable medical office assistant. Your role is to translate complex insurance eligibility data into clear, concise, plain-English summaries for front-desk staff who need to quickly understand a patient's coverage before their appointment.
Be factual, friendly in tone, and highlight the most important information: whether coverage is active, what the patient owes, and any requirements like prior auth or referrals.`;

    const userPrompt = `Generate a plain-English eligibility summary for the following insurance verification record. The summary will be read by front-desk staff.

Verification Data:
- Status: ${verification.status ?? 'Unknown'}
- Coverage Status: ${verification.coverageStatus ?? 'Unknown'}
- Payer: ${verification.payerName ?? 'Unknown'}
- Policy Number: ${verification.policyNumber ?? 'N/A'}
- Plan Name: ${verification.planName ?? 'N/A'}
- Plan Type: ${verification.planType ?? 'N/A'}
- Network: ${verification.network ?? 'N/A'}
- Patient Name: ${verification.patientName ?? 'N/A'}
- Subscriber Name: ${verification.subscriberName ?? 'N/A'}
- Subscriber Relation: ${verification.subscriberRelation ?? 'Self'}
- Effective Date: ${verification.effectiveDate ?? 'N/A'}
- Expiration Date: ${verification.expirationDate ?? 'N/A'}
- Individual Deductible: ${verification.deductibleIndividual != null ? '$' + verification.deductibleIndividual : 'N/A'}
- Deductible Remaining: ${verification.deductibleRemaining != null ? '$' + verification.deductibleRemaining : 'N/A'}
- Out-of-Pocket Max: ${verification.outOfPocketIndividual != null ? '$' + verification.outOfPocketIndividual : 'N/A'}
- Out-of-Pocket Remaining: ${verification.outOfPocketRemaining != null ? '$' + verification.outOfPocketRemaining : 'N/A'}
- Copay: ${verification.copayAmount != null ? '$' + verification.copayAmount : 'N/A'}
- Coinsurance: ${verification.coinsurancePercentage != null ? verification.coinsurancePercentage + '%' : 'N/A'}
- Authorization Required: ${verification.authorizationRequired ? 'YES' : 'No'}
- Referral Required: ${verification.referralRequired ? 'YES' : 'No'}
- Benefits: ${JSON.stringify(verification.benefits ?? [])}
- Benefit Limitations: ${JSON.stringify(verification.benefitLimitations ?? {})}
- Verified At: ${verification.verifiedAt ?? 'N/A'}

Write a 3–5 sentence summary that a front-desk staff member can read in under 30 seconds. Focus on: (1) Is coverage active? (2) What does the patient owe today? (3) Any special requirements?`;

    try {
      const summary = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.3, maxTokens: 512 },
      );
      return summary;
    } catch (err: any) {
      this.logger.error(`generateEligibilitySummary failed: ${err.message}`);
      return `Unable to generate eligibility summary at this time. Please review the verification record manually. Error: ${err.message}`;
    }
  }

  /**
   * Generate structured action alerts from an eligibility verification.
   * Returns actionable items for front-desk staff and providers.
   */
  async generateEligibilityAlerts(verification: any): Promise<{
    alerts: Array<{
      severity: 'info' | 'warning' | 'critical';
      category: string;
      message: string;
      action: string;
    }>;
    summary: string;
  }> {
    const prompt = `You are a medical insurance eligibility expert. Analyze the following eligibility verification and generate actionable alerts for clinical and front-desk staff.

Verification Data:
${JSON.stringify(verification, null, 2)}

Return JSON with this structure:
{
  "alerts": [
    {
      "severity": "info|warning|critical",
      "category": "coverage|financial|authorization|referral|expiry|cob",
      "message": "Clear, specific message about the issue",
      "action": "What staff should do about it"
    }
  ],
  "summary": "One-line summary of overall coverage status"
}

Generate alerts for:
- Coverage status (active/inactive/terminated) — critical if inactive
- Prior authorization requirements — warning if required, include CPT codes if known
- Referral requirements — warning if required
- Policy expiration approaching (within 30 days) — warning
- High deductible remaining — info with amount
- Copay due today — info with amount
- Coinsurance percentage — info
- Out-of-pocket max status — info
- COB issues if multiple policies — warning
- Network status — warning if out of network
- Missing or incomplete verification data — warning

Only include alerts that are relevant to the verification data. Do not fabricate issues.
Severity guidelines:
- critical: blocks service (inactive coverage, terminated policy)
- warning: requires action before or during visit (auth needed, referral needed, expiring soon)
- info: informational (copay amount, deductible status)`;

    try {
      const result = await this.aiService.generateStructured<{
        alerts: Array<{ severity: string; category: string; message: string; action: string }>;
        summary: string;
      }>(prompt, { temperature: 0.1, maxTokens: 2048 });

      // Validate and normalize severity
      const validSeverities = ['info', 'warning', 'critical'];
      const alerts = (result.alerts || []).map((a) => ({
        severity: validSeverities.includes(a.severity) ? (a.severity as 'info' | 'warning' | 'critical') : 'info',
        category: a.category || 'general',
        message: a.message || '',
        action: a.action || '',
      }));

      return {
        alerts,
        summary: result.summary || 'Eligibility verification analyzed.',
      };
    } catch (err: any) {
      this.logger.error(`generateEligibilityAlerts failed: ${err.message}`);

      // Fallback: rule-based alerts
      return this.ruleBasedAlerts(verification);
    }
  }

  /**
   * Rule-based fallback for eligibility alerts when AI is unavailable.
   */
  private ruleBasedAlerts(verification: any): {
    alerts: Array<{ severity: 'info' | 'warning' | 'critical'; category: string; message: string; action: string }>;
    summary: string;
  } {
    const alerts: Array<{ severity: 'info' | 'warning' | 'critical'; category: string; message: string; action: string }> = [];

    // Coverage status
    if (verification.coverageStatus === 'inactive' || verification.coverageStatus === 'terminated') {
      alerts.push({
        severity: 'critical',
        category: 'coverage',
        message: `Coverage is ${verification.coverageStatus}. Patient cannot be billed to insurance.`,
        action: 'Inform patient and discuss self-pay options or alternative coverage.',
      });
    } else if (verification.coverageStatus === 'active') {
      alerts.push({
        severity: 'info',
        category: 'coverage',
        message: 'Coverage is active.',
        action: 'Proceed with normal check-in.',
      });
    }

    // Authorization
    if (verification.authorizationRequired) {
      alerts.push({
        severity: 'warning',
        category: 'authorization',
        message: 'Prior authorization is required for this visit.',
        action: 'Verify auth number is on file before the appointment. If not, start auth process immediately.',
      });
    }

    // Referral
    if (verification.referralRequired) {
      alerts.push({
        severity: 'warning',
        category: 'referral',
        message: 'Referral from PCP is required.',
        action: 'Confirm referral is on file. If not, contact patient\'s PCP office.',
      });
    }

    // Copay
    if (verification.copayAmount != null && verification.copayAmount > 0) {
      alerts.push({
        severity: 'info',
        category: 'financial',
        message: `Patient copay: $${verification.copayAmount}`,
        action: `Collect $${verification.copayAmount} at check-in.`,
      });
    }

    // Deductible
    if (verification.deductibleRemaining != null && verification.deductibleRemaining > 0) {
      const severity = verification.deductibleRemaining > 1000 ? 'warning' : 'info';
      alerts.push({
        severity,
        category: 'financial',
        message: `Deductible remaining: $${verification.deductibleRemaining}`,
        action: severity === 'warning'
          ? 'High deductible — discuss payment plan options with patient.'
          : 'Inform patient of remaining deductible.',
      });
    }

    // Expiration
    if (verification.expirationDate) {
      const expDate = new Date(verification.expirationDate);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 0) {
        alerts.push({
          severity: 'critical',
          category: 'expiry',
          message: `Policy expired ${Math.abs(daysUntilExpiry)} days ago.`,
          action: 'Request updated insurance information from patient.',
        });
      } else if (daysUntilExpiry <= 30) {
        alerts.push({
          severity: 'warning',
          category: 'expiry',
          message: `Policy expires in ${daysUntilExpiry} days.`,
          action: 'Remind patient to update insurance before expiration.',
        });
      }
    }

    const summary = alerts.some((a) => a.severity === 'critical')
      ? 'CRITICAL: Coverage issues detected — review before appointment.'
      : alerts.some((a) => a.severity === 'warning')
        ? 'Action required before visit — see warnings.'
        : 'Coverage active — proceed with normal check-in.';

    return { alerts, summary };
  }

  /**
   * Estimate patient financial responsibility for a set of CPT procedure codes.
   */
  async estimatePatientResponsibility(verification: any, procedureCodes: string[]): Promise<object> {
    const systemPrompt = `You are a medical billing expert specializing in patient cost estimation.
Given insurance coverage details and a list of CPT procedure codes, estimate the patient's out-of-pocket responsibility.
Always respond with valid JSON only. Do not include markdown, explanations, or any text outside the JSON object.`;

    const userPrompt = `Estimate the patient's financial responsibility for the following procedures based on their insurance coverage.

Coverage Details:
- Payer: ${verification.payerName ?? 'Unknown'}
- Plan: ${verification.planName ?? 'Unknown'} (${verification.planType ?? 'Unknown'})
- Network Status: ${verification.network ?? 'Unknown'}
- Coverage Status: ${verification.coverageStatus ?? 'Unknown'}
- Individual Deductible: ${verification.deductibleIndividual != null ? '$' + verification.deductibleIndividual : 'Unknown'}
- Deductible Remaining: ${verification.deductibleRemaining != null ? '$' + verification.deductibleRemaining : 'Unknown'}
- Out-of-Pocket Max: ${verification.outOfPocketIndividual != null ? '$' + verification.outOfPocketIndividual : 'Unknown'}
- Out-of-Pocket Remaining: ${verification.outOfPocketRemaining != null ? '$' + verification.outOfPocketRemaining : 'Unknown'}
- Copay: ${verification.copayAmount != null ? '$' + verification.copayAmount : 'Unknown'}
- Coinsurance: ${verification.coinsurancePercentage != null ? verification.coinsurancePercentage + '%' : 'Unknown'}
- Authorization Required: ${verification.authorizationRequired ? 'Yes' : 'No'}
- Benefits: ${JSON.stringify(verification.benefits ?? [])}
- Benefit Limitations: ${JSON.stringify(verification.benefitLimitations ?? {})}

Procedure Codes (CPT): ${procedureCodes.join(', ')}

Return a JSON object with the following structure:
{
  "procedureEstimates": [
    {
      "cptCode": "string",
      "description": "string (brief description of the procedure)",
      "estimatedAllowedAmount": "number or null",
      "deductibleApplied": "number",
      "copayApplied": "number",
      "coinsuranceApplied": "number",
      "estimatedPatientResponsibility": "number",
      "estimatedInsurancePayment": "number or null",
      "notes": "string or null"
    }
  ],
  "summary": {
    "totalEstimatedCharges": "number",
    "totalDeductibleApplied": "number",
    "totalCopayApplied": "number",
    "totalCoinsuranceApplied": "number",
    "totalPatientResponsibility": "number",
    "totalInsurancePayment": "number or null",
    "deductibleRemainingAfter": "number or null"
  },
  "assumptions": ["string array of assumptions made in this estimate"],
  "disclaimer": "string",
  "estimatedAt": "${new Date().toISOString()}"
}`;

    try {
      const result = await this.aiService.generateStructured<object>(
        `${systemPrompt}\n\n${userPrompt}`,
        { temperature: 0.1, maxTokens: 2048 },
      );
      return result;
    } catch (err: any) {
      this.logger.error(`estimatePatientResponsibility failed: ${err.message}`);
      return {
        error: 'Failed to estimate patient responsibility',
        message: err.message,
        procedureEstimates: [],
        summary: {
          totalEstimatedCharges: 0,
          totalDeductibleApplied: 0,
          totalCopayApplied: 0,
          totalCoinsuranceApplied: 0,
          totalPatientResponsibility: 0,
          totalInsurancePayment: null,
          deductibleRemainingAfter: null,
        },
        assumptions: [],
        disclaimer: 'This estimate could not be generated due to a system error.',
      };
    }
  }

  /**
   * Assess the risk of claim denial based on coverage data, diagnosis, and procedure codes.
   */
  async assessDenialRisk(
    verification: any,
    diagnosisCodes: string[],
    procedureCodes: string[],
  ): Promise<object> {
    const systemPrompt = `You are a medical billing compliance expert specializing in claim denial prevention.
Analyze insurance coverage details, clinical codes, and coverage requirements to assess the risk of claim denial.
Always respond with valid JSON only. Do not include markdown, explanations, or any text outside the JSON object.`;

    const userPrompt = `Assess the risk of claim denial for the following scenario.

Insurance Coverage:
- Payer: ${verification.payerName ?? 'Unknown'}
- Plan: ${verification.planName ?? 'Unknown'} (${verification.planType ?? 'Unknown'})
- Network: ${verification.network ?? 'Unknown'}
- Coverage Status: ${verification.coverageStatus ?? 'Unknown'}
- Authorization Required: ${verification.authorizationRequired ? 'YES' : 'No'}
- Referral Required: ${verification.referralRequired ? 'YES' : 'No'}
- Benefit Limitations: ${JSON.stringify(verification.benefitLimitations ?? {})}
- Benefits: ${JSON.stringify(verification.benefits ?? [])}
- Plan Effective Date: ${verification.effectiveDate ?? 'Unknown'}
- Plan Expiration Date: ${verification.expirationDate ?? 'Unknown'}

ICD-10 Diagnosis Codes: ${diagnosisCodes.join(', ')}
CPT Procedure Codes: ${procedureCodes.join(', ')}

Evaluate denial risk considering: medical necessity, prior authorization requirements, network status, coverage limitations, code pairing validity, and frequency limitations.

Return a JSON object with the following structure:
{
  "riskLevel": "low | medium | high",
  "riskScore": "number 0-100",
  "riskFactors": [
    {
      "factor": "string (name of the risk factor)",
      "severity": "low | medium | high",
      "description": "string (explanation of the risk)",
      "affectedCodes": ["string array of CPT/ICD codes involved"]
    }
  ],
  "recommendations": [
    {
      "action": "string (specific action to take)",
      "priority": "urgent | high | medium | low",
      "description": "string (detailed recommendation)"
    }
  ],
  "codeAnalysis": {
    "diagnosisProcedureAlignment": "string (assessment of ICD-10 to CPT alignment)",
    "potentialBundlingIssues": ["string array"],
    "medicalNecessityConcerns": ["string array"]
  },
  "assessedAt": "${new Date().toISOString()}"
}`;

    try {
      const result = await this.aiService.generateStructured<object>(
        `${systemPrompt}\n\n${userPrompt}`,
        { temperature: 0.1, maxTokens: 2048 },
      );
      return result;
    } catch (err: any) {
      this.logger.error(`assessDenialRisk failed: ${err.message}`);
      return {
        error: 'Failed to assess denial risk',
        message: err.message,
        riskLevel: 'unknown',
        riskScore: null,
        riskFactors: [],
        recommendations: [
          {
            action: 'Manual Review Required',
            priority: 'high',
            description: 'Automated risk assessment failed. Please manually review prior auth requirements, code pairing, and coverage limitations before submitting the claim.',
          },
        ],
        codeAnalysis: {
          diagnosisProcedureAlignment: 'Unable to assess',
          potentialBundlingIssues: [],
          medicalNecessityConcerns: [],
        },
      };
    }
  }

  /**
   * Draft a prior authorization request letter for a procedure.
   */
  async generatePriorAuthRequest(
    verification: any,
    procedure: string,
    clinicalNotes: string,
  ): Promise<string> {
    const systemPrompt = `You are a medical billing specialist experienced in writing prior authorization request letters to insurance companies.
Write professional, persuasive, and medically accurate prior authorization letters that include all required clinical and administrative information.
The letter should follow standard prior auth format and include all elements an insurance medical reviewer needs to approve the request.`;

    const userPrompt = `Draft a prior authorization request letter for the following case.

Patient & Insurance Information:
- Patient Name: ${verification.patientName ?? '[PATIENT NAME]'}
- Payer: ${verification.payerName ?? '[INSURANCE COMPANY]'}
- Plan: ${verification.planName ?? '[PLAN NAME]'} (${verification.planType ?? 'Unknown'})
- Policy Number: ${verification.policyNumber ?? '[POLICY NUMBER]'}
- Group Number: ${verification.groupNumber ?? '[GROUP NUMBER]'}
- Subscriber Name: ${verification.subscriberName ?? '[SUBSCRIBER NAME]'}
- Coverage Status: ${verification.coverageStatus ?? 'Unknown'}
- Network: ${verification.network ?? 'Unknown'}

Requested Procedure:
${procedure}

Clinical Notes / Medical Necessity Justification:
${clinicalNotes}

Benefit Limitations on File:
${JSON.stringify(verification.benefitLimitations ?? {}, null, 2)}

Write a complete, professional prior authorization request letter including:
1. Date and recipient (insurance company)
2. Patient and policy identification
3. Provider information placeholder
4. Requested procedure with CPT code if mentioned
5. Medical necessity justification based on the clinical notes
6. Supporting clinical information
7. Urgency level if applicable
8. Contact information placeholder for follow-up
9. Provider signature block placeholder

Format as a professional business letter ready to be submitted to the insurance company.`;

    try {
      const letter = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.4, maxTokens: 2048 },
      );
      return letter;
    } catch (err: any) {
      this.logger.error(`generatePriorAuthRequest failed: ${err.message}`);
      return `Unable to generate prior authorization request letter at this time. Error: ${err.message}\n\nPlease draft the prior authorization request manually using the patient's insurance information and clinical notes provided.`;
    }
  }
}
