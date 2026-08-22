import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { GoodFaithEstimate, GfeItem } from './entities/good-faith-estimate.entity';
import { NsaIdrCase } from './entities/nsa-idr-case.entity';

export interface AccuracyPrediction {
  accuracyScore: number; // 0-100, higher = more accurate estimate
  highRisk: boolean;
  riskFactors: string[];
  recommendedActions: string[];
}

export interface ReconciliationResult {
  accuracyScore: number;
  perItemVariance: Array<{
    cptCode: string;
    estimated: number;
    actual: number;
    variance: number;
  }>;
  insights: string[];
  rateCorrections: Array<{
    cptCode: string;
    currentEstimate: number;
    recommendedEstimate: number;
    confidence: number;
  }>;
}

export interface PatientFriendlyExplanation {
  explanation: string;
  keyPoints: string[];
  patientRights: string[];
}

export interface DiagnosisCodePrediction {
  predictedCodes: Array<{
    code: string;
    description: string;
    confidence: number;
    rationale: string;
  }>;
}

export interface IdrEligibilityResult {
  eligibilityScore: number; // 0-100
  isEligible: boolean;
  jurisdiction: 'federal' | 'state_ca' | 'state_ny' | 'state_tx' | 'state_nj' | 'state_other';
  factors: Array<{ factor: string; weight: number; detail: string }>;
  expectedRecovery: number;
  recommendation: string;
}

export interface OpenNegotiationOffer {
  recommendedOffer: number;
  qpaEstimate: number;
  rationale: string;
  supportingFactors: string[];
  counterArguments: string[];
}

export interface WinProbabilityResult {
  winProbability: number; // 0-100
  factors: Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }>;
  recommendedFinalOffer: number;
  strategy: string;
}

export interface PatientAcuityLetter {
  letter: string;
  keyPoints: string[];
}

@Injectable()
export class NsaAiService {
  private readonly logger = new Logger(NsaAiService.name);

  constructor(private readonly aiService: AiService) {}

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI Estimate Accuracy Predictor
  // ═══════════════════════════════════════════════════════════════════

