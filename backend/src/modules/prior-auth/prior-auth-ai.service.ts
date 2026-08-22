import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  PriorAuthRequest,
  PriorAuthCode,
  PriorAuthDiagnosis,
  PriorAuthStatus,
  PriorAuthBenefitType,
  PriorAuthUrgency,
  AiRequirementPrediction,
  AiApprovalPrediction,
  AiExpirationPrediction,
  PriorAuthClinicalEvidence,
} from './entities/prior-auth-request.entity';
import { lookupRequirement, SeedRequirement } from './prior-auth-requirement-registry';

export interface RequirementCheckResult {
  procedureCode: string;
  requirementType: 'always' | 'conditional' | 'never' | 'unknown';
  rule: SeedRequirement | null;
  aiPrediction: AiRequirementPrediction | null;
  isRequired: boolean;
  confidence: number;
}

export interface AutoPaResult {
  triggered: boolean;
  reason: string;
  requirements: RequirementCheckResult[];
  draftRequest: Partial<PriorAuthRequest> | null;
  authLetter: string | null;
}

export interface P2PPrepResult {
  likelyDenialRationale: string;
  counterArguments: Array<{ point: string; supportingEvidence: string }>;
  similarApprovedCases: string[];
  talkingPoints: string[];
  recommendedStrategy: string;
}

export interface EvidenceAssemblyResult {
  evidence: PriorAuthClinicalEvidence;
  attachments: Array<{
    attachmentType: string;
    title: string;
    content: string;
    satisfiesCriterion: string;
    relevanceScore: number;
  }>;
  coverageGaps: string[];
}

@Injectable()
export class PriorAuthAiService {
  private readonly logger = new Logger(PriorAuthAiService.name);

  constructor(private readonly aiService: AiService) {}

