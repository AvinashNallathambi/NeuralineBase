import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PatientsService } from '../patients/patients.service';
import { PatientMedicationsService } from '../medications/patient-medications.service';
import { LaboratoryService } from '../laboratory/laboratory.service';
import { EncounterService } from '../clinical/encounter.service';
import { AiService } from '../ai/ai.service';
import { ControlledSubstanceRulesEngine } from '../epcs/controlled-substance-rules.engine';
import { ImmunizationsService } from '../immunizations/immunizations.service';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'moderate' | 'high';
  modifiable: boolean;
  domain: 'clinical' | 'medication' | 'social' | 'behavioral';
  detail?: string;
}

export interface ClinicalRiskScore {
  name: string;
  score: number;
  maxScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  description: string;
  recommendation: string;
  components?: { label: string; points: number }[];
  applicable: boolean;
}

export interface MedicationRiskItem {
  category: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  description: string;
  medications?: string[];
  recommendation: string;
  detail?: any;
}

export interface CareGap {
  gap: string;
  category: string;
  severity: 'low' | 'moderate' | 'high';
  recommendation: string;
  guideline?: string;
  dueDate?: string;
}

export interface QualityMeasure {
  measure: string;
  status: 'met' | 'not_met' | 'overdue';
  lastValue?: string;
  targetValue?: string;
}

export interface RiskManagementProfile {
  patientId: string;
  patientName: string;
  patientAge: number | null;
  patientSex: string | null;
  generatedAt: string;

  // AI Risk Dashboard
  compositeRisk: {
    riskLevel: string;
    riskScore: number;
    riskFactors: RiskFactor[];
    predictedRisks: { outcome: string; probability: string; timeframe: string }[];
    recommendations: { action: string; priority: string; rationale: string }[];
    careManagementEnrollment: boolean;
    summary: string;
  } | null;

  // Clinical Risk Scores
  clinicalScores: ClinicalRiskScore[];

  // Medication Risk
  medicationRisk: {
    items: MedicationRiskItem[];
    opioidMme: number | null;
    opioidRiskLevel: string | null;
    polypharmacyCount: number;
    highRiskMedications: string[];
  };

  // Care Gaps
  careGaps: CareGap[];
  qualityMeasures: QualityMeasure[];
  careGapSummary: string | null;

  // Patient data used for calculations
  dataSummary: {
    conditionCount: number;
    medicationCount: number;
    allergyCount: number;
    activeProblems: string[];
    recentVitals: { metric: string; value: string }[];
    recentLabs: { test: string; value: string; unit?: string; date?: string }[];
  };
}

// ── Beers Criteria High-Risk Medications (2023 AGS Update) ─────────────────────

