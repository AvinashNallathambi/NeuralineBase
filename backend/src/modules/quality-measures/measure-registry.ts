/**
 * Quality Measure Registry
 *
 * Seeded measure definitions aligned with CMS eCQMs, MIPS quality measures,
 * and HEDIS measures. Each measure has deterministic calculation logic
 * implemented in the QualityMeasuresService.
 */

export interface MeasureDefinition {
  id: string;
  title: string;
  program: 'MIPS' | 'eCQM' | 'HEDIS' | 'UDS';
  category: 'preventive' | 'chronic_care' | 'medication_safety' | 'lab_monitoring' | 'imaging' | 'immunization' | 'care_coordination';
  description: string;
  /** ICD-10 codes that qualify a patient for this measure */
  qualifyingDiagnosisCodes?: string[];
  /** LOINC codes for required labs */
  requiredLabCodes?: string[];
  /** Required frequency in months (e.g. 3 = quarterly, 12 = annually) */
  requiredFrequencyMonths?: number;
  /** Target value description */
  targetValue?: string;
  /** Whether this can typically be closed during a routine visit */
  closeableInVisit: boolean;
  /** Suggested action when gap is open */
  suggestedAction?: string;
  /** Cross-program mappings */
  crossProgramMappings?: Array<{ program: string; measureId: string; measureTitle: string }>;
  /** Priority weight (1 = highest) */
  priority: number;
}

