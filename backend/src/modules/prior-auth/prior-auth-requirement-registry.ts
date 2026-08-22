/**
 * Seeded prior authorization requirement rules.
 *
 * This registry provides deterministic PA requirement lookups for common
 * payer × CPT combinations. The AI Requirement Predictor (A1) layers on
 * top of this to handle payers/CPTs not in the registry and to predict
 * probability when rules are ambiguous.
 *
 * Sources: Payer medical policy documents, CMS coverage databases, and
 * industry PA requirement compilations. These are starting defaults —
 * the system learns and supplements from denial history (A7 closed loop).
 */

export interface SeedRequirement {
  payerName: string | null; // null = applies to all payers
  procedureCode: string;
  procedureDescription: string;
  requirementType: 'always' | 'conditional' | 'never';
  conditions?: Array<{
    field: string;
    operator: string;
    value: string;
    description: string;
  }>;
  requiredCriteria: Array<{
    criterion: string;
    description: string;
    documentationRequired: boolean;
  }>;
  typicalTurnaroundHours?: number;
  typicalValidityDays?: number;
  submissionMethods?: string[];
}

// ── Common CPT/HCPCS codes that frequently require PA across payers ──

const HIGH_COST_IMAGING: SeedRequirement[] = [
  {
    payerName: null,
    procedureCode: '72148',
    procedureDescription: 'MRI lumbar spine without contrast',
    requirementType: 'conditional',
    conditions: [
      { field: 'diagnosis', operator: 'in', value: 'radiculopathy,low_back_pain', description: 'PA required for radicular pain or chronic low back pain' },
    ],
    requiredCriteria: [
      { criterion: 'conservative_therapy', description: '6 weeks of conservative treatment (PT, NSAIDs, activity modification) documented', documentationRequired: true },
      { criterion: 'neurological_deficit', description: 'Neurological deficit or progressive symptoms documented', documentationRequired: true },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 90,
    submissionMethods: ['electronic', 'portal', 'fax'],
  },
  {
    payerName: null,
    procedureCode: '72156',
    procedureDescription: 'MRI lumbar spine with contrast',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'prior_mri', description: 'Prior non-contrast MRI results', documentationRequired: true },
      { criterion: 'clinical_justification', description: 'Clinical justification for contrast (post-surgical, suspected tumor/infection)', documentationRequired: true },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 90,
  },
  {
    payerName: null,
    procedureCode: '70553',
    procedureDescription: 'MRI brain with and without contrast',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'neurological_symptoms', description: 'Documented neurological symptoms or findings', documentationRequired: true },
      { criterion: 'conservative_workup', description: 'Prior CT or non-contrast MRI results', documentationRequired: false },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 90,
  },
  {
    payerName: null,
    procedureCode: '73221',
    procedureDescription: 'MRI upper extremity without contrast',
    requirementType: 'conditional',
    conditions: [
      { field: 'diagnosis', operator: 'in', value: 'rotator_cuff_tear,shoulder_pain', description: 'PA required for shoulder pathology' },
    ],
    requiredCriteria: [
      { criterion: 'conservative_therapy', description: '4-6 weeks conservative treatment documented', documentationRequired: true },
      { criterion: 'physical_exam', description: 'Detailed physical exam findings (e.g., positive Hawkins-Kennedy)', documentationRequired: true },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 90,
  },
  {
    payerName: null,
    procedureCode: '73721',
    procedureDescription: 'MRI lower extremity without contrast',
    requirementType: 'conditional',
    conditions: [
      { field: 'diagnosis', operator: 'in', value: 'knee_injury,meniscus_tear,ligament_tear', description: 'PA required for knee/internal derangement' },
    ],
    requiredCriteria: [
      { criterion: 'conservative_therapy', description: '4-6 weeks conservative treatment', documentationRequired: true },
      { criterion: 'xray', description: 'Prior X-ray results', documentationRequired: true },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 90,
  },
];

const SPECIALTY_DRUGS: SeedRequirement[] = [
  {
    payerName: null,
    procedureCode: 'J1745',
    procedureDescription: 'Eteplirsen (Exondys 51) injection',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'genetic_confirmation', description: 'Genetic confirmation of Duchenne muscular dystrophy with amenable mutation', documentationRequired: true },
      { criterion: 'ambulatory_status', description: 'Ambulatory status documentation', documentationRequired: true },
      { criterion: 'baseline_functional', description: 'Baseline functional testing (6MWT, NSAA)', documentationRequired: true },
    ],
    typicalTurnaroundHours: 168,
    typicalValidityDays: 180,
    submissionMethods: ['electronic', 'portal'],
  },
  {
    payerName: null,
    procedureCode: 'J0717',
    procedureDescription: 'Cefepime injection',
    requirementType: 'conditional',
    conditions: [
      { field: 'setting', operator: '==', value: 'outpatient', description: 'PA required for outpatient administration' },
    ],
    requiredCriteria: [
      { criterion: 'culture_sensitivity', description: 'Culture and sensitivity results supporting cefepime', documentationRequired: true },
      { criterion: 'antibiotic_failure', description: 'Failure or intolerance of first-line agents', documentationRequired: false },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 30,
  },
];