  async predictEstimateAccuracy(
    gfe: GoodFaithEstimate,
    historicalAccuracy?: { avgVariance: number; sampleSize: number; byCptCode: Record<string, number> },
  ): Promise<AccuracyPrediction> {
    this.logger.debug(`Predicting estimate accuracy for GFE ${gfe.id}`);

    const prompt = `You are a healthcare billing data scientist specializing in price estimate accuracy under the No Surprises Act. Analyze this Good Faith Estimate and predict how accurate it is likely to be compared to the final billed amount.

GFE Details:
- Patient: ${gfe.patientName}
- GFE Type: ${gfe.gfeType}
- Service Date: ${gfe.serviceDate}
- Total Charge: $${gfe.totalCharge}
- Insurance Estimate: $${gfe.insuranceEstimate}
- Patient Estimate: $${gfe.patientEstimate}

Line Items:
${gfe.items.map((i) => `- ${i.cptCode}: ${i.service}, Charge: $${i.charge}, Insurance Est: $${i.insuranceEstimate}, Patient Est: $${i.patientEstimate}`).join('\n')}

${historicalAccuracy ? `Historical Accuracy Data:
- Average variance: ${historicalAccuracy.avgVariance}%
- Sample size: ${historicalAccuracy.sampleSize} past GFEs
- Per-CPT variance: ${JSON.stringify(historicalAccuracy.byCptCode)}` : 'No historical accuracy data available yet.'}

Return ONLY a JSON object with this exact shape:
{
  "accuracyScore": number (0-100, higher = more likely the estimate matches final bill),
  "highRisk": boolean (true if predicted variance likely exceeds $400),
  "riskFactors": ["factor 1", "factor 2", ...],
  "recommendedActions": ["action 1", "action 2", ...]
}

Analysis Rules:
- Consider CPT codes that historically have high variance (anesthesia, pathology, facility fees).
- Consider whether the GFE type (self-pay vs insured OON) affects accuracy.
- Consider if the service date is far in the future (rates may change).
- Consider if multiple providers/facilities are involved (consolidated GFE risk).
- Flag estimates where insurance estimate seems too optimistic (>80% of charge).
- Flag estimates with very high total charges (>$10,000) as higher risk.
- If historical data shows high variance for specific CPT codes, flag them.`;

    return this.aiService.generateStructured<AccuracyPrediction>(prompt);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI GFE-to-Claim Reconciliation Loop
  // ═══════════════════════════════════════════════════════════════════

  async reconcileGfeWithClaim(
    gfe: GoodFaithEstimate,
    finalBilledAmount: number,
    finalPaidAmount: number,
    actualLineItems: Array<{ cptCode: string; actualAmount: number }>,
  ): Promise<ReconciliationResult> {
    this.logger.debug(`Reconciling GFE ${gfe.id} with final bill`);

    const prompt = `You are a revenue cycle analyst performing GFE-to-claim reconciliation under the No Surprises Act. Compare the estimated charges to the actual billed amounts and generate insights for improving future estimates.

GFE Estimates:
- Total Charge: $${gfe.totalCharge}
- Insurance Estimate: $${gfe.insuranceEstimate}
- Patient Estimate: $${gfe.patientEstimate}

Estimated Line Items:
${gfe.items.map((i) => `- ${i.cptCode}: ${i.service}, Estimated Charge: $${i.charge}, Insurance Est: $${i.insuranceEstimate}, Patient Est: $${i.patientEstimate}`).join('\n')}

Actual Results:
- Final Billed Amount: $${finalBilledAmount}
- Final Paid Amount: $${finalPaidAmount}

Actual Line Items:
${actualLineItems.map((i) => `- ${i.cptCode}: $${i.actualAmount}`).join('\n')}

Return ONLY a JSON object with this exact shape:
{
  "accuracyScore": number (0-100, how close the estimate was to actual),
  "perItemVariance": [
    { "cptCode": "code", "estimated": number, "actual": number, "variance": number }
  ],
  "insights": ["insight 1", "insight 2", ...],
  "rateCorrections": [
    { "cptCode": "code", "currentEstimate": number, "recommendedEstimate": number, "confidence": 0.0-1.0 }
  ]
}

Rules:
- Calculate per-item variance as (actual - estimated).
- Identify CPT codes where the estimate was off by more than 15%.
- Suggest rate corrections for future GFEs based on actual amounts.
- Provide actionable insights about patterns (e.g., "facility fees consistently underestimated").
- Confidence should be higher when multiple data points support the correction.`;

    return this.aiService.generateStructured<ReconciliationResult>(prompt);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI Patient-Friendly GFE Explainer
  // ═══════════════════════════════════════════════════════════════════

  async generatePatientFriendlyExplanation(gfe: GoodFaithEstimate): Promise<PatientFriendlyExplanation> {
    this.logger.debug(`Generating patient-friendly explanation for GFE ${gfe.id}`);

    const prompt = `You are a patient advocate who explains medical billing in plain, compassionate language. Create a patient-friendly explanation of this Good Faith Estimate that a non-medical person can understand.

GFE Details:
- Type: ${gfe.gfeType === 'self_pay' ? 'Self-Pay' : gfe.gfeType === 'uninsured' ? 'Uninsured' : 'Out-of-Network Insurance'}
- Service Date: ${gfe.serviceDate}
- Total Charge: $${gfe.totalCharge}
- Insurance Estimate: $${gfe.insuranceEstimate}
- Patient Estimate: $${gfe.patientEstimate}

Services Included:
${gfe.items.map((i) => `- ${i.service} (CPT: ${i.cptCode}): You may be charged $${i.charge}`).join('\n')}

Return ONLY a JSON object with this exact shape:
{
  "explanation": "2-3 paragraph plain-language explanation of what this estimate means",
  "keyPoints": ["point 1", "point 2", ...],
  "patientRights": ["right 1", "right 2", ...]
}

Rules:
- Use 6th-grade reading level language.
- Explain what each charge is for in simple terms.
- Clearly state what the patient is expected to pay.
- Explain the $400 variance dispute right under the No Surprises Act.
- Mention that this is an estimate, not a final bill.
- For self-pay/uninsured patients, explain they have the right to dispute if the final bill exceeds the estimate by $400+.
- For insured OON patients, explain balance billing protections.
- Do NOT use jargon like "CPT", "allowed amount", or "cost-sharing" without explaining them.`;

    return this.aiService.generateStructured<PatientFriendlyExplanation>(prompt);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI Diagnosis-Code Completion for GFEs
  // ═══════════════════════════════════════════════════════════════════

  async predictDiagnosisCodes(
    patientHistory: { conditions: string[]; medications: string[]; recentEncounters: string[] },
    chiefComplaint: string,
    scheduledProcedure: string,
  ): Promise<DiagnosisCodePrediction> {
    this.logger.debug('Predicting diagnosis codes for pre-encounter GFE');

    const prompt = `You are a certified medical coder (CPC) assisting with a Good Faith Estimate that must be generated before the patient encounter. The provider doesn't yet have a definitive diagnosis, so predict the most likely ICD-10 diagnosis codes based on available information.

Patient History:
- Conditions: ${patientHistory.conditions.join(', ') || 'None'}
- Medications: ${patientHistory.medications.join(', ') || 'None'}
- Recent Encounters: ${patientHistory.recentEncounters.join(', ') || 'None'}

Chief Complaint: ${chiefComplaint}
Scheduled Procedure: ${scheduledProcedure}

Return ONLY a JSON object with this exact shape:
{
  "predictedCodes": [
    { "code": "ICD-10", "description": "description", "confidence": 0.0-1.0, "rationale": "why this code is likely" }
  ]
}

Rules:
- Predict at most 5 diagnosis codes.
- Base predictions on the chief complaint, scheduled procedure, and patient history.
- Confidence should reflect how certain the diagnosis is given pre-encounter information.
- Include rationale explaining why each code is predicted.
- These are PREDICTIONS for GFE purposes only — the provider must confirm before final coding.
- Do NOT include rare diagnoses unless strongly supported by patient history.`;

    return this.aiService.generateStructured<DiagnosisCodePrediction>(prompt);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: AI IDR Eligibility Engine
  // ═══════════════════════════════════════════════════════════════════

  async assessIdrEligibility(
    claim: {
      payerName: string;
      patientState: string;
      billedAmount: number;
      paidAmount: number;
      cptCodes: string[];
      serviceType: string;
      isEmergency: boolean;
      isAirAmbulance: boolean;
      payerType: string; // commercial, medicare, medicaid, tricare, self_funded
    },
  ): Promise<IdrEligibilityResult> {
    this.logger.debug(`Assessing IDR eligibility for claim`);

    const prompt = `You are an NSA compliance specialist who determines whether a claim is eligible for Independent Dispute Resolution (IDR). Analyze the claim details and determine eligibility, jurisdiction, and expected recovery.

Claim Details:
- Payer: ${claim.payerName}
- Payer Type: ${claim.payerType}
- Patient State: ${claim.patientState}
- Billed Amount: $${claim.billedAmount}
- Paid Amount: $${claim.paidAmount}
- CPT Codes: ${claim.cptCodes.join(', ')}
- Service Type: ${claim.serviceType}
- Emergency: ${claim.isEmergency}
- Air Ambulance: ${claim.isAirAmbulance}

Return ONLY a JSON object with this exact shape:
{
  "eligibilityScore": number (0-100),
  "isEligible": boolean,
  "jurisdiction": "federal" | "state_ca" | "state_ny" | "state_tx" | "state_nj" | "state_other",
  "factors": [
    { "factor": "name", "weight": 0.0-1.0, "detail": "explanation" }
  ],
  "expectedRecovery": number (dollar amount),
  "recommendation": "actionable recommendation"
}

Eligibility Rules:
- Federal NSA applies to: commercial insurance and self-funded employer plans (ERISA).
- Federal NSA does NOT apply to: Medicare, Medicaid, TRICARE (they have their own balance billing protections).
- State laws may preempt federal NSA: CA AB 72, NY Surprise Bill Law, TX SB 1264, NJ OON Consumer Protection Act.
- Emergency services and air ambulance are always NSA-protected.
- Non-emergency OON services at in-network facilities are NSA-protected.
- Expected recovery = billed amount - paid amount (capped at realistic IDR outcomes, typically 2-3x QPA).
- Higher eligibility score for: larger variance, emergency services, clear NSA applicability.
- Lower eligibility score for: government payers, state-law preemption, small variance.`;

    return this.aiService.generateStructured<IdrEligibilityResult>(prompt);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: AI Open Negotiation Offer Generator
  // ═══════════════════════════════════════════════════════════════════

  async generateOpenNegotiationOffer(
    idrCase: NsaIdrCase,
    medianInNetworkRates?: Array<{ cptCode: string; medianRate: number }>,
  ): Promise<OpenNegotiationOffer> {
    this.logger.debug(`Generating open negotiation offer for IDR case ${idrCase.id}`);

    const prompt = `You are an NSA IDR negotiation specialist. Generate a data-backed open negotiation offer for this out-of-network claim dispute.

Claim Details:
- Payer: ${idrCase.payerName}
- Billed Amount: $${idrCase.billedAmount}
- QPA (Qualifying Payment Amount): $${idrCase.qpaAmount || 'Unknown'}
- CPT Codes: ${idrCase.cptCodes.join(', ')}
- Jurisdiction: ${idrCase.jurisdiction}

${medianInNetworkRates ? `Median In-Network Rates (from price transparency files):
${medianInNetworkRates.map((r) => `- ${r.cptCode}: $${r.medianRate}`).join('\n')}` : 'No median rate data available.'}

${idrCase.encounterNotes ? `Encounter Notes:\n${idrCase.encounterNotes}` : ''}

Return ONLY a JSON object with this exact shape:
{
  "recommendedOffer": number (the amount to ask for in open negotiation),
  "qpaEstimate": number (estimated QPA if not provided),
  "rationale": "detailed explanation of why this offer is justified",
  "supportingFactors": ["factor 1", "factor 2", ...],
  "counterArguments": ["anticipated payer counter-argument 1", ...]
}

Rules:
- The recommended offer should be between the QPA and the billed amount.
- If median in-network rates are available, use them to justify a higher offer than QPA.
- Consider the complexity of the case, patient acuity, and provider expertise.
- Supporting factors should reference specific data points (median rates, complexity, etc.).
- Anticipate payer counter-arguments and prepare responses.
- The goal is to settle in open negotiation and avoid IDR (which costs time and money).`;

    return this.aiService.generateStructured<OpenNegotiationOffer>(prompt);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: AI State/Federal Jurisdiction Router
  // ═══════════════════════════════════════════════════════════════════

  async routeJurisdiction(
    patientState: string,
    payerType: string,
    serviceType: string,
    isEmergency: boolean,
  ): Promise<{ jurisdiction: IdrEligibilityResult['jurisdiction']; reasoning: string }> {
    this.logger.debug(`Routing jurisdiction for state=${patientState}, payer=${payerType}`);

    const prompt = `You are an NSA compliance expert. Determine whether a claim should be processed under federal NSA or a state-specific surprise billing law.

Patient State: ${patientState}
Payer Type: ${payerType}
Service Type: ${serviceType}
Emergency: ${isEmergency}

Return ONLY a JSON object with this exact shape:
{
  "jurisdiction": "federal" | "state_ca" | "state_ny" | "state_tx" | "state_nj" | "state_other",
  "reasoning": "explanation of why this jurisdiction applies"
}

Jurisdiction Rules:
- CA (AB 72): Applies to commercial plans, prohibits balance billing for OON emergency and non-emergency at in-network facilities. Preempts federal NSA for CA residents.
- NY (Surprise Bill Law): Applies to commercial plans, emergency services, and OON at in-network facilities. Preempts federal NSA for NY residents.
- TX (SB 1264): Applies to commercial PPO/EPO plans, emergency and certain non-emergency services. Preempts federal NSA for TX residents.
- NJ (OON Consumer Protection Act): Applies to commercial plans, emergency and non-emergency OON at in-network facilities. Preempts federal NSA for NJ residents.
- Federal NSA: Default for all other states, and for self-funded ERISA plans in ALL states (state laws cannot regulate self-funded plans under ERISA).
- Medicare/Medicaid/TRICARE: Not eligible for NSA IDR (have their own protections).`;

    return this.aiService.generateStructured<{ jurisdiction: IdrEligibilityResult['jurisdiction']; reasoning: string }>(prompt);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: AI Patient Acuity Letter Generator
  // ═══════════════════════════════════════════════════════════════════

  async generatePatientAcuityLetter(
    encounterNotes: string,
    cptCodes: string[],
    patientInfo: { age?: number; sex?: string; conditions: string[] },
  ): Promise<PatientAcuityLetter> {
    this.logger.debug('Generating patient acuity letter for IDR submission');

    const prompt = `You are a physician writing a Patient Acuity Letter to support an Independent Dispute Resolution (IDR) case under the No Surprises Act. This letter justifies why the provider's charges are appropriate given the patient's clinical complexity.

Patient Info:
- Age: ${patientInfo.age || 'Unknown'}
- Sex: ${patientInfo.sex || 'Unknown'}
- Conditions: ${patientInfo.conditions.join(', ') || 'None'}

CPT Codes: ${cptCodes.join(', ')}

Encounter Notes:
"""${encounterNotes}"""

Return ONLY a JSON object with this exact shape:
{
  "letter": "the full patient acuity letter, professionally formatted",
  "keyPoints": ["key clinical point 1", "key clinical point 2", ...]
}

Rules:
- Write as a formal medical letter addressed to the IDR Entity.
- Emphasize patient acuity, complexity, and any factors that justify higher-than-QPA reimbursement.
- Reference specific clinical findings from the encounter notes.
- Mention comorbidities that increased the complexity of care.
- Explain why the CPT codes billed were medically necessary.
- Keep the tone professional, factual, and evidence-based.
- Do NOT fabricate clinical findings — only use information from the encounter notes and patient info.
- The letter should be 3-5 paragraphs.`;

    return this.aiService.generateStructured<PatientAcuityLetter>(prompt);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P3: AI IDR Win-Probability Model
  // ═══════════════════════════════════════════════════════════════════

  async predictWinProbability(
    idrCase: NsaIdrCase,
    historicalOutcomes?: {
      totalCases: number;
      wonCases: number;
      avgRecovery: number;
      byPayer: Record<string, { won: number; total: number }>;
    },
  ): Promise<WinProbabilityResult> {
    this.logger.debug(`Predicting win probability for IDR case ${idrCase.id}`);

    const prompt = `You are an NSA IDR data analyst. Predict the probability of winning this IDR case and recommend a final offer strategy.

IDR Case Details:
- Payer: ${idrCase.payerName}
- Billed Amount: $${idrCase.billedAmount}
- QPA: $${idrCase.qpaAmount || 'Unknown'}
- CPT Codes: ${idrCase.cptCodes.join(', ')}
- Jurisdiction: ${idrCase.jurisdiction}
- Initial Offer: $${idrCase.initialOffer || 'Not set'}

${historicalOutcomes ? `Historical IDR Outcomes:
- Total Cases: ${historicalOutcomes.totalCases}
- Won Cases: ${historicalOutcomes.wonCases}
- Win Rate: ${(historicalOutcomes.wonCases / historicalOutcomes.totalCases * 100).toFixed(1)}%
- Average Recovery: $${historicalOutcomes.avgRecovery}
- By Payer: ${JSON.stringify(historicalOutcomes.byPayer)}` : 'No historical IDR outcome data available yet.'}

${idrCase.patientAcuityLetter ? `Patient Acuity Letter Available: Yes` : 'Patient Acuity Letter Available: No'}

Return ONLY a JSON object with this exact shape:
{
  "winProbability": number (0-100),
  "factors": [
    { "factor": "name", "impact": "positive" | "negative" | "neutral", "detail": "explanation" }
  ],
  "recommendedFinalOffer": number (the optimal final offer to submit to IDR entity),
  "strategy": "recommended strategy for this case"
}

Rules:
- Win probability should consider: strength of acuity letter, variance from QPA, historical outcomes, payer behavior.
- Higher win probability when: patient acuity is high, billed amount is justified by complexity, historical win rate is high.
- Lower win probability when: billed amount is far above median in-network rates, no acuity letter, payer has strong historical defense.
- The recommended final offer should balance: maximizing recovery vs. risk of losing at IDR.
- IDR entities typically select the offer closest to the QPA unless compelling evidence justifies a higher amount.
- If no historical data, use industry benchmarks (providers win ~60-70% of IDR cases).`;

    return this.aiService.generateStructured<WinProbabilityResult>(prompt);
  }
}