export const MEASURE_REGISTRY: MeasureDefinition[] = [
  // ─── Diabetes Care ──────────────────────────────────────────────
  {
    id: 'CMS122v13',
    title: 'Diabetes: HbA1c Testing',
    program: 'eCQM',
    category: 'lab_monitoring',
    description: 'Percentage of patients 18-75 with diabetes who had HbA1c tested at least once in the measurement period.',
    qualifyingDiagnosisCodes: ['E10', 'E11', 'E13', 'E10.9', 'E11.9', 'E13.9', 'E10.65', 'E11.65', 'E11.8', 'E11.7'],
    requiredLabCodes: ['4548-4', '17855-8', 'HbA1c'],
    requiredFrequencyMonths: 12,
    targetValue: 'At least 1x per year',
    closeableInVisit: true,
    suggestedAction: 'Order HbA1c (LOINC 4548-4) lab test',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-001', measureTitle: 'Diabetes: HbA1c Poor Control (>9%)' },
      { program: 'HEDIS', measureId: 'HEDIS-CDC-HbA1c', measureTitle: 'Comprehensive Diabetes Care: HbA1c Testing' },
      { program: 'UDS', measureId: 'UDS-7B-HbA1c', measureTitle: 'Diabetes: HbA1c Testing' },
    ],
    priority: 1,
  },
  {
    id: 'CMS124v13',
    title: 'Diabetes: Eye Exam',
    program: 'eCQM',
    category: 'imaging',
    description: 'Percentage of patients 18-75 with diabetes who had a retinal eye exam in the measurement period.',
    qualifyingDiagnosisCodes: ['E10', 'E11', 'E13', 'E10.9', 'E11.9', 'E13.9'],
    requiredFrequencyMonths: 12,
    targetValue: 'Annual retinal exam',
    closeableInVisit: false,
    suggestedAction: 'Refer to ophthalmology for diabetic retinal exam',
    crossProgramMappings: [
      { program: 'HEDIS', measureId: 'HEDIS-CDC-Eye', measureTitle: 'Comprehensive Diabetes Care: Eye Exam' },
    ],
    priority: 2,
  },
  {
    id: 'CMS125v13',
    title: 'Diabetes: Medical Attention for Nephropathy',
    program: 'eCQM',
    category: 'lab_monitoring',
    description: 'Percentage of patients 18-75 with diabetes who had evidence of nephropathy screening or treatment.',
    qualifyingDiagnosisCodes: ['E10', 'E11', 'E13', 'E10.9', 'E11.9', 'E13.9'],
    requiredLabCodes: ['3094-0', '49718-7', 'uACR', 'urine albumin'],
    requiredFrequencyMonths: 12,
    targetValue: 'Annual urine microalbumin test',
    closeableInVisit: true,
    suggestedAction: 'Order urine microalbumin/creatinine ratio (LOINC 3094-0)',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-119', measureTitle: 'Diabetes: Medical Attention for Nephropathy' },
    ],
    priority: 2,
  },

  // ─── Hypertension / Cardiovascular ──────────────────────────────
  {
    id: 'CMS22v13',
    title: 'Controlling High Blood Pressure',
    program: 'eCQM',
    category: 'chronic_care',
    description: 'Percentage of patients 18-85 with hypertension whose BP was <140/90 at last reading.',
    qualifyingDiagnosisCodes: ['I10', 'I11', 'I11.9', 'I12', 'I13', 'I15', 'I16'],
    targetValue: '<140/90 mmHg',
    closeableInVisit: true,
    suggestedAction: 'Record blood pressure; if ≥140/90, adjust medication regimen',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-236', measureTitle: 'Controlling High Blood Pressure' },
      { program: 'HEDIS', measureId: 'HEDIS-CBP', measureTitle: 'Controlling High Blood Pressure' },
    ],
    priority: 1,
  },
  {
    id: 'CMS68v13',
    title: 'Statin Therapy for Cardiovascular Disease Prevention',
    program: 'eCQM',
    category: 'medication_safety',
    description: 'Percentage of patients 40-75 with CVD or diabetes prescribed statin therapy.',
    qualifyingDiagnosisCodes: ['I20', 'I21', 'I22', 'I25', 'E10', 'E11', 'E13'],
    targetValue: 'Statin prescribed',
    closeableInVisit: true,
    suggestedAction: 'Prescribe statin therapy (atorvastatin, rosuvastatin, etc.)',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-438', measureTitle: 'Statin Therapy for the Prevention and Treatment of CVD' },
    ],
    priority: 2,
  },

  // ─── Preventive Care / Screening ────────────────────────────────
  {
    id: 'CMS130v13',
    title: 'Colorectal Cancer Screening',
    program: 'eCQM',
    category: 'preventive',
    description: 'Percentage of adults 45-75 who had appropriate colorectal cancer screening.',
    requiredFrequencyMonths: 120, // 10 years for colonoscopy
    targetValue: 'Colonoscopy every 10y, FIT annually, or FIT-DNA every 3y',
    closeableInVisit: true,
    suggestedAction: 'Order FIT test or refer for colonoscopy',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-046', measureTitle: 'Colorectal Cancer Screening' },
      { program: 'HEDIS', measureId: 'HEDIS-CCS', measureTitle: 'Colorectal Cancer Screening' },
    ],
    priority: 2,
  },
  {
    id: 'CMS124v14',
    title: 'Breast Cancer Screening',
    program: 'eCQM',
    category: 'imaging',
    description: 'Percentage of women 50-74 who had mammography screening in the past 27 months.',
    requiredFrequencyMonths: 27,
    targetValue: 'Mammogram every 2 years (ages 50-74)',
    closeableInVisit: false,
    suggestedAction: 'Refer for screening mammography',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-112', measureTitle: 'Breast Cancer Screening' },
      { program: 'HEDIS', measureId: 'HEDIS-BCS', measureTitle: 'Breast Cancer Screening' },
    ],
    priority: 2,
  },
  {
    id: 'CMS125v14',
    title: 'Cervical Cancer Screening',
    program: 'eCQM',
    category: 'preventive',
    description: 'Percentage of women 23-64 with cervical cancer screening (Pap or HPV test).',
    requiredFrequencyMonths: 36,
    targetValue: 'Pap every 3y (21-65) or HPV every 5y (30-65)',
    closeableInVisit: true,
    suggestedAction: 'Perform Pap smear or HPV test',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-047', measureTitle: 'Cervical Cancer Screening' },
      { program: 'HEDIS', measureId: 'HEDIS-CCS-Cervical', measureTitle: 'Cervical Cancer Screening' },
    ],
    priority: 2,
  },

  // ─── Immunizations ──────────────────────────────────────────────
  {
    id: 'CMS127v13',
    title: 'Influenza Immunization',
    program: 'eCQM',
    category: 'immunization',
    description: 'Percentage of patients ≥6 months who received influenza immunization during the flu season.',
    requiredFrequencyMonths: 12,
    targetValue: 'Annual flu vaccine',
    closeableInVisit: true,
    suggestedAction: 'Administer influenza vaccine',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-110', measureTitle: 'Influenza Immunization' },
    ],
    priority: 3,
  },
  {
    id: 'CMS128v13',
    title: 'Pneumococcal Vaccination',
    program: 'eCQM',
    category: 'immunization',
    description: 'Percentage of patients ≥65 who received pneumococcal vaccination.',
    targetValue: 'PCV13 + PPSV23 (or PCV15/PCV20)',
    closeableInVisit: true,
    suggestedAction: 'Administer pneumococcal vaccine (PCV15 or PCV20)',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-111', measureTitle: 'Pneumococcal Vaccination' },
    ],
    priority: 3,
  },

  // ─── Behavioral Health ──────────────────────────────────────────
  {
    id: 'CMS134v13',
    title: 'Depression Screening and Follow-Up',
    program: 'eCQM',
    category: 'preventive',
    description: 'Percentage of patients ≥12 screened for depression and, if positive, received follow-up.',
    requiredFrequencyMonths: 12,
    targetValue: 'Annual PHQ-9 screening',
    closeableInVisit: true,
    suggestedAction: 'Administer PHQ-9 depression screening tool',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-134', measureTitle: 'Preventive Care Screening: Screening for Depression' },
    ],
    priority: 2,
  },
  {
    id: 'CMS144v13',
    title: 'Tobacco Use Screening and Cessation Intervention',
    program: 'eCQM',
    category: 'preventive',
    description: 'Percentage of patients ≥12 screened for tobacco use and, if positive, received cessation intervention.',
    requiredFrequencyMonths: 12,
    targetValue: 'Annual tobacco screening + cessation counseling if positive',
    closeableInVisit: true,
    suggestedAction: 'Document tobacco status; if user, provide cessation counseling',
    crossProgramMappings: [
      { program: 'MIPS', measureId: 'MIPS-226', measureTitle: 'Tobacco Use Screening and Cessation Intervention' },
    ],
    priority: 3,
  },

  // ─── Pediatric Growth Monitoring ───────────────────────────────
  {
    id: 'GROWTH-WELLCHILD-0-2',
    title: 'Well-Child Growth Monitoring (0-2 years)',
    program: 'HEDIS',
    category: 'preventive',
    description: 'Children 0-2 years should have weight, length, and head circumference measured at each well-child visit (minimum 6 visits in first 15 months).',
    requiredFrequencyMonths: 2,
    targetValue: 'Weight + length + head circumference at each well-child visit',
    closeableInVisit: true,
    suggestedAction: 'Record weight, length, and head circumference in vitals; plot on WHO growth chart',
    priority: 2,
  },
  {
    id: 'GROWTH-BMI-2-19',
    title: 'Childhood BMI Screening (2-19 years)',
    program: 'HEDIS',
    category: 'preventive',
    description: 'Children and adolescents 2-19 years should have BMI percentile calculated at least annually.',
    requiredFrequencyMonths: 12,
    targetValue: 'Annual BMI percentile assessment',
    closeableInVisit: true,
    suggestedAction: 'Record weight and height in vitals; BMI percentile will be calculated automatically',
    priority: 3,
  },
  {
    id: 'GROWTH-HEADCIRC-0-3',
    title: 'Head Circumference Monitoring (0-3 years)',
    program: 'HEDIS',
    category: 'preventive',
    description: 'Children 0-36 months should have head circumference measured at well-child visits to screen for microcephaly and macrocephaly.',
    requiredFrequencyMonths: 6,
    targetValue: 'Head circumference at well-child visits',
    closeableInVisit: true,
    suggestedAction: 'Record head circumference in vitals; plot on WHO head circumference chart',
    priority: 2,
  },
];