  // ═══════════════════════════════════════════════════════════════════
  // A1: PA Requirement Predictor
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Predict whether PA is required for a payer × CPT × ICD combination.
   * Uses the deterministic registry first, then AI for ambiguous/missing rules.
   */
  async predictRequirement(
    payerName: string,
    procedureCodes: string[],
    diagnosisCodes: string[] = [],
    patientContext?: { age?: number; sex?: string; activeDiagnoses?: string[] },
    denialHistory?: Array<{ payer: string; cpt: string; deniedForPa: boolean }>,
  ): Promise<AiRequirementPrediction> {
    this.logger.debug(`Predicting PA requirement for ${payerName} × ${procedureCodes.join(',')}`);

    // First, check the deterministic registry
    const registryHits = procedureCodes.map((cpt) => lookupRequirement(payerName, cpt));
    const hasAlwaysRequired = registryHits.some((r) => r?.requirementType === 'always');
    const hasConditional = registryHits.some((r) => r?.requirementType === 'conditional');
    const hasNoRule = registryHits.some((r) => r === null);

    // If all rules are deterministic and clear, return without AI
    if (hasAlwaysRequired && !hasConditional && !hasNoRule) {
      return {
        probability: 100,
        isRequired: true,
        confidence: 95,
        factors: registryHits
          .filter((r): r is SeedRequirement => r !== null)
          .map((r) => ({
            factor: `Registry rule: ${r.procedureCode} ${r.requirementType}`,
            weight: 1.0,
            detail: r.procedureDescription,
          })),
        rationale: `PA required per ${payerName} medical policy for ${procedureCodes.join(', ')}`,
      };
    }

    // Use AI for ambiguous / missing rules
    const prompt = `You are a healthcare prior authorization expert. Predict whether prior authorization is required for the following scenario.

Payer: ${payerName}
Procedure Codes (CPT/HCPCS): ${procedureCodes.join(', ')}
Diagnosis Codes (ICD-10): ${diagnosisCodes.join(', ')}
${patientContext ? `Patient: age ${patientContext.age ?? 'unknown'}, sex ${patientContext.sex ?? 'unknown'}` : ''}
${patientContext?.activeDiagnoses ? `Active diagnoses: ${patientContext.activeDiagnoses.join(', ')}` : ''}
${denialHistory?.length ? `Historical denial data:\n${denialHistory.map((d) => `- ${d.payer} × ${d.cpt}: ${d.deniedForPa ? 'denied for PA' : 'no PA issue'}`).join('\n')}` : 'No historical denial data available.'}

Registry lookup results:
${registryHits.map((r, i) => `- ${procedureCodes[i]}: ${r ? `${r.requirementType} — ${r.procedureDescription}` : 'no rule found'}`).join('\n')}

Return ONLY a JSON object with this exact shape:
{
  "probability": number (0-100, probability that PA is required),
  "isRequired": boolean,
  "confidence": number (0-100, how confident the prediction is),
  "factors": [
    { "factor": "string", "weight": 0.0-1.0, "detail": "string" }
  ],
  "rationale": "string (explanation of the prediction)"
}

Rules:
- If the registry says "always", probability should be 90-100.
- If the registry says "conditional", evaluate the conditions against the diagnosis codes.
- If no rule exists, use payer patterns and code type (imaging, specialty drugs, high-cost procedures tend to require PA).
- Consider that high-cost imaging (MRI, CT, PET), specialty drugs, DME, and surgical procedures commonly require PA.
- Use denial history to adjust probability — if this payer has denied this CPT for missing PA before, increase probability.`;

    try {
      return await this.aiService.generateStructured<AiRequirementPrediction>(prompt, {
        temperature: 0.1,
        maxTokens: 1024,
      });
    } catch (err: any) {
      this.logger.error(`predictRequirement failed: ${err.message}`);
      // Fallback: conservative default — assume PA required for safety
      return {
        probability: 70,
        isRequired: true,
        confidence: 40,
        factors: [
          { factor: 'AI prediction unavailable', weight: 0.5, detail: 'Defaulting to required for safety' },
        ],
        rationale: `Unable to predict with certainty — defaulting to PA required as a safety measure. Error: ${err.message}`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // A2: Auto-PA at Order Entry
  // ═══════════════════════════════════════════════════════════════════

  /**
   * When a provider orders a procedure, check if PA is needed and auto-draft
   * the PA request + letter inline — before the encounter ends.
   */
  async autoTriggerPa(
    patientId: string,
    payerName: string,
    procedureCodes: PriorAuthCode[],
    diagnosisCodes: PriorAuthDiagnosis[] = [],
    clinicalNotes?: string,
    patientContext?: { age?: number; sex?: string; name?: string; activeDiagnoses?: string[] },
    denialHistory?: Array<{ payer: string; cpt: string; deniedForPa: boolean }>,
  ): Promise<AutoPaResult> {
    this.logger.debug(`Auto-triggering PA check for patient ${patientId}`);

    // Check requirements for each CPT
    const requirements: RequirementCheckResult[] = [];
    for (const proc of procedureCodes) {
      const rule = lookupRequirement(payerName, proc.code);
      let aiPrediction: AiRequirementPrediction | null = null;

      if (!rule || rule.requirementType === 'conditional') {
        aiPrediction = await this.predictRequirement(
          payerName,
          [proc.code],
          diagnosisCodes.map((d) => d.code),
          patientContext,
          denialHistory,
        );
      }

      const isRequired =
        rule?.requirementType === 'always' ||
        (rule?.requirementType === 'conditional' && (aiPrediction?.isRequired ?? true)) ||
        (!rule && (aiPrediction?.isRequired ?? true));

      requirements.push({
        procedureCode: proc.code,
        requirementType: rule?.requirementType ?? 'unknown',
        rule,
        aiPrediction,
        isRequired,
        confidence: aiPrediction?.confidence ?? (rule ? 90 : 50),
      });
    }

    const anyRequired = requirements.some((r) => r.isRequired);

    if (!anyRequired) {
      return {
        triggered: false,
        reason: 'No prior authorization required for the ordered procedures with this payer.',
        requirements,
        draftRequest: null,
        authLetter: null,
      };
    }

    // Auto-draft the PA request
    const draftRequest: Partial<PriorAuthRequest> = {
      patientId,
      patientName: patientContext?.name ?? null,
      benefitType: PriorAuthBenefitType.MEDICAL,
      status: PriorAuthStatus.DRAFT,
      urgency: PriorAuthUrgency.STANDARD,
      payerName,
      procedureCodes,
      diagnosisCodes,
      clinicalNotes: clinicalNotes ?? null,
      autoTriggered: true,
      autoTriggerSource: 'order_entry',
    };

    // Auto-generate the PA letter
    const authLetter = await this.generateAuthLetter(
      payerName,
      procedureCodes,
      diagnosisCodes,
      clinicalNotes ?? '',
      patientContext,
    );

    return {
      triggered: true,
      reason: `PA required for: ${requirements.filter((r) => r.isRequired).map((r) => r.procedureCode).join(', ')}`,
      requirements,
      draftRequest,
      authLetter,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PA Letter Generation (reuses existing AI letter logic pattern)
  // ═══════════════════════════════════════════════════════════════════

  async generateAuthLetter(
    payerName: string,
    procedureCodes: PriorAuthCode[],
    diagnosisCodes: PriorAuthDiagnosis[],
    clinicalNotes: string,
    patientContext?: { name?: string; dob?: string; policyNumber?: string; planName?: string },
  ): Promise<string> {
    const systemPrompt = `You are a medical prior authorization specialist. Write a formal, professional prior authorization letter to an insurance company requesting approval for a procedure. The letter must include:
1. Date and insurer name
2. Patient demographics (name, DOB if available)
3. Diagnosis with ICD-10 codes
4. Requested procedure(s) with CPT codes
5. Clinical justification referencing the provided notes
6. Statement of medical necessity
7. Supporting clinical evidence summary
8. Provider signature block

Use formal medical correspondence tone. Fill in all known fields from the provided data.`;

    const userPrompt = `Write a prior authorization letter using the following information:

Patient Name: ${patientContext?.name ?? '[PATIENT NAME]'}
Patient DOB: ${patientContext?.dob ?? '[DOB]'}
Insurance Company: ${payerName}
Plan: ${patientContext?.planName ?? '[PLAN]'}
Policy Number: ${patientContext?.policyNumber ?? '[POLICY NUMBER]'}

Requested Procedures:
${procedureCodes.map((p) => `- CPT ${p.code}: ${p.description}${p.quantity ? ` (qty: ${p.quantity})` : ''}`).join('\n')}

Diagnoses:
${diagnosisCodes.map((d) => `- ICD-10 ${d.code}: ${d.description}${d.isPrimary ? ' (primary)' : ''}`).join('\n')}

Clinical Notes:
"""${clinicalNotes}"""

Write the complete letter now.`;

    try {
      return await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.4, maxTokens: 2048 },
      );
    } catch (err: any) {
      this.logger.error(`generateAuthLetter failed: ${err.message}`);
      return `Unable to generate prior authorization letter at this time. Error: ${err.message}\n\nPlease draft the PA letter manually using the patient's insurance information and clinical notes provided.`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // A4: PA Approval Probability Score
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Before submission, predict likelihood of approval and recommend
   * what to add to push the probability above 80%.
   */
  async predictApprovalProbability(
    request: PriorAuthRequest,
    historicalData?: {
      approvalRate: number;
      denialReasons: Array<{ reason: string; frequency: number }>;
      byPayer: Record<string, number>;
    },
  ): Promise<AiApprovalPrediction> {
    this.logger.debug(`Predicting approval probability for PA ${request.id}`);

    const prompt = `You are a prior authorization analyst. Predict the probability of approval for this PA request and recommend actions to improve it.

PA Request Details:
- Payer: ${request.payerName}
- Plan: ${request.planName ?? 'Unknown'}
- Benefit Type: ${request.benefitType}
- Urgency: ${request.urgency}

Requested Procedures:
${request.procedureCodes.map((p) => `- CPT ${p.code}: ${p.description}`).join('\n')}

Diagnoses:
${request.diagnosisCodes.map((d) => `- ICD-10 ${d.code}: ${d.description}${d.isPrimary ? ' (primary)' : ''}`).join('\n')}

Clinical Evidence:
${request.clinicalEvidence ? JSON.stringify(request.clinicalEvidence, null, 2) : 'None documented'}

Clinical Notes:
${request.clinicalNotes ?? 'None'}

${historicalData ? `Historical Data:
- Overall approval rate: ${historicalData.approvalRate}%
- Top denial reasons: ${historicalData.denialReasons.map((d) => `${d.reason} (${d.frequency}x)`).join(', ')}
- Approval rate by payer: ${JSON.stringify(historicalData.byPayer)}` : 'No historical data available.'}

Return ONLY a JSON object with this exact shape:
{
  "approvalProbability": number (0-100),
  "riskLevel": "low" | "medium" | "high",
  "factors": [
    { "factor": "string", "impact": "positive" | "negative" | "neutral", "detail": "string" }
  ],
  "recommendations": [
    { "action": "string", "priority": "urgent" | "high" | "medium" | "low", "detail": "string" }
  ],
  "missingDocumentation": ["list of required documents/criteria not yet provided"]
}

Rules:
- Consider whether documented clinical evidence matches typical payer criteria for these CPT codes.
- Consider diagnosis-to-procedure alignment (is the ICD-10 appropriate for the CPT?).
- Consider whether conservative therapy has been documented (common PA requirement).
- Consider payer-specific approval patterns from historical data.
- Flag missing documentation that the payer's policy likely requires.
- If approval probability < 80%, recommend specific actions to improve it.`;

    try {
      return await this.aiService.generateStructured<AiApprovalPrediction>(prompt, {
        temperature: 0.1,
        maxTokens: 2048,
      });
    } catch (err: any) {
      this.logger.error(`predictApprovalProbability failed: ${err.message}`);
      return {
        approvalProbability: 50,
        riskLevel: 'medium',
        factors: [
          { factor: 'AI prediction unavailable', impact: 'neutral', detail: err.message },
        ],
        recommendations: [
          { action: 'Manual review', priority: 'high', detail: 'AI prediction failed — review PA requirements manually before submission.' },
        ],
        missingDocumentation: [],
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // A6: PA Expiration Predictor
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Predict when a PA will expire based on payer patterns and warn
   * before the scheduled service date.
   */
  async predictExpiration(
    request: PriorAuthRequest,
    scheduledServiceDate?: Date,
    payerHistory?: Array<{ payer: string; typicalValidityDays: number; actualExpirations: number }>,
  ): Promise<AiExpirationPrediction> {
    this.logger.debug(`Predicting expiration for PA ${request.id}`);

    const now = new Date();
    const knownExpiration = request.expirationDate ?? request.approvedEndDate;
    const serviceDate = scheduledServiceDate ?? request.serviceDate;

    // If we have a known expiration date, calculate directly
    if (knownExpiration) {
      const expDate = new Date(knownExpiration);
      const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const serviceAfterExpiration = serviceDate
        ? new Date(serviceDate) > expDate
        : false;

      return {
        predictedExpiration: expDate.toISOString(),
        daysUntilExpiration: daysUntil,
        expirationRisk: daysUntil < 0 ? 'high' : daysUntil < 7 ? 'high' : daysUntil < 14 ? 'medium' : 'low',
        recommendation:
          daysUntil < 0
            ? 'PA has already expired — re-authorization required before service.'
            : serviceAfterExpiration
              ? `PA expires ${daysUntil} days from now but service is scheduled after expiration — reschedule or re-authorize.`
              : daysUntil < 7
                ? `PA expires in ${daysUntil} days — initiate re-authorization now to avoid care delay.`
                : `PA valid for ${daysUntil} more days — no action needed yet.`,
      };
    }

    // Use AI to predict expiration based on payer patterns
    const prompt = `You are a prior authorization analyst. Predict when this approved PA will expire based on payer patterns.

PA Request:
- Payer: ${request.payerName}
- Procedures: ${request.procedureCodes.map((p) => p.code).join(', ')}
- Approved at: ${request.payerResponseAt ?? 'unknown'}
- Service date: ${serviceDate ?? 'not scheduled'}
- Visit count approved: ${request.visitCountApproved ?? 'unlimited'}

${payerHistory?.length ? `Payer history:
${payerHistory.map((p) => `- ${p.payer}: typical ${p.typicalValidityDays} days, ${p.actualExpirations} expirations observed`).join('\n')}` : 'No payer history available.'}

Return ONLY a JSON object with this exact shape:
{
  "predictedExpiration": "ISO date string (predicted expiration date)",
  "daysUntilExpiration": number (days from now until predicted expiration),
  "expirationRisk": "low" | "medium" | "high",
  "recommendation": "string (actionable recommendation)"
}

Rules:
- Most PAs are valid 30-90 days; imaging typically 90 days; procedures 60-120 days; specialty drugs 180 days.
- If service is scheduled after the predicted expiration, risk is "high".
- If less than 7 days remain, risk is "high".
- If less than 14 days remain, risk is "medium".
- Use payer history if available for more accurate prediction.`;

    try {
      return await this.aiService.generateStructured<AiExpirationPrediction>(prompt, {
        temperature: 0.1,
        maxTokens: 512,
      });
    } catch (err: any) {
      this.logger.error(`predictExpiration failed: ${err.message}`);
      // Fallback: assume 60 days from approval
      const fallbackExp = new Date(now);
      fallbackExp.setDate(fallbackExp.getDate() + 60);
      const daysUntil = 60;
      return {
        predictedExpiration: fallbackExp.toISOString(),
        daysUntilExpiration: daysUntil,
        expirationRisk: 'medium',
        recommendation: `Unable to predict expiration precisely — assuming 60 days from approval. Please verify with payer. Error: ${err.message}`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // A3: Clinical Evidence Auto-Assembler (P2 feature, included as stub)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Pull the exact clinical evidence the payer's policy requires
   * from the patient's chart and assemble it for the PA submission.
   */
  async assembleClinicalEvidence(
    request: PriorAuthRequest,
    chartData: {
      labs?: Array<{ name: string; value: string; date: string }>;
      imaging?: Array<{ name: string; findings: string; date: string }>;
      medications?: Array<{ name: string; startDate: string; status: string }>;
      encounters?: Array<{ date: string; assessment: string; plan: string }>;
      vitals?: Array<{ type: string; value: string; date: string }>;
      history?: Array<{ condition: string; onsetDate: string; status: string }>;
    },
    requiredCriteria: Array<{ criterion: string; description: string }>,
  ): Promise<EvidenceAssemblyResult> {
    this.logger.debug(`Assembling clinical evidence for PA ${request.id}`);

    const prompt = `You are a clinical documentation specialist. Assemble the clinical evidence needed for a prior authorization submission by extracting relevant data from the patient's chart.

PA Request:
- Payer: ${request.payerName}
- Procedures: ${request.procedureCodes.map((p) => `${p.code} (${p.description})`).join(', ')}
- Diagnoses: ${request.diagnosisCodes.map((d) => `${d.code} (${d.description})`).join(', ')}

Required Criteria (from payer policy):
${requiredCriteria.map((c) => `- ${c.criterion}: ${c.description}`).join('\n')}

Patient Chart Data:
- Labs: ${JSON.stringify(chartData.labs ?? [])}
- Imaging: ${JSON.stringify(chartData.imaging ?? [])}
- Medications: ${JSON.stringify(chartData.medications ?? [])}
- Encounters: ${JSON.stringify(chartData.encounters ?? [])}
- Vitals: ${JSON.stringify(chartData.vitals ?? [])}
- History: ${JSON.stringify(chartData.history ?? [])}

Return ONLY a JSON object with this exact shape:
{
  "evidence": {
    "summary": "string (narrative summary of supporting evidence)",
    "items": [
      { "type": "lab" | "imaging" | "medication" | "procedure" | "encounter" | "vital" | "history", "description": "string", "date": "ISO date", "value": "string", "source": "string" }
    ]
  },
  "attachments": [
    { "attachmentType": "string", "title": "string", "content": "string (the evidence text)", "satisfiesCriterion": "string (which required criterion this satisfies)", "relevanceScore": 0.0-1.0 }
  ],
  "coverageGaps": ["list of required criteria that have no supporting evidence in the chart"]
}

Rules:
- Map each piece of evidence to the payer criterion it satisfies.
- Only include evidence relevant to the requested procedures and diagnoses.
- Flag criteria that have no supporting evidence as coverage gaps.
- Prioritize evidence that directly addresses medical necessity requirements.
- For conservative therapy criteria, look for PT referrals, medication trials, and follow-up visits.`;

    try {
      return await this.aiService.generateStructured<EvidenceAssemblyResult>(prompt, {
        temperature: 0.1,
        maxTokens: 2048,
      });
    } catch (err: any) {
      this.logger.error(`assembleClinicalEvidence failed: ${err.message}`);
      return {
        evidence: { summary: 'Unable to assemble evidence automatically.', items: [] },
        attachments: [],
        coverageGaps: requiredCriteria.map((c) => c.criterion),
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // A5: P2P Review Prep Coach (P2 feature, included as stub)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * When PA is denied, prepare the provider for the peer-to-peer review
   * with the payer's medical director.
   */
  async prepareP2PReview(
    request: PriorAuthRequest,
    denialReason: string,
    practiceHistory?: Array<{ cpt: string; payer: string; outcome: 'approved' | 'denied'; notes: string }>,
  ): Promise<P2PPrepResult> {
    this.logger.debug(`Preparing P2P review for PA ${request.id}`);

    const prompt = `You are a physician advocate preparing a provider for a peer-to-peer (P2P) review with an insurance company medical director after a prior authorization denial.

PA Request:
- Payer: ${request.payerName}
- Procedures: ${request.procedureCodes.map((p) => `${p.code} (${p.description})`).join(', ')}
- Diagnoses: ${request.diagnosisCodes.map((d) => `${d.code} (${d.description})`).join(', ')}

Denial Reason: ${denialReason}
Denial Code: ${request.denialCode ?? 'N/A'}

Clinical Evidence:
${request.clinicalEvidence ? JSON.stringify(request.clinicalEvidence, null, 2) : 'None documented'}

Clinical Notes:
${request.clinicalNotes ?? 'None'}

${practiceHistory?.length ? `Practice history with similar cases:
${practiceHistory.map((c) => `- ${c.cpt} × ${c.payer}: ${c.outcome} — ${c.notes}`).join('\n')}` : 'No practice history available.'}

Return ONLY a JSON object with this exact shape:
{
  "likelyDenialRationale": "string (the payer's likely reasoning for denial)",
  "counterArguments": [
    { "point": "string (the argument)", "supportingEvidence": "string (evidence from the chart that supports this argument)" }
  ],
  "similarApprovedCases": ["list of descriptions of similar cases that were approved, if any"],
  "talkingPoints": ["ordered list of key points to make during the P2P call"],
  "recommendedStrategy": "string (overall strategy for the call)"
}

Rules:
- Address the specific denial reason — don't just restate medical necessity generically.
- Provide specific, evidence-based counter-arguments.
- Reference clinical guidelines and standards of care when applicable.
- Suggest a collaborative (not adversarial) tone for the call.
- If the denial was for missing conservative therapy, highlight what was tried.
- If the denial was for medical necessity, emphasize symptom severity and functional impact.`;

    try {
      return await this.aiService.generateStructured<P2PPrepResult>(prompt, {
        temperature: 0.3,
        maxTokens: 2048,
      });
    } catch (err: any) {
      this.logger.error(`prepareP2PReview failed: ${err.message}`);
      return {
        likelyDenialRationale: denialReason,
        counterArguments: [],
        similarApprovedCases: [],
        talkingPoints: ['Review the denial reason and prepare clinical justification manually.'],
        recommendedStrategy: 'AI preparation unavailable — manual preparation required.',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // A7: PA-to-Denial Closed-Loop Learning (P2 feature, included as stub)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Learn from denied PAs to improve future submissions.
   * Returns insights that can update the requirement registry and
   * evidence assembler.
   */
  async learnFromDenial(
    request: PriorAuthRequest,
    denialReason: string,
  ): Promise<{
    insights: Array<{ insight: string; action: string; appliesTo: string }>;
    registryUpdate: { payerName: string; procedureCode: string; newCriteria: string[] } | null;
  }> {
    this.logger.debug(`Learning from denial for PA ${request.id}`);

    const prompt = `You are a revenue cycle analyst. Analyze this prior authorization denial and extract learnings to prevent similar denials in the future.

PA Request:
- Payer: ${request.payerName}
- Procedures: ${request.procedureCodes.map((p) => `${p.code} (${p.description})`).join(', ')}
- Diagnoses: ${request.diagnosisCodes.map((d) => `${d.code} (${d.description})`).join(', ')}

Denial Reason: ${denialReason}
Denial Code: ${request.denialCode ?? 'N/A'}

Clinical Evidence Submitted:
${request.clinicalEvidence ? JSON.stringify(request.clinicalEvidence, null, 2) : 'None'}

Return ONLY a JSON object with this exact shape:
{
  "insights": [
    { "insight": "string (what went wrong)", "action": "string (what to do differently next time)", "appliesTo": "string (which payer/CPT this applies to)" }
  ],
  "registryUpdate": {
    "payerName": "string",
    "procedureCode": "string",
    "newCriteria": ["list of additional criteria that should be added to the requirement registry"]
  }
}

Rules:
- If the denial was for missing documentation, specify exactly what was missing.
- If the denial was for medical necessity, identify what clinical evidence would have strengthened the case.
- Suggest concrete registry updates that would prevent this denial type in the future.
- Only suggest registryUpdate if the denial reveals a gap in the current rules.`;

    try {
      return await this.aiService.generateStructured<{
        insights: Array<{ insight: string; action: string; appliesTo: string }>;
        registryUpdate: { payerName: string; procedureCode: string; newCriteria: string[] } | null;
      }>(prompt, {
        temperature: 0.2,
        maxTokens: 1024,
      });
    } catch (err: any) {
      this.logger.error(`learnFromDenial failed: ${err.message}`);
      return { insights: [], registryUpdate: null };
    }
  }
}