const BEERS_CRITERIA_MEDS: { patterns: string[]; category: string; concern: string }[] = [
  { patterns: ['diphenhydramine', 'benadryl', 'hydroxyzine', 'promethazine'], category: 'Anticholinergics (1st-gen antihistamines)', concern: 'Confusion, dry mouth, constipation, fall risk' },
  { patterns: ['amitriptyline', 'doxepin', 'nortriptyline'], category: 'TCAs', concern: 'Anticholinergic, sedation, orthostatic hypotension' },
  { patterns: ['lorazepam', 'diazepam', 'alprazolam', 'clonazepam', 'temazepam', 'zolpidem', 'eszopiclone'], category: 'Benzodiazepines & Z-drugs', concern: 'Fall risk, delirium, cognitive impairment' },
  { patterns: ['glyburide', 'chlorpropamide'], category: 'Long-acting sulfonylureas', concern: 'Prolonged hypoglycemia' },
  { patterns: ['naproxen', 'ibuprofen', 'ketorolac', 'indomethacin', 'piroxicam'], category: 'NSAIDs (chronic)', concern: 'GI bleeding, renal impairment, HF exacerbation' },
  { patterns: ['megestrol', 'megace'], category: 'Megestrol', concern: 'Thrombosis, fluid retention' },
  { patterns: ['clonidine', 'methyldopa', 'reserpine'], category: 'Central alpha agonists', concern: 'CNS depression, orthostatic hypotension' },
  { patterns: ['digoxin'], category: 'Digoxin (>0.125mg)', concern: 'Toxicity risk increases with age' },
  { patterns: ['amiodarone'], category: 'Amiodarone', concern: 'QT prolongation, thyroid/pulmonary toxicity' },
  { patterns: ['oxybutynin', 'tolterodine', 'solifenacin', 'fesoterodine'], category: 'Antimuscarinics (overactive bladder)', concern: 'Anticholinergic effects, confusion' },
  { patterns: ['trazodone', 'mirtazapine'], category: 'Sedating antidepressants', concern: 'Orthostatic hypotension, fall risk' },
  { patterns: ['quetiapine', 'risperidone', 'olanzapine', 'haloperidol'], category: 'Antipsychotics', concern: 'Stroke risk in dementia, mortality, fall risk' },
];

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class RiskManagementService {
  private readonly logger = new Logger(RiskManagementService.name);

  constructor(
    private readonly patientsService: PatientsService,
    private readonly patientMedicationsService: PatientMedicationsService,
    private readonly laboratoryService: LaboratoryService,
    private readonly encounterService: EncounterService,
    private readonly aiService: AiService,
    private readonly csRulesEngine: ControlledSubstanceRulesEngine,
    private readonly immunizationsService: ImmunizationsService,
  ) {}

  async getRiskProfile(tenantId: string, patientId: string): Promise<RiskManagementProfile> {
    // 1. Fetch patient
    const patient = await this.patientsService.findOne(tenantId, patientId);
    if (!patient) throw new NotFoundException('Patient not found');

    const patientName = `${patient.firstName} ${patient.lastName}`;
    const patientAge = this.calculateAge(patient.dateOfBirth);
    const patientSex = patient.gender || null;

    // 2. Fetch problems, allergies, social history in parallel
    const [problems, allergies, socialHistory, medications, encounters, labOrders, immunizations] = await Promise.all([
      this.patientsService.findProblems(tenantId, patientId, {}).catch(() => []),
      this.patientsService.findAllergies(tenantId, patientId).catch(() => []),
      this.patientsService.findSocialHistory(tenantId, patientId).catch(() => []),
      this.patientMedicationsService.findByPatient(tenantId, patientId).catch(() => []),
      this.encounterService.findByPatient(patientId, tenantId).catch(() => []),
      this.laboratoryService.findAllOrders(tenantId, { patientId, page: 1, limit: 20 }).catch(() => ({ data: [], total: 0 })),
      this.immunizationsService.getForAiCareGap(tenantId, patientId).catch(() => []),
    ]);

    // 3. Extract active conditions
    const activeProblems = (problems as any[])
      .filter((p) => p.clinicalStatus === 'active' || p.clinicalStatus === 'active' || !p.clinicalStatus)
      .map((p) => ({ condition: p.description || p.code || 'Unknown', code: p.code, icd10Code: p.code }));

    // 4. Extract active medications
    const activeMeds = (medications as any[])
      .filter((m) => m.status === 'active' || !m.status)
      .map((m) => ({ name: m.medicationName, dosage: m.dosage, frequency: m.frequency }));

    // 5. Extract recent vitals from encounters
    const recentVitals = this.extractRecentVitals(encounters as any[]);

    // 6. Extract recent labs
    const recentLabs = this.extractRecentLabs((labOrders as any).data || []);

    // 7. Calculate clinical risk scores
    const clinicalScores = this.calculateClinicalScores(
      patientAge,
      patientSex,
      activeProblems.map((p) => p.condition),
      activeMeds.map((m) => m.name),
      recentVitals,
      recentLabs,
    );

    // 8. Calculate medication risk
    const medicationRisk = this.calculateMedicationRisk(
      activeMeds.map((m) => m.name),
      patientAge,
    );

    // 9. Call AI for risk stratification + care gap detection in parallel
    const [compositeRisk, careGapResult] = await Promise.all([
      this.callAiRiskStratification(patientName, patientAge, patientSex, activeProblems, activeMeds, recentVitals, recentLabs),
      this.callAiCareGapDetection(patientAge, patientSex, activeProblems, activeMeds, recentLabs, encounters as any[], immunizations),
    ]);

    return {
      patientId,
      patientName,
      patientAge,
      patientSex,
      generatedAt: new Date().toISOString(),
      compositeRisk,
      clinicalScores,
      medicationRisk,
      careGaps: careGapResult?.careGaps || [],
      qualityMeasures: careGapResult?.qualityMeasures || [],
      careGapSummary: careGapResult?.summary || null,
      dataSummary: {
        conditionCount: activeProblems.length,
        medicationCount: activeMeds.length,
        allergyCount: (allergies as any[]).filter((a) => a.clinicalStatus === 'active' || !a.clinicalStatus).length,
        activeProblems: activeProblems.map((p) => p.condition),
        recentVitals,
        recentLabs,
      },
    };
  }

  // ── Clinical Risk Score Calculators ──────────────────────────────────────────

  private calculateClinicalScores(
    age: number | null,
    sex: string | null,
    conditions: string[],
    medications: string[],
    vitals: { metric: string; value: string }[],
    labs: { test: string; value: string; unit?: string }[],
  ): ClinicalRiskScore[] {
    const scores: ClinicalRiskScore[] = [];
    const conditionsLower = conditions.map((c) => c.toLowerCase());
    const medsLower = medications.map((m) => m.toLowerCase());

    // CHA₂DS₂-VASc (stroke risk for AFib)
    scores.push(this.calculateCha2ds2Vasc(age, sex, conditionsLower, medsLower));

    // HAS-BLED (bleeding risk for anticoagulation)
    scores.push(this.calculateHasBled(age, conditionsLower, medsLower, vitals, labs));

    // Morse Fall Risk (simplified)
    scores.push(this.calculateMorseFallRisk(age, conditionsLower, medsLower, vitals));

    // qSOFA (sepsis risk)
    scores.push(this.calculateQsofa(vitals));

    // Polypharmacy Risk
    scores.push(this.calculatePolypharmacyRisk(medications.length, age));

    // Beers Criteria (for elderly)
    scores.push(this.calculateBeersCriteriaRisk(medsLower, age));

    // Frailty Risk (FRAIL scale proxy)
    scores.push(this.calculateFrailtyRisk(age, conditionsLower, vitals));

    // Malnutrition Risk
    scores.push(this.calculateMalnutritionRisk(age, conditionsLower, vitals, labs));

    return scores.filter((s) => s.applicable);
  }

  /** CHA₂DS₂-VASc — Stroke risk in atrial fibrillation */
  private calculateCha2ds2Vasc(
    age: number | null,
    sex: string | null,
    conditionsLower: string[],
    medsLower: string[],
  ): ClinicalRiskScore {
    const hasAFib = conditionsLower.some((c) => c.includes('atrial fibrillation') || c.includes('a-fib') || c.includes('afib'));
    const hasCHF = conditionsLower.some((c) => c.includes('heart failure') || c.includes('chf') || c.includes('cardiomyopathy'));
    const hasHTN = conditionsLower.some((c) => c.includes('hypertension') || c.includes('htn'));
    const hasDM = conditionsLower.some((c) => c.includes('diabetes') || c.includes('diabetic'));
    const hasStroke = conditionsLower.some((c) => c.includes('stroke') || c.includes('tia') || c.includes('transient ischemic'));
    const hasVascular = conditionsLower.some((c) => c.includes('pad') || c.includes('peripheral arterial') || c.includes('mi') || c.includes('myocardial infarction') || c.includes('atheroscleros'));
    const onAnticoag = medsLower.some((m) => m.includes('warfarin') || m.includes('eliquis') || m.includes('apixaban') || m.includes('rivaroxaban') || m.includes('xarelto') || m.includes('dabigatran') || m.includes('edoxaban'));

    if (!hasAFib) {
      return { name: 'CHA₂DS₂-VASc (Stroke Risk)', score: 0, maxScore: 9, riskLevel: 'low', description: 'Not applicable — no atrial fibrillation diagnosis', recommendation: 'N/A', applicable: false };
    }

    const components: { label: string; points: number }[] = [];
    let score = 0;

    if (hasCHF) { score += 1; components.push({ label: 'Congestive heart failure', points: 1 }); }
    if (hasHTN) { score += 1; components.push({ label: 'Hypertension', points: 1 }); }
    if (age !== null && age >= 75) { score += 2; components.push({ label: 'Age ≥ 75', points: 2 }); }
    else if (age !== null && age >= 65) { score += 1; components.push({ label: 'Age 65-74', points: 1 }); }
    if (hasDM) { score += 1; components.push({ label: 'Diabetes', points: 1 }); }
    if (hasStroke) { score += 2; components.push({ label: 'Stroke/TIA history', points: 2 }); }
    if (hasVascular) { score += 1; components.push({ label: 'Vascular disease', points: 1 }); }
    if (sex === 'female' || sex === 'F') { score += 1; components.push({ label: 'Female sex', points: 1 }); }

    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    let recommendation = '';
    if (score >= 2) {
      riskLevel = 'high';
      recommendation = onAnticoag
        ? 'Already on anticoagulation — continue monitoring. Annual stroke risk 4-10%+ without treatment.'
        : 'Oral anticoagulation strongly recommended. Annual stroke risk 4-10%+ without treatment.';
    } else if (score === 1) {
      riskLevel = 'moderate';
      recommendation = onAnticoag
        ? 'On anticoagulation — continue. Consider clinical factors.'
        : 'Consider oral anticoagulation. Annual stroke risk ~1.3%.';
    } else {
      riskLevel = 'low';
      recommendation = onAnticoag
        ? 'May be over-anticoagulated. Reassess need for anticoagulation.'
        : 'No anticoagulation needed. Annual stroke risk <1%.';
    }

    return {
      name: 'CHA₂DS₂-VASc (Stroke Risk)',
      score,
      maxScore: 9,
      riskLevel,
      description: `Stroke risk score for atrial fibrillation${onAnticoag ? ' (on anticoagulation)' : ' (NOT on anticoagulation)'}`,
      recommendation,
      components,
      applicable: true,
    };
  }

  /** HAS-BLED — Bleeding risk on anticoagulation */
  private calculateHasBled(
    age: number | null,
    conditionsLower: string[],
    medsLower: string[],
    vitals: { metric: string; value: string }[],
    labs: { test: string; value: string; unit?: string }[],
  ): ClinicalRiskScore {
    const onAnticoag = medsLower.some((m) => m.includes('warfarin') || m.includes('eliquis') || m.includes('apixaban') || m.includes('rivaroxaban') || m.includes('xarelto') || m.includes('dabigatran') || m.includes('edoxaban') || m.includes('aspirin') || m.includes('clopidogrel') || m.includes('plavix'));
    if (!onAnticoag) {
      return { name: 'HAS-BLED (Bleeding Risk)', score: 0, maxScore: 9, riskLevel: 'low', description: 'Not applicable — not on anticoagulation/antiplatelet therapy', recommendation: 'N/A', applicable: false };
    }

    const hasHTN = conditionsLower.some((c) => c.includes('hypertension'));
    const hasRenal = conditionsLower.some((c) => c.includes('ckd') || c.includes('chronic kidney') || c.includes('renal failure') || c.includes('esrd'));
    const hasLiver = conditionsLower.some((c) => c.includes('cirrhosis') || c.includes('liver disease') || c.includes('hepatitis'));
    const hasStroke = conditionsLower.some((c) => c.includes('stroke') || c.includes('tia'));
    const hasBleeding = conditionsLower.some((c) => c.includes('bleeding') || c.includes('hemorrhage') || c.includes('anemia'));
    const onNSAIDs = medsLower.some((m) => m.includes('ibuprofen') || m.includes('naproxen') || m.includes('ketorolac') || m.includes('indomethacin'));
    const onAntiplatelet = medsLower.some((m) => m.includes('aspirin') || m.includes('clopidogrel') || m.includes('plavix'));

    const components: { label: string; points: number }[] = [];
    let score = 0;

    if (hasHTN) { score += 1; components.push({ label: 'Hypertension (uncontrolled, SBP >160)', points: 1 }); }
    if (hasRenal) { score += 1; components.push({ label: 'Abnormal renal function', points: 1 }); }
    if (hasLiver) { score += 1; components.push({ label: 'Abnormal liver function', points: 1 }); }
    if (hasStroke) { score += 1; components.push({ label: 'Stroke history', points: 1 }); }
    if (hasBleeding) { score += 1; components.push({ label: 'Bleeding history/predisposition', points: 1 }); }
    if (age !== null && age > 65) { score += 1; components.push({ label: 'Age > 65', points: 1 }); }
    if (onNSAIDs) { score += 1; components.push({ label: 'Concurrent NSAID use', points: 1 }); }
    if (onAntiplatelet) { score += 1; components.push({ label: 'Concurrent antiplatelet use', points: 1 }); }
    // Labile INR — can't determine without INR history, skip

    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    let recommendation = '';
    if (score >= 3) {
      riskLevel = 'high';
      recommendation = 'High bleeding risk. Reassess anticoagulation dose, correct modifiable risk factors (BP control, avoid NSAIDs). Consider gastroprotection with PPI.';
    } else if (score === 2) {
      riskLevel = 'moderate';
      recommendation = 'Moderate bleeding risk. Monitor closely. Address modifiable factors.';
    } else {
      riskLevel = 'low';
      recommendation = 'Low bleeding risk. Continue current therapy with routine monitoring.';
    }

    return {
      name: 'HAS-BLED (Bleeding Risk)',
      score,
      maxScore: 9,
      riskLevel,
      description: 'Major bleeding risk on anticoagulation/antiplatelet therapy',
      recommendation,
      components,
      applicable: true,
    };
  }

  /** Morse Fall Risk Scale (simplified from available data) */
  private calculateMorseFallRisk(
    age: number | null,
    conditionsLower: string[],
    medsLower: string[],
    vitals: { metric: string; value: string }[],
  ): ClinicalRiskScore {
    const components: { label: string; points: number }[] = [];
    let score = 0;

    // History of falling (proxy: age > 65 or neurological condition)
    const hasNeuro = conditionsLower.some((c) => c.includes('parkinson') || c.includes('stroke') || c.includes('seizure') || c.includes('dementia') || c.includes('alzheimer') || c.includes('neuropathy') || c.includes('vertigo'));
    if (hasNeuro) { score += 25; components.push({ label: 'Neurological condition (fall risk proxy)', points: 25 }); }

    // Secondary diagnosis (any chronic condition)
    if (conditionsLower.length >= 2) { score += 15; components.push({ label: 'Multiple diagnoses (≥2)', points: 15 }); }

    // Ambulatory aid (proxy: age-related mobility issues)
    if (age !== null && age >= 75) { score += 15; components.push({ label: 'Age ≥75 (mobility concern)', points: 15 }); }
    else if (age !== null && age >= 65) { score += 10; components.push({ label: 'Age 65-74', points: 10 }); }

    // IV therapy — can't determine, skip

    // Gait/transferring — proxy from vitals (low BP = orthostatic risk)
    const bp = vitals.find((v) => v.metric.toLowerCase().includes('blood pressure') || v.metric.toLowerCase().includes('bp'));
    if (bp) {
      const systolic = parseInt(bp.value.split('/')[0]);
      if (systolic && systolic < 100) { score += 20; components.push({ label: 'Low systolic BP (orthostatic risk)', points: 20 }); }
    }

    // Medication-induced fall risk (sedatives, antihypertensives, psychotropics)
    const fallRiskMeds = ['benzodiazepine', 'lorazepam', 'diazepam', 'alprazolam', 'zolpidem', 'trazodone', 'quetiapine', 'olanzapine', 'oxybutynin', 'diphenhydramine'];
    const onFallRiskMeds = medsLower.some((m) => fallRiskMeds.some((fm) => m.includes(fm)));
    if (onFallRiskMeds) { score += 15; components.push({ label: 'Fall-risk medications (sedatives/psychotropics)', points: 15 }); }

    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    let recommendation = '';
    if (score >= 50) {
      riskLevel = 'high';
      recommendation = 'High fall risk. Implement fall precautions: bed alarm, non-slip footwear, PT referral, medication review.';
    } else if (score >= 25) {
      riskLevel = 'moderate';
      recommendation = 'Moderate fall risk. Consider fall prevention interventions and medication review.';
    } else {
      riskLevel = 'low';
      recommendation = 'Low fall risk. Standard precautions.';
    }

    return {
      name: 'Morse Fall Risk',
      score,
      maxScore: 125,
      riskLevel,
      description: 'Fall risk assessment (simplified from patient data)',
      recommendation,
      components,
      applicable: true,
    };
  }

  /** qSOFA — Quick Sepsis-Related Organ Failure Assessment */
  private calculateQsofa(vitals: { metric: string; value: string }[]): ClinicalRiskScore {
    const rr = vitals.find((v) => v.metric.toLowerCase().includes('respiratory'));
    const hr = vitals.find((v) => v.metric.toLowerCase().includes('heart rate') || v.metric.toLowerCase().includes('pulse'));
    const bp = vitals.find((v) => v.metric.toLowerCase().includes('blood pressure') || v.metric.toLowerCase().includes('bp'));
    const temp = vitals.find((v) => v.metric.toLowerCase().includes('temperature'));

    if (!rr && !bp && !hr) {
      return { name: 'qSOFA (Sepsis Risk)', score: 0, maxScore: 3, riskLevel: 'low', description: 'Insufficient vital signs data', recommendation: 'N/A', applicable: false };
    }

    const components: { label: string; points: number }[] = [];
    let score = 0;

    if (rr) {
      const rrVal = parseInt(rr.value);
      if (rrVal >= 22) { score += 1; components.push({ label: `Respiratory rate ${rrVal} ≥22`, points: 1 }); }
    }
    if (bp) {
      const systolic = parseInt(bp.value.split('/')[0]);
      if (systolic && systolic <= 100) { score += 1; components.push({ label: `Systolic BP ${systolic} ≤100`, points: 1 }); }
    }
    // Altered mentation — can't determine from vitals alone, would need GCS

    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    let recommendation = '';
    if (score >= 2) {
      riskLevel = 'high';
      recommendation = 'High risk for poor outcome. Consider ICU consultation, lactate, blood cultures, broad-spectrum antibiotics.';
    } else if (score === 1) {
      riskLevel = 'moderate';
      recommendation = 'Monitor closely. Consider sepsis workup if clinical suspicion.';
    } else {
      riskLevel = 'low';
      recommendation = 'Low qSOFA score. Continue routine monitoring.';
    }

    return {
      name: 'qSOFA (Sepsis Risk)',
      score,
      maxScore: 3,
      riskLevel,
      description: 'Quick Sequential Organ Failure Assessment',
      recommendation,
      components,
      applicable: true,
    };
  }

  /** Polypharmacy Risk */
  private calculatePolypharmacyRisk(medCount: number, age: number | null): ClinicalRiskScore {
    if (medCount === 0) {
      return { name: 'Polypharmacy Risk', score: 0, maxScore: 3, riskLevel: 'low', description: 'No active medications', recommendation: 'N/A', applicable: false };
    }

    let score = 0;
    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    const components: { label: string; points: number }[] = [];

    if (medCount >= 10) {
      score = 3;
      riskLevel = 'high';
      components.push({ label: `${medCount} medications (excessive polypharmacy)`, points: 3 });
    } else if (medCount >= 5) {
      score = 2;
      riskLevel = 'moderate';
      components.push({ label: `${medCount} medications (polypharmacy)`, points: 2 });
    } else if (medCount >= 3 && age !== null && age >= 65) {
      score = 1;
      riskLevel = 'low';
      components.push({ label: `${medCount} medications (elderly patient)`, points: 1 });
    } else {
      score = 1;
      riskLevel = 'low';
      components.push({ label: `${medCount} medications`, points: 1 });
    }

    const recommendation = medCount >= 5
      ? 'Conduct medication reconciliation. Review for duplicate therapies, drug interactions, and deprescribing opportunities. Consider pharmacist consult.'
      : 'Routine medication monitoring.';

    return {
      name: 'Polypharmacy Risk',
      score,
      maxScore: 3,
      riskLevel,
      description: `${medCount} active medication${medCount !== 1 ? 's' : ''}`,
      recommendation,
      components,
      applicable: true,
    };
  }

  /** Beers Criteria — High-risk medications in elderly (≥65) */
  private calculateBeersCriteriaRisk(medsLower: string[], age: number | null): ClinicalRiskScore {
    if (age === null || age < 65) {
      return { name: 'Beers Criteria (Geriatric)', score: 0, maxScore: 3, riskLevel: 'low', description: 'Not applicable — patient under 65', recommendation: 'N/A', applicable: false };
    }

    const flagged: { med: string; category: string; concern: string }[] = [];
    for (const beer of BEERS_CRITERIA_MEDS) {
      for (const pattern of beer.patterns) {
        if (medsLower.some((m) => m.includes(pattern))) {
          const medName = medsLower.find((m) => m.includes(pattern));
          if (medName && !flagged.find((f) => f.med === medName)) {
            flagged.push({ med: medName, category: beer.category, concern: beer.concern });
          }
        }
      }
    }

    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    let score = 0;
    if (flagged.length >= 3) { riskLevel = 'high'; score = 3; }
    else if (flagged.length >= 2) { riskLevel = 'moderate'; score = 2; }
    else if (flagged.length === 1) { riskLevel = 'moderate'; score = 1; }

    const components = flagged.map((f) => ({ label: `${f.med} — ${f.category}`, points: 1 }));
    const recommendation = flagged.length > 0
      ? `Review ${flagged.length} potentially inappropriate medication(s) per AGS Beers Criteria. Consider alternatives: ${flagged.map((f) => f.med).join(', ')}.`
      : 'No Beers Criteria flagged medications.';

    return {
      name: 'Beers Criteria (Geriatric)',
      score,
      maxScore: 3,
      riskLevel,
      description: `${flagged.length} potentially inappropriate medication(s) for elderly patient`,
      recommendation,
      components,
      applicable: true,
    };
  }

  /** Frailty Risk (FRAIL scale proxy) */
  private calculateFrailtyRisk(
    age: number | null,
    conditionsLower: string[],
    vitals: { metric: string; value: string }[],
  ): ClinicalRiskScore {
    if (age === null || age < 50) {
      return { name: 'Frailty Risk', score: 0, maxScore: 5, riskLevel: 'low', description: 'Not applicable — patient under 50', recommendation: 'N/A', applicable: false };
    }

    let score = 0;
    const components: { label: string; points: number }[] = [];

    // Fatigue — proxy: depression or chronic fatigue condition
    if (conditionsLower.some((c) => c.includes('depression') || c.includes('fatigue') || c.includes('anemia'))) {
      score += 1; components.push({ label: 'Fatigue (depression/anemia)', points: 1 });
    }
    // Resistance — proxy: sarcopenia, mobility disorder
    if (conditionsLower.some((c) => c.includes('sarcopenia') || c.includes('mobility') || c.includes('weakness'))) {
      score += 1; components.push({ label: 'Resistance (mobility/weakness)', points: 1 });
    }
    // Ambulation — proxy: gait disorder, fall history
    if (conditionsLower.some((c) => c.includes('gait') || c.includes('fall') || c.includes('parkinson'))) {
      score += 1; components.push({ label: 'Ambulation (gait/fall issue)', points: 1 });
    }
    // Illnesses — ≥5 chronic conditions
    if (conditionsLower.length >= 5) { score += 1; components.push({ label: `Illnesses (≥5 chronic conditions)`, points: 1 }); }
    // Loss of weight — proxy: low BMI or weight loss condition
    const bmi = vitals.find((v) => v.metric.toLowerCase().includes('bmi'));
    if (bmi) {
      const bmiVal = parseFloat(bmi.value);
      if (bmiVal && bmiVal < 18.5) { score += 1; components.push({ label: `Weight loss (BMI ${bmiVal})`, points: 1 }); }
    }

    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    if (score >= 3) { riskLevel = 'high'; }
    else if (score >= 1) { riskLevel = 'moderate'; }

    const recommendation = score >= 3
      ? 'Frail. Comprehensive geriatric assessment recommended. Address reversible causes, nutrition support, exercise program.'
      : score >= 1
        ? 'Pre-frail. Interventions: resistance training, protein intake, vitamin D, medication review.'
        : 'Robust. Maintain healthy lifestyle.';

    return {
      name: 'Frailty Risk (FRAIL)',
      score,
      maxScore: 5,
      riskLevel,
      description: 'Frailty screening (proxy from clinical data)',
      recommendation,
      components,
      applicable: true,
    };
  }

  /** Malnutrition Risk */
  private calculateMalnutritionRisk(
    age: number | null,
    conditionsLower: string[],
    vitals: { metric: string; value: string }[],
    labs: { test: string; value: string; unit?: string }[],
  ): ClinicalRiskScore {
    const bmi = vitals.find((v) => v.metric.toLowerCase().includes('bmi'));
    const albumin = labs.find((l) => l.test.toLowerCase().includes('albumin'));

    if (!bmi && !albumin) {
      return { name: 'Malnutrition Risk', score: 0, maxScore: 3, riskLevel: 'low', description: 'Insufficient data (need BMI and/or albumin)', recommendation: 'N/A', applicable: false };
    }

    let score = 0;
    const components: { label: string; points: number }[] = [];

    if (bmi) {
      const bmiVal = parseFloat(bmi.value);
      if (bmiVal && bmiVal < 18.5) { score += 2; components.push({ label: `BMI ${bmiVal} (<18.5)`, points: 2 }); }
      else if (bmiVal && bmiVal < 22 && age !== null && age >= 65) { score += 1; components.push({ label: `BMI ${bmiVal} (low for elderly)`, points: 1 }); }
    }

    if (albumin) {
      const albVal = parseFloat(albumin.value);
      if (albVal && albVal < 3.0) { score += 2; components.push({ label: `Albumin ${albVal} g/dL (<3.0)`, points: 2 }); }
      else if (albVal && albVal < 3.5) { score += 1; components.push({ label: `Albumin ${albVal} g/dL (<3.5)`, points: 1 }); }
    }

    if (conditionsLower.some((c) => c.includes('malnutrition') || c.includes('cachexia') || c.includes('cancer'))) {
      score += 1; components.push({ label: 'Malnutrition-related diagnosis', points: 1 });
    }

    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    if (score >= 3) { riskLevel = 'high'; }
    else if (score >= 1) { riskLevel = 'moderate'; }

    const recommendation = score >= 3
      ? 'High malnutrition risk. Dietitian referral, oral nutritional supplements, address underlying cause.'
      : score >= 1
        ? 'Moderate risk. Monitor weight, dietary intake. Consider nutritional screening.'
        : 'Low risk. Routine dietary counseling.';

    return {
      name: 'Malnutrition Risk',
      score,
      maxScore: 5,
      riskLevel,
      description: 'Malnutrition screening from BMI, albumin, and diagnoses',
      recommendation,
      components,
      applicable: true,
    };
  }

  // ── Medication Risk ──────────────────────────────────────────────────────────

  private calculateMedicationRisk(
    medicationNames: string[],
    age: number | null,
  ): {
    items: MedicationRiskItem[];
    opioidMme: number | null;
    opioidRiskLevel: string | null;
    polypharmacyCount: number;
    highRiskMedications: string[];
  } {
    const items: MedicationRiskItem[] = [];
    const medsLower = medicationNames.map((m) => m.toLowerCase());

    // 1. Opioid risk
    let opioidMme: number | null = null;
    let opioidRiskLevel: string | null = null;

    const opioidMeds = medicationNames.filter((m) => {
      const cs = this.csRulesEngine.findControlledSubstance(m);
      return cs?.isOpioid;
    });

    if (opioidMeds.length > 0) {
      // Estimate MME (simplified — would need dosage info for precise calculation)
      let totalMme = 0;
      for (const med of opioidMeds) {
        const cs = this.csRulesEngine.findControlledSubstance(med);
        if (cs && cs.mmePerUnit) {
          // Assume 1 unit/day as minimum estimate (conservative)
          totalMme += cs.mmePerUnit * 3; // assume ~3 units/day as average
        }
      }
      opioidMme = Math.round(totalMme);
      const mmeRisk = this.csRulesEngine.getMmeRiskLevel(totalMme);
      opioidRiskLevel = mmeRisk.level;

      items.push({
        category: 'Opioid Risk',
        riskLevel: mmeRisk.level as any,
        description: `${opioidMeds.length} opioid medication(s) — estimated MME: ${opioidMme}/day`,
        medications: opioidMeds,
        recommendation: mmeRisk.recommendation,
        detail: { mme: opioidMme, medications: opioidMeds },
      });
    }

    // 2. Benzodiazepine + opioid co-prescribing
    const benzoOpioidRisk = this.csRulesEngine.checkBenzodiazepineOpioidRisk(
      medicationNames.map((m) => ({ name: m })),
    );
    if (benzoOpioidRisk.atRisk) {
      items.push({
        category: 'Benzodiazepine + Opioid Co-prescribing',
        riskLevel: benzoOpioidRisk.severity as any,
        description: benzoOpioidRisk.message,
        recommendation: 'Avoid co-prescribing. Consider tapering one or both. Naloxone co-prescription strongly recommended.',
      });
    }

    // 3. Polypharmacy
    if (medicationNames.length >= 5) {
      items.push({
        category: 'Polypharmacy',
        riskLevel: medicationNames.length >= 10 ? 'high' : 'moderate',
        description: `${medicationNames.length} active medications — increased risk of adverse drug events, interactions, and adherence issues.`,
        medications: medicationNames,
        recommendation: 'Conduct comprehensive medication review. Identify duplicate therapies, unnecessary medications, and deprescribing candidates. Consider pharmacist consult.',
      });
    }

    // 4. Beers Criteria (elderly)
    if (age !== null && age >= 65) {
      const flaggedMeds: string[] = [];
      for (const beer of BEERS_CRITERIA_MEDS) {
        for (const pattern of beer.patterns) {
          const match = medicationNames.find((m) => m.toLowerCase().includes(pattern));
          if (match && !flaggedMeds.includes(match)) flaggedMeds.push(match);
        }
      }
      if (flaggedMeds.length > 0) {
        items.push({
          category: 'Beers Criteria (Potentially Inappropriate Medications)',
          riskLevel: flaggedMeds.length >= 3 ? 'high' : 'moderate',
          description: `${flaggedMeds.length} medication(s) flagged as potentially inappropriate for elderly patients per AGS Beers Criteria.`,
          medications: flaggedMeds,
          recommendation: 'Review each flagged medication. Consider safer alternatives. Deprescribe where possible.',
        });
      }
    }

    // 5. High-risk medication combinations
    const onAnticoag = medsLower.some((m) => m.includes('warfarin') || m.includes('eliquis') || m.includes('apixaban') || m.includes('rivaroxaban') || m.includes('xarelto'));
    const onNSAID = medsLower.some((m) => m.includes('ibuprofen') || m.includes('naproxen') || m.includes('ketorolac') || m.includes('indomethacin'));
    if (onAnticoag && onNSAID) {
      items.push({
        category: 'Anticoagulant + NSAID Interaction',
        riskLevel: 'high',
        description: 'Concurrent anticoagulant and NSAID use significantly increases GI bleeding risk.',
        recommendation: 'Avoid NSAID use. Use acetaminophen for pain. If NSAID is necessary, add PPI for gastroprotection.',
      });
    }

    // 6. Antihypertensive polypharmacy
    const antihypertensives = medsLower.filter((m) =>
      m.includes('lisinopril') || m.includes('losartan') || m.includes('amlodipine') || m.includes('metoprolol') ||
      m.includes('atenolol') || m.includes('hydrochlorothiazide') || m.includes('hctz') || m.includes('furosemide') ||
      m.includes('enalapril') || m.includes('valsartan') || m.includes('diltiazem') || m.includes('clonidine')
    );
    if (antihypertensives.length >= 3) {
      items.push({
        category: 'Multiple Antihypertensives',
        riskLevel: 'moderate',
        description: `${antihypertensives.length} antihypertensive medications — risk of hypotension, especially in elderly.`,
        medications: antihypertensives,
        recommendation: 'Monitor blood pressure closely. Consider simplifying regimen. Assess for resistant hypertension vs. medication non-adherence.',
      });
    }

    // Collect all high-risk medications
    const highRiskMedications = [
      ...opioidMeds,
      ...medsLower.filter((m) => BEERS_CRITERIA_MEDS.some((b) => b.patterns.some((p) => m.includes(p)))).map((m) => medicationNames[medsLower.indexOf(m)]),
    ].filter((v, i, a) => a.indexOf(v) === i);

    return {
      items,
      opioidMme,
      opioidRiskLevel,
      polypharmacyCount: medicationNames.length,
      highRiskMedications,
    };
  }

  // ── AI Calls ─────────────────────────────────────────────────────────────────

  private async callAiRiskStratification(
    patientName: string,
    patientAge: number | null,
    patientSex: string | null,
    conditions: { condition: string; code?: string; icd10Code?: string }[],
    medications: { name: string; dosage?: string }[],
    vitals: { metric: string; value: string }[],
    labs: { test: string; value: string; unit?: string }[],
  ): Promise<any> {
    try {
      const conditionsStr = conditions.map((c) => `${c.condition}${c.icd10Code ? ` (${c.icd10Code})` : ''}`).join(', ');
      const medsStr = medications.map((m) => m.name).join(', ');
      const labsStr = labs.map((l) => `${l.test}: ${l.value}${l.unit || ''}`).join(', ');
      const vitalsStr = vitals.map((v) => `${v.metric}: ${v.value}`).join(', ');

      const prompt = `You are a clinical risk stratification assistant. Analyze this patient's risk for adverse outcomes (hospitalization, ED visits, complications, mortality) based on their clinical profile.

Patient: ${patientName}
Age: ${patientAge || 'Unknown'}, Sex: ${patientSex || 'Unknown'}
Conditions: ${conditionsStr || 'None'}
Medications: ${medsStr || 'None'}
Recent Labs: ${labsStr || 'None'}
Vitals: ${vitalsStr || 'None'}

Return ONLY a JSON object with this exact shape:
{
  "riskLevel": "low|moderate|high|very_high",
  "riskScore": "number 0-100",
  "riskFactors": [{"factor": "string", "severity": "low|moderate|high", "modifiable": "boolean", "domain": "clinical|medication|social|behavioral", "detail": "string"}],
  "predictedRisks": [{"outcome": "string (e.g. hospitalization, stroke, MI)", "probability": "string (e.g. '15%')", "timeframe": "string (e.g. '1 year')"}],
  "recommendations": [{"action": "string", "priority": "high|medium|low", "rationale": "string"}],
  "careManagementEnrollment": "boolean — should this patient be enrolled in care management?",
  "summary": "string — brief clinical summary of risk profile"
}

Be evidence-based and conservative. Do not overstate risk. Include the "domain" field for each risk factor.`;

      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.warn(`AI risk stratification failed: ${err.message}`);
      return null;
    }
  }

  private async callAiCareGapDetection(
    patientAge: number | null,
    patientSex: string | null,
    conditions: { condition: string; code?: string; icd10Code?: string }[],
    medications: { name: string }[],
    labs: { test: string; value: string; unit?: string }[],
    encounters: any[],
    immunizations: { name: string; date?: string }[],
  ): Promise<any> {
    try {
      const conditionsStr = conditions.map((c) => `${c.condition}${c.icd10Code ? ` (${c.icd10Code})` : ''}`).join(', ');
      const medsStr = medications.map((m) => m.name).join(', ');
      const labsStr = labs.map((l) => `${l.test}: ${l.value}`).join(', ');
      const immunizationsStr = immunizations.map((i) => `${i.name}${i.date ? ` (${i.date})` : ''}`).join(', ');
      const lastAppt = encounters[0]?.startTime;

      const prompt = `You are a clinical quality and care gap assistant. Identify care gaps for this patient based on clinical guidelines, preventive care recommendations, and chronic disease management standards.

Patient Age: ${patientAge || 'Unknown'}, Sex: ${patientSex || 'Unknown'}
Conditions: ${conditionsStr || 'None'}
Medications: ${medsStr || 'None'}
Recent Labs: ${labsStr || 'None'}
Immunizations: ${immunizationsStr || 'None'}
Last Appointment: ${lastAppt || 'Unknown'}

Return ONLY a JSON object with this exact shape:
{
  "careGaps": [{"gap": "string — description of the care gap", "category": "preventive|chronic_care|medication_safety|lab_monitoring|imaging|immunization", "severity": "low|moderate|high", "recommendation": "string — what should be done", "guideline": "string — source guideline (e.g. USPSTF, ADA, ACC/AHA)", "dueDate": "string? (ISO date when it should be completed)"}],
  "qualityMeasures": [{"measure": "string (e.g. 'HbA1c testing for diabetes')", "status": "met|not_met|overdue", "lastValue": "string?", "targetValue": "string?"}],
  "summary": "string — brief summary of care gap status"
}

Focus on actionable, evidence-based gaps. Include preventive screenings, chronic disease monitoring, medication safety checks, and immunizations. Prioritize by clinical risk impact.`;

      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.warn(`AI care gap detection failed: ${err.message}`);
      return null;
    }
  }

  // ── Data Extraction Helpers ──────────────────────────────────────────────────

  private extractRecentVitals(encounters: any[]): { metric: string; value: string }[] {
    if (!encounters || encounters.length === 0) return [];
    // Get most recent encounter with vitals
    const encounterWithVitals = encounters.find((e) => e.vitals && Object.keys(e.vitals).length > 0);
    if (!encounterWithVitals?.vitals) return [];

    const v = encounterWithVitals.vitals;
    const vitals: { metric: string; value: string }[] = [];
    if (v.bloodPressure) vitals.push({ metric: 'Blood Pressure', value: v.bloodPressure });
    if (v.heartRate) vitals.push({ metric: 'Heart Rate', value: v.heartRate });
    if (v.temperature) vitals.push({ metric: 'Temperature', value: v.temperature });
    if (v.respiratoryRate) vitals.push({ metric: 'Respiratory Rate', value: v.respiratoryRate });
    if (v.oxygenSaturation) vitals.push({ metric: 'Oxygen Saturation', value: v.oxygenSaturation });
    if (v.weight) vitals.push({ metric: 'Weight', value: `${v.weight} ${v.weightUnit || ''}`.trim() });
    if (v.height) vitals.push({ metric: 'Height', value: `${v.height} ${v.heightUnit || ''}`.trim() });
    if (v.bmi) vitals.push({ metric: 'BMI', value: v.bmi });
    if (v.painScore) vitals.push({ metric: 'Pain Score', value: String(v.painScore) });
    if (v.bloodGlucose) vitals.push({ metric: 'Blood Glucose', value: v.bloodGlucose });
    return vitals;
  }

  private extractRecentLabs(labOrders: any[]): { test: string; value: string; unit?: string; date?: string }[] {
    if (!labOrders || labOrders.length === 0) return [];
    const labs: { test: string; value: string; unit?: string; date?: string }[] = [];
    for (const order of labOrders.slice(0, 10)) {
      const tests = order.tests || [];
      const results = order.results || [];
      for (const result of results) {
        if (result.value) {
          labs.push({
            test: result.testName || result.test_name || 'Unknown Test',
            value: result.value,
            unit: result.unit,
            date: result.resultedDate || order.orderedDate,
          });
        }
      }
      // Also check tests array for result values
      for (const test of tests) {
        if (test.resultValue) {
          labs.push({
            test: test.testName || test.test_name || 'Unknown Test',
            value: test.resultValue,
            unit: test.unit,
            date: test.resultedDate || order.orderedDate,
          });
        }
      }
    }
    return labs.slice(0, 15);
  }

  private calculateAge(dateOfBirth: Date | string | null): number | null {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 && age <= 120 ? age : null;
  }
}
