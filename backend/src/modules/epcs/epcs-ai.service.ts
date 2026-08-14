import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { PdmpQuery } from './entities/pdmp-query.entity';
import { ControlledSubstanceRulesEngine, ControlledSubstanceInfo } from './controlled-substance-rules.engine';

// ─────────────────────────────────────────────────────────────────────────────
// AI Response Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OpioidRiskScore {
  patientId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  contributingFactors: string[];
  recommendedActions: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
  modelVersion: string;
  generatedAt: string;
}

export interface DiversionCheckResult {
  patientId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  redFlags: DiversionFlag[];
  recommendation: string;
  shouldBlock: boolean;
}

export interface DiversionFlag {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
}

export interface AlternativeTherapy {
  alternatives: AlternativeTherapyOption[];
  reasoning: string;
}

export interface AlternativeTherapyOption {
  medication: string;
  class: string;
  rationale: string;
  evidenceLevel: 'A' | 'B' | 'C';
  typicalDose: string;
  advantages: string[];
  precautions: string[];
}

export interface PdmpSummary {
  summary: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  keyFindings: string[];
  recommendations: string[];
  redFlags: string[];
}

export interface BehavioralNudge {
  nudgeType: 'peer_comparison' | 'default_bias' | 'social_proof' | 'loss_aversion' | 'commitment_device';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  alternativeSuggestions: string[];
  actionable: boolean;
}

export interface QuantityOptimization {
  withinGuidelines: boolean;
  recommendedQuantity: number | null;
  recommendedDuration: string | null;
  currentQuantity: number;
  percentOver: number | null;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  cdcGuideline: string;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  totalProvidersChecked: number;
  anomalyCount: number;
}

export interface Anomaly {
  providerId: string;
  providerName: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// EPCS AI Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class EpcsAiService {
  private readonly logger = new Logger(EpcsAiService.name);
  private readonly modelVersion = 'neuraline-epcs-ai-v1';