/**
 * Get all measures applicable to a patient based on age, sex, and diagnoses.
 */
export function getApplicableMeasures(
  patientAge: number | null,
  patientSex: string | null,
  diagnosisCodes: string[],
): MeasureDefinition[] {
  const codes = diagnosisCodes.map((c) => c.toUpperCase().trim());

  return MEASURE_REGISTRY.filter((m) => {
    // Check diagnosis-based eligibility
    if (m.qualifyingDiagnosisCodes && m.qualifyingDiagnosisCodes.length > 0) {
      const hasDiagnosis = m.qualifyingDiagnosisCodes.some((q) =>
        codes.some((c) => c.startsWith(q.toUpperCase()) || c === q.toUpperCase()),
      );
      if (!hasDiagnosis) return false;
    }

    // Age-based screening measures
    if (m.id === 'CMS130v13' && (patientAge === null || patientAge < 45 || patientAge > 75)) return false;
    if (m.id === 'CMS124v14' && (patientSex !== 'female' || patientAge === null || patientAge < 50 || patientAge > 74)) return false;
    if (m.id === 'CMS125v14' && (patientSex !== 'female' || patientAge === null || patientAge < 23 || patientAge > 64)) return false;
    if (m.id === 'CMS128v13' && (patientAge === null || patientAge < 65)) return false;
    // Pediatric growth measures
    if (m.id === 'GROWTH-WELLCHILD-0-2' && (patientAge === null || patientAge > 2)) return false;
    if (m.id === 'GROWTH-BMI-2-19' && (patientAge === null || patientAge < 2 || patientAge > 19)) return false;
    if (m.id === 'GROWTH-HEADCIRC-0-3' && (patientAge === null || patientAge > 3)) return false;

    return true;
  });
}