const HIGH_COST_PROCEDURES: SeedRequirement[] = [
  {
    payerName: null,
    procedureCode: '22558',
    procedureDescription: 'Lumbar fusion, anterior approach',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'conservative_therapy', description: 'Minimum 3 months documented conservative treatment', documentationRequired: true },
      { criterion: 'imaging', description: 'MRI/CT confirming pathology (disc herniation, spondylolisthesis, stenosis)', documentationRequired: true },
      { criterion: 'symptom_duration', description: 'Symptoms > 6 months duration', documentationRequired: true },
      { criterion: 'functional_impairment', description: 'Documented functional impairment (ODI score)', documentationRequired: true },
    ],
    typicalTurnaroundHours: 168,
    typicalValidityDays: 120,
  },
  {
    payerName: null,
    procedureCode: '27447',
    procedureDescription: 'Total knee arthroplasty',
    requirementType: 'conditional',
    conditions: [
      { field: 'age', operator: '<', value: '60', description: 'PA required for patients under 60' },
    ],
    requiredCriteria: [
      { criterion: 'conservative_therapy', description: '3-6 months conservative treatment (PT, injections, NSAIDs)', documentationRequired: true },
      { criterion: 'imaging', description: 'X-ray showing advanced osteoarthritis (Kellgren-Lawrence grade 3-4)', documentationRequired: true },
      { criterion: 'functional_limitation', description: 'Documented functional limitation affecting ADLs', documentationRequired: true },
    ],
    typicalTurnaroundHours: 168,
    typicalValidityDays: 120,
  },
  {
    payerName: null,
    procedureCode: '33967',
    procedureDescription: 'Heart transplant',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'transplant_evaluation', description: 'Complete transplant center evaluation', documentationRequired: true },
      { criterion: 'heart_failure_diagnosis', description: 'End-stage heart failure documentation (NYHA Class IV)', documentationRequired: true },
      { criterion: 'functional_status', description: 'Cardiopulmonary exercise testing / peak VO2', documentationRequired: true },
    ],
    typicalTurnaroundHours: 720,
    typicalValidityDays: 365,
  },
];

const SLEEP_STUDIES: SeedRequirement[] = [
  {
    payerName: null,
    procedureCode: '95810',
    procedureDescription: 'Polysomnography, sleep staging',
    requirementType: 'conditional',
    conditions: [
      { field: 'symptoms', operator: 'in', value: 'sleep_apnea,excessive_daytime_sleepiness', description: 'PA required when symptoms suggest sleep apnea' },
    ],
    requiredCriteria: [
      { criterion: 'symptom_documentation', description: 'Documented symptoms (snoring, witnessed apnea, EDS)', documentationRequired: true },
      { criterion: 'screening_tool', description: 'STOP-BANG or Epworth Sleepiness Scale completed', documentationRequired: true },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 60,
  },
];

const DME: SeedRequirement[] = [
  {
    payerName: null,
    procedureCode: 'E0470',
    procedureDescription: 'BiPAP device',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'sleep_study', description: 'Polysomnography results showing sleep-disordered breathing', documentationRequired: true },
      { criterion: 'cpap_failure', description: 'Documentation of CPAP failure/intolerance if applicable', documentationRequired: false },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 90,
  },
  {
    payerName: null,
    procedureCode: 'E0260',
    procedureDescription: 'Powered pressure-reducing mattress',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'pressure_ulcer', description: 'Stage 2-4 pressure ulcer documentation', documentationRequired: true },
      { criterion: 'conservative_failure', description: 'Failure of standard mattress / conservative measures', documentationRequired: true },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 90,
  },
];