  constructor(
    private readonly aiService: AiService,
    private readonly rulesEngine: ControlledSubstanceRulesEngine,
    @InjectRepository(Prescription) private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(PdmpQuery) private readonly pdmpRepo: Repository<PdmpQuery>,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. OPIOID RISK SCORE — ML-based patient risk prediction
  // ═══════════════════════════════════════════════════════════════════════════

  async scoreOpioidRisk(
    tenantId: string,
    patientId: string,
    patientName: string,
    proposedMedication: string,
    patientContext?: {
      age?: number;
      diagnoses?: string[];
      priorOpioidRx?: number;
      benzoCoPrescribed?: boolean;
      mentalHealthHistory?: string[];
      substanceUseHistory?: string[];
    },
  ): Promise<OpioidRiskScore> {
    // ── Rule-based risk factors (always computed) ──────────────────────────
    const factors: string[] = [];
    const actions: string[] = [];
    let riskScore = 0;

    const csInfo = this.rulesEngine.findControlledSubstance(proposedMedication);
    const isOpioid = csInfo?.isOpioid ?? false;

    if (isOpioid) {
      riskScore += 20;
      factors.push('Proposed medication is an opioid');
    }

    if (patientContext?.priorOpioidRx) {
      if (patientContext.priorOpioidRx >= 3) {
        riskScore += 25;
        factors.push(`${patientContext.priorOpioidRx} prior opioid prescriptions in history`);
      } else if (patientContext.priorOpioidRx >= 1) {
        riskScore += 10;
        factors.push(`${patientContext.priorOpioidRx} prior opioid prescription(s)`);
      }
    }

    if (patientContext?.benzoCoPrescribed) {
      riskScore += 20;
      factors.push('Benzodiazepine co-prescribed — overdose risk increased 4x');
      actions.push('Avoid co-prescribing benzodiazepines with opioids if possible');
    }

    if (patientContext?.mentalHealthHistory?.length) {
      riskScore += 10;
      factors.push(`Mental health history: ${patientContext.mentalHealthHistory.join(', ')}`);
    }

    if (patientContext?.substanceUseHistory?.length) {
      riskScore += 25;
      factors.push(`Substance use history: ${patientContext.substanceUseHistory.join(', ')}`);
      actions.push('Consider addiction medicine consultation');
    }

    if (patientContext?.age && patientContext.age > 65) {
      riskScore += 10;
      factors.push(`Age ${patientContext.age} — increased sensitivity to opioids`);
      actions.push('Consider reduced initial dose for elderly patient');
    }

    // ── AI-enhanced analysis (if available) ─────────────────────────────────
    try {
      const prompt = `You are a clinical AI assistant specializing in opioid risk assessment.
Analyze this patient for opioid overdose/misuse risk and respond in JSON format.

Patient: ${patientName} (age: ${patientContext?.age || 'unknown'})
Proposed medication: ${proposedMedication}
Prior opioid prescriptions: ${patientContext?.priorOpioidRx || 0}
Benzodiazepine co-prescribed: ${patientContext?.benzoCoPrescribed ? 'Yes' : 'No'}
Diagnoses: ${patientContext?.diagnoses?.join(', ') || 'none'}
Mental health history: ${patientContext?.mentalHealthHistory?.join(', ') || 'none'}
Substance use history: ${patientContext?.substanceUseHistory?.join(', ') || 'none'}

Respond with JSON:
{
  "additionalRiskScore": <0-30>,
  "additionalFactors": ["factor1", "factor2"],
  "recommendedActions": ["action1", "action2"],
  "confidenceLevel": "low" | "medium" | "high"
}`;

      const response = await this.aiService.generate(prompt, {
        temperature: 0.3,
        maxTokens: 500,
      });

      const parsed = this.safeParseJson(response);
      if (parsed) {
        const additionalScore = Number(parsed.additionalRiskScore) || 0;
        riskScore += additionalScore;
        const addFactors = Array.isArray(parsed.additionalFactors) ? parsed.additionalFactors as string[] : [];
        if (addFactors.length) factors.push(...addFactors);
        const addActions = Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions as string[] : [];
        if (addActions.length) actions.push(...addActions);
      }
    } catch (err) {
      this.logger.warn(`AI opioid risk scoring failed, using rule-based only: ${err}`);
    }

    riskScore = Math.min(100, Math.max(0, riskScore));

    const riskLevel = this.scoreToLevel(riskScore);

    if (riskLevel === 'high' || riskLevel === 'critical') {
      actions.push('Co-prescribe naloxone');
      actions.push('Consider non-opioid alternatives');
      actions.push('Document risk-benefit assessment in chart');
    }
    if (riskLevel === 'critical') {
      actions.push('Refer to pain management specialist');
      actions.push('Consider PDMP review before prescribing');
    }

    return {
      patientId,
      riskScore,
      riskLevel,
      contributingFactors: factors,
      recommendedActions: actions,
      confidenceLevel: riskScore > 50 ? 'medium' : 'high',
      modelVersion: this.modelVersion,
      generatedAt: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. DIVERSION DETECTION — Analyze PDMP data for suspicious patterns
  // ═══════════════════════════════════════════════════════════════════════════

  async detectDiversion(
    tenantId: string,
    patientId: string,
    patientName: string,
    pdmpData?: PdmpQuery | null,
  ): Promise<DiversionCheckResult> {
    const flags: DiversionFlag[] = [];
    let riskScore = 0;

    // Use PDMP data if available, otherwise check prescription history
    let prescriberCount = pdmpData?.prescriberCount || 0;
    let pharmacyCount = pdmpData?.pharmacyCount || 0;
    let earlyRefills = pdmpData?.earlyRefillCount || 0;
    let totalMme = Number(pdmpData?.totalMme) || 0;
    let csRxCount = pdmpData?.csPrescriptionCount || 0;

    // If no PDMP data, check our own prescription history
    if (!pdmpData) {
      const patientRx = await this.prescriptionRepo.find({
        where: { tenantId, patientId, isControlledSubstance: true },
      });
      csRxCount = patientRx.length;
      const providerIds = new Set(patientRx.map((r) => r.providerId));
      prescriberCount = providerIds.size;
    }

    // ── Doctor shopping: ≥4 prescribers in 12 months ────────────────────────
    if (prescriberCount >= 4) {
      flags.push({
        type: 'doctor_shopping',
        description: `${prescriberCount} different prescribers in prescription history`,
        severity: 'critical',
        detail: `Patient has received controlled substances from ${prescriberCount} different prescribers. Threshold for concern: ≥4.`,
      });
      riskScore += 30;
    } else if (prescriberCount >= 3) {
      flags.push({
        type: 'multiple_prescribers',
        description: `${prescriberCount} different prescribers`,
        severity: 'medium',
        detail: `Multiple prescribers detected — verify care coordination.`,
      });
      riskScore += 15;
    }

    // ── Multiple pharmacies: ≥3 in 12 months ────────────────────────────────
    if (pharmacyCount >= 3) {
      flags.push({
        type: 'pharmacy_shopping',
        description: `${pharmacyCount} different pharmacies used`,
        severity: 'high',
        detail: `Patient has used ${pharmacyCount} different pharmacies for controlled substances.`,
      });
      riskScore += 20;
    }

    // ── Early refills: >2 in 12 months ──────────────────────────────────────
    if (earlyRefills >= 3) {
      flags.push({
        type: 'early_refills',
        description: `${earlyRefills} early refills detected`,
        severity: 'high',
        detail: `Pattern of early refill requests may indicate misuse or diversion.`,
      });
      riskScore += 20;
    } else if (earlyRefills >= 1) {
      flags.push({
        type: 'early_refill',
        description: `${earlyRefills} early refill(s) detected`,
        severity: 'low',
        detail: `Monitor for pattern of early refills.`,
      });
      riskScore += 5;
    }

    // ── High MME ────────────────────────────────────────────────────────────
    if (totalMme >= 90) {
      flags.push({
        type: 'high_mme',
        description: `Total MME ${totalMme}/day exceeds CDC high-risk threshold`,
        severity: 'critical',
        detail: `Cumulative MME across all prescribers is ${totalMme} mg/day. CDC high-risk threshold: 90 mg/day.`,
      });
      riskScore += 25;
    } else if (totalMme >= 50) {
      flags.push({
        type: 'elevated_mme',
        description: `Total MME ${totalMme}/day above CDC caution threshold`,
        severity: 'medium',
        detail: `Cumulative MME is ${totalMme} mg/day. CDC caution threshold: 50 mg/day.`,
      });
      riskScore += 10;
    }

    // ── High volume of CS prescriptions ─────────────────────────────────────
    if (csRxCount >= 10) {
      flags.push({
        type: 'high_volume',
        description: `${csRxCount} controlled substance prescriptions in history`,
        severity: 'medium',
        detail: `High volume of controlled substance prescriptions — review for medical necessity.`,
      });
      riskScore += 10;
    }

    riskScore = Math.min(100, riskScore);
    const riskLevel = this.scoreToLevel(riskScore);

    let recommendation = 'No significant diversion indicators detected.';
    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendation = 'HIGH RISK: Recommend detailed PDMP review, patient counseling, and consider pain management referral before prescribing.';
    } else if (riskLevel === 'moderate') {
      recommendation = 'MODERATE RISK: Verify medical necessity, document review, and monitor closely.';
    }

    return {
      patientId,
      riskScore,
      riskLevel,
      redFlags: flags,
      recommendation,
      shouldBlock: riskLevel === 'critical',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ALTERNATIVE THERAPY RECOMMENDER
  // ═══════════════════════════════════════════════════════════════════════════

  async recommendAlternatives(
    proposedMedication: string,
    diagnosis?: string,
    patientContext?: {
      allergies?: string[];
      renalImpairment?: boolean;
      hepaticImpairment?: boolean;
      age?: number;
      priorMedications?: string[];
    },
  ): Promise<AlternativeTherapy> {
    const csInfo = this.rulesEngine.findControlledSubstance(proposedMedication);
    const isOpioid = csInfo?.isOpioid ?? false;

    if (!isOpioid) {
      return {
        alternatives: [],
        reasoning: 'Proposed medication is not an opioid — alternative therapy recommendations focus on opioid alternatives.',
      };
    }

    // ── Rule-based alternatives (always available) ──────────────────────────
    const ruleBasedAlternatives: AlternativeTherapyOption[] = [];

    // SNRI — dual benefit if depression
    if (!patientContext?.allergies?.some((a) => a.toLowerCase().includes('duloxetine'))) {
      ruleBasedAlternatives.push({
        medication: 'Duloxetine (Cymbalta)',
        class: 'SNRI',
        rationale: 'FDA-approved for chronic musculoskeletal pain and neuropathic pain. Dual benefit if comorbid depression.',
        evidenceLevel: 'A',
        typicalDose: '30mg daily, titrate to 60mg daily',
        advantages: ['Once daily dosing', 'Covers neuropathic and musculoskeletal pain', 'Dual benefit for depression'],
        precautions: ['Avoid in severe hepatic impairment', 'May increase blood pressure', 'Nausea common initially'],
      });
    }

    // Gabapentinoid — neuropathic pain
    if (!patientContext?.renalImpairment) {
      ruleBasedAlternatives.push({
        medication: 'Gabapentin (Neurontin)',
        class: 'Gabapentinoid',
        rationale: 'First-line for neuropathic pain. Lower abuse potential than opioids.',
        evidenceLevel: 'A',
        typicalDose: '300mg TID, titrate to max 3600mg/day',
        advantages: ['Low abuse potential', 'Effective for neuropathic pain', 'Generally well-tolerated'],
        precautions: ['Renal dose adjustment required', 'Sedation/dizziness common', 'Do not stop abruptly'],
      });
    }

    // NSAIDs — inflammatory pain
    if (!patientContext?.allergies?.some((a) => a.toLowerCase().includes('nsaid'))) {
      ruleBasedAlternatives.push({
        medication: 'Ibuprofen (Motrin) or Meloxicam (Mobic)',
        class: 'NSAID',
        rationale: 'First-line for acute inflammatory pain. No abuse potential.',
        evidenceLevel: 'A',
        typicalDose: 'Ibuprofen 600mg Q6H or Meloxicam 7.5-15mg daily',
        advantages: ['No abuse potential', 'Effective for inflammatory pain', 'OTC availability (ibuprofen)'],
        precautions: ['GI bleeding risk', 'Renal effects', 'Cardiovascular risk with long-term use'],
      });
    }

    // Topical agents
    ruleBasedAlternatives.push({
      medication: 'Lidocaine 5% patch (Lidoderm)',
      class: 'Topical anesthetic',
      rationale: 'Localized pain relief with minimal systemic effects. No abuse potential.',
      evidenceLevel: 'B',
      typicalDose: 'Apply 1-3 patches for 12 hours on, 12 hours off',
      advantages: ['Minimal systemic absorption', 'No abuse potential', 'Can be used with other agents'],
      precautions: ['Local skin reactions', 'Not for broken skin', 'Max 3 patches simultaneously'],
    });

    // Non-pharmacological
    ruleBasedAlternatives.push({
      medication: 'Physical Therapy / CBT',
      class: 'Non-pharmacological',
      rationale: 'Superior long-term outcomes for chronic pain vs. opioids. Addresses underlying biomechanical and psychological factors.',
      evidenceLevel: 'A',
      typicalDose: 'PT 2x/week for 6-8 weeks; CBT weekly for 8-12 weeks',
      advantages: ['No side effects', 'Addresses root cause', 'Superior long-term outcomes', 'No abuse potential'],
      precautions: ['Requires patient commitment', 'Time-intensive', 'May not be covered by all insurance'],
    });

    // ── AI-enhanced reasoning ───────────────────────────────────────────────
    let reasoning = `Proposed medication ${proposedMedication} is an opioid (Schedule ${csInfo?.schedule}). `;
    reasoning += `Based on the patient${patientContext ? `'s profile` : ''}, the following alternatives are recommended. `;

    try {
      const prompt = `You are a clinical AI assistant. A provider is considering prescribing ${proposedMedication}
for a patient with diagnosis: ${diagnosis || 'not specified'}.
Patient context: age ${patientContext?.age || 'unknown'}, allergies: ${patientContext?.allergies?.join(', ') || 'none'},
renal impairment: ${patientContext?.renalImpairment ? 'yes' : 'no'},
prior medications: ${patientContext?.priorMedications?.join(', ') || 'none'}.

In 2-3 sentences, explain why non-opioid alternatives should be considered first for this patient.
Focus on clinical reasoning, not general statements.`;

      const response = await this.aiService.generate(prompt, {
        temperature: 0.4,
        maxTokens: 200,
      });
      if (response) reasoning = response.trim();
    } catch (err) {
      this.logger.warn(`AI alternative therapy reasoning failed: ${err}`);
    }

    return {
      alternatives: ruleBasedAlternatives,
      reasoning,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PDMP SUMMARY — AI-generated plain-language summary of PDMP data
  // ═══════════════════════════════════════════════════════════════════════════

  async generatePdmpSummary(
    tenantId: string,
    patientId: string,
    patientName: string,
    pdmpData: PdmpQuery,
  ): Promise<PdmpSummary> {
    const keyFindings: string[] = [];
    const recommendations: string[] = [];
    const redFlags: string[] = [];

    // ── Rule-based analysis ─────────────────────────────────────────────────
    keyFindings.push(`${pdmpData.csPrescriptionCount} controlled substance prescription(s) in history`);
    keyFindings.push(`${pdmpData.prescriberCount} unique prescriber(s)`);
    keyFindings.push(`${pdmpData.pharmacyCount} unique pharmacies used`);
    keyFindings.push(`Total MME: ${pdmpData.totalMme} mg/day`);
    keyFindings.push(`${pdmpData.earlyRefillCount} early refill(s) detected`);

    if (pdmpData.prescriberCount >= 4) {
      redFlags.push(`Multiple prescribers (${pdmpData.prescriberCount}) — possible doctor shopping`);
    }
    if (pdmpData.pharmacyCount >= 3) {
      redFlags.push(`Multiple pharmacies (${pdmpData.pharmacyCount}) — possible pharmacy shopping`);
    }
    if (Number(pdmpData.totalMme) >= 90) {
      redFlags.push(`MME ${pdmpData.totalMme}/day exceeds CDC high-risk threshold of 90`);
    } else if (Number(pdmpData.totalMme) >= 50) {
      redFlags.push(`MME ${pdmpData.totalMme}/day above CDC caution threshold of 50`);
    }
    if (pdmpData.earlyRefillCount >= 3) {
      redFlags.push(`${pdmpData.earlyRefillCount} early refills — pattern of potential misuse`);
    }

    const riskLevel = pdmpData.riskLevel as 'low' | 'moderate' | 'high' | 'critical';

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Co-prescribe naloxone');
      recommendations.push('Consider pain management referral');
      recommendations.push('Document risk-benefit assessment');
      recommendations.push('Consider treatment agreement / informed consent');
    } else if (riskLevel === 'moderate') {
      recommendations.push('Monitor closely');
      recommendations.push('Verify medical necessity');
      recommendations.push('Consider PDMP follow-up at next visit');
    } else {
      recommendations.push('Continue standard monitoring');
    }

    // ── AI-generated summary ────────────────────────────────────────────────
    let summary = `Patient ${patientName} has ${pdmpData.csPrescriptionCount} controlled substance prescription(s) from ${pdmpData.prescriberCount} prescriber(s) at ${pdmpData.pharmacyCount} pharmacies. Total MME: ${pdmpData.totalMme}/day. ${pdmpData.earlyRefillCount} early refill(s) detected. Risk level: ${riskLevel}.`;

    try {
      const prompt = `You are a clinical AI assistant. Summarize this PDMP data for a prescriber in 2-3 sentences of plain clinical language.

Patient: ${patientName}
Controlled substance prescriptions: ${pdmpData.csPrescriptionCount}
Unique prescribers: ${pdmpData.prescriberCount}
Unique pharmacies: ${pdmpData.pharmacyCount}
Total MME/day: ${pdmpData.totalMme}
Early refills: ${pdmpData.earlyRefillCount}
Risk level: ${riskLevel}

Write a concise, actionable summary. Start with the risk level. Mention specific red flags if any.`;

      const response = await this.aiService.generate(prompt, {
        temperature: 0.3,
        maxTokens: 200,
      });
      if (response) summary = response.trim();
    } catch (err) {
      this.logger.warn(`AI PDMP summary failed: ${err}`);
    }

    return {
      summary,
      riskLevel,
      keyFindings,
      recommendations,
      redFlags,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. BEHAVIORAL NUDGES — Just-in-time behavioral economics interventions
  // ═══════════════════════════════════════════════════════════════════════════

  async generateNudge(
    tenantId: string,
    providerId: string,
    providerName: string,
    proposedMedication: string,
    patientRiskScore?: OpioidRiskScore | null,
  ): Promise<BehavioralNudge> {
    const csInfo = this.rulesEngine.findControlledSubstance(proposedMedication);
    const isOpioid = csInfo?.isOpioid ?? false;

    if (!isOpioid) {
      return {
        nudgeType: 'default_bias',
        message: '',
        severity: 'info',
        alternativeSuggestions: [],
        actionable: false,
      };
    }

    // ── Loss aversion nudge for high-risk patients ──────────────────────────
    if (patientRiskScore && (patientRiskScore.riskLevel === 'high' || patientRiskScore.riskLevel === 'critical')) {
      const riskMultiplier = patientRiskScore.riskLevel === 'critical' ? '8x' : '4x';
      return {
        nudgeType: 'loss_aversion',
        message: `This patient's opioid overdose risk is ${patientRiskScore.riskScore}/100 (${patientRiskScore.riskLevel}). Prescribing this opioid increases their mortality risk by ${riskMultiplier}.`,
        severity: patientRiskScore.riskLevel === 'critical' ? 'critical' : 'warning',
        alternativeSuggestions: [
          'Duloxetine 30mg daily (SNRI — dual pain + mood benefit)',
          'Gabapentin 300mg TID (neuropathic pain)',
          'Lidocaine 5% patch (localized pain)',
          'Physical therapy referral',
        ],
        actionable: true,
      };
    }

    // ── Default bias nudge ──────────────────────────────────────────────────
    return {
      nudgeType: 'default_bias',
      message: 'Non-opioid therapies are recommended as first-line treatment for most acute and chronic pain conditions. Consider trying non-opioid alternatives first.',
      severity: 'info',
      alternativeSuggestions: [
        'Ibuprofen 600mg Q6H (acute inflammatory pain)',
        'Duloxetine 30mg daily (chronic musculoskeletal pain)',
        'Physical therapy (superior long-term outcomes)',
      ],
      actionable: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. QUANTITY OPTIMIZER — CDC guideline-based quantity/duration check
  // ═══════════════════════════════════════════════════════════════════════════

  optimizeQuantity(
    medicationName: string,
    quantity: number,
    daysSupply: number | null,
    isAcutePain: boolean,
  ): QuantityOptimization {
    const result = this.rulesEngine.checkQuantity(medicationName, quantity, daysSupply, isAcutePain);

    const percentOver = result.recommendedQuantity
      ? Math.round(((quantity - result.recommendedQuantity) / result.recommendedQuantity) * 100)
      : null;

    return {
      withinGuidelines: result.withinGuidelines,
      recommendedQuantity: result.recommendedQuantity,
      recommendedDuration: result.recommendedDuration,
      currentQuantity: quantity,
      percentOver,
      message: result.message,
      severity: result.severity,
      cdcGuideline: result.cdcGuideline,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ANOMALY DETECTION — Scan all providers for suspicious prescribing
  // ═══════════════════════════════════════════════════════════════════════════

  async detectAnomalies(tenantId: string): Promise<AnomalyDetectionResult> {
    const anomalies: Anomaly[] = [];

    // Get all CS prescriptions for this tenant
    const csPrescriptions = await this.prescriptionRepo.find({
      where: { tenantId, isControlledSubstance: true },
    });

    // Group by provider
    const byProvider: Record<string, Prescription[]> = {};
    for (const rx of csPrescriptions) {
      if (!byProvider[rx.providerId]) byProvider[rx.providerId] = [];
      byProvider[rx.providerId].push(rx);
    }

    const providerIds = Object.keys(byProvider);
    const totalProviders = providerIds.length;

    if (totalProviders === 0) {
      return { anomalies: [], totalProvidersChecked: 0, anomalyCount: 0 };
    }

    // Calculate peer average
    const avgCsPrescriptions = csPrescriptions.length / totalProviders;

    for (const providerId of providerIds) {
      const providerRx = byProvider[providerId];
      const providerName = providerRx[0]?.providerName || providerId;
      const count = providerRx.length;

      // ── Prescribing at 3x peer rate ──────────────────────────────────────
      if (count > avgCsPrescriptions * 3 && count >= 5) {
        anomalies.push({
          providerId,
          providerName,
          type: 'high_volume_prescribing',
          description: `${providerName} has prescribed ${count} controlled substances — ${Math.round((count / avgCsPrescriptions) * 100)}% of peer average (${avgCsPrescriptions.toFixed(1)}).`,
          severity: 'high',
          data: { count, peerAverage: avgCsPrescriptions, ratio: count / avgCsPrescriptions },
        });
      }

      // ── After-hours prescribing (if we had timestamps — check createdAt) ──
      for (const rx of providerRx) {
        const hour = new Date(rx.createdAt).getHours();
        if (hour < 6 || hour > 22) {
          // Flag if >30% of prescriptions are after hours
          const afterHoursCount = providerRx.filter(
            (r) => new Date(r.createdAt).getHours() < 6 || new Date(r.createdAt).getHours() > 22,
          ).length;
          if (afterHoursCount / count > 0.3 && count >= 5) {
            anomalies.push({
              providerId,
              providerName,
              type: 'after_hours_prescribing',
              description: `${providerName} has ${afterHoursCount} of ${count} (${Math.round((afterHoursCount / count) * 100)}%) controlled substance prescriptions issued outside business hours (10PM-6AM).`,
              severity: 'medium',
              data: { afterHoursCount, totalCount: count, percentage: afterHoursCount / count },
            });
            break; // One flag per provider
          }
        }
      }
    }

    return {
      anomalies,
      totalProvidersChecked: totalProviders,
      anomalyCount: anomalies.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private scoreToLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (score >= 70) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'moderate';
    return 'low';
  }

  private safeParseJson(text: string): Record<string, unknown> | null {
    try {
      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