// ── Payer-specific overrides ──────────────────────────────────────────

const AETNA_SPECIFIC: SeedRequirement[] = [
  {
    payerName: 'Aetna',
    procedureCode: '72148',
    procedureDescription: 'MRI lumbar spine without contrast',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'conservative_therapy_6wk', description: '6 weeks conservative therapy (Aetna CPB 0350)', documentationRequired: true },
      { criterion: 'red_flags', description: 'Absence of red flags requiring immediate imaging', documentationRequired: false },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 90,
  },
];

const UHC_SPECIFIC: SeedRequirement[] = [
  {
    payerName: 'UnitedHealthcare',
    procedureCode: '27447',
    procedureDescription: 'Total knee arthroplasty',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'conservative_therapy_3mo', description: '3 months conservative treatment (UHC medical policy)', documentationRequired: true },
      { criterion: 'imaging', description: 'X-ray grade 3-4 OA', documentationRequired: true },
      { criterion: 'pain_documentation', description: 'Documented persistent pain limiting function', documentationRequired: true },
    ],
    typicalTurnaroundHours: 168,
    typicalValidityDays: 120,
  },
];

const CIGNA_SPECIFIC: SeedRequirement[] = [
  {
    payerName: 'Cigna',
    procedureCode: '72148',
    procedureDescription: 'MRI lumbar spine without contrast',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'conservative_therapy_6wk', description: '6 weeks conservative therapy (Cigna medical policy)', documentationRequired: true },
      { criterion: 'neuro_deficit', description: 'Neurological deficit or persistent radicular symptoms', documentationRequired: true },
    ],
    typicalTurnaroundHours: 72,
    typicalValidityDays: 90,
  },
];

const BCBS_SPECIFIC: SeedRequirement[] = [
  {
    payerName: 'Blue Cross Blue Shield',
    procedureCode: '95810',
    procedureDescription: 'Polysomnography, sleep staging',
    requirementType: 'always',
    requiredCriteria: [
      { criterion: 'symptom_documentation', description: 'Documented sleep apnea symptoms', documentationRequired: true },
      { criterion: 'screening', description: 'Screening questionnaire completed', documentationRequired: true },
      { criterion: 'home_study', description: 'Home sleep apnea test attempted first (BCBS requirement)', documentationRequired: false },
    ],
    typicalTurnaroundHours: 96,
    typicalValidityDays: 60,
  },
];

export const SEED_REQUIREMENTS: SeedRequirement[] = [
  ...HIGH_COST_IMAGING,
  ...SPECIALTY_DRUGS,
  ...HIGH_COST_PROCEDURES,
  ...SLEEP_STUDIES,
  ...DME,
  ...AETNA_SPECIFIC,
  ...UHC_SPECIFIC,
  ...CIGNA_SPECIFIC,
  ...BCBS_SPECIFIC,
];

/**
 * Look up PA requirement for a payer × CPT combination.
 * Returns the most specific match (payer-specific > generic).
 */
export function lookupRequirement(
  payerName: string | null,
  procedureCode: string,
): SeedRequirement | null {
  // Try payer-specific first
  if (payerName) {
    const payerMatch = SEED_REQUIREMENTS.find(
      (r) => r.payerName?.toLowerCase() === payerName.toLowerCase() && r.procedureCode === procedureCode,
    );
    if (payerMatch) return payerMatch;
  }
  // Fall back to generic (payerName = null)
  return SEED_REQUIREMENTS.find(
    (r) => r.payerName === null && r.procedureCode === procedureCode,
  ) ?? null;
}

/**
 * Get all requirements for a payer (for the requirement management UI).
 */
export function getRequirementsForPayer(payerName: string): SeedRequirement[] {
  return SEED_REQUIREMENTS.filter(
    (r) => r.payerName?.toLowerCase() === payerName.toLowerCase() || r.payerName === null,
  );
}
