/**
 * Shared clinical specialty taxonomy.
 *
 * Single source of truth for the list of specialties supported by the
 * platform. The `specialty` field on clinical templates (and the
 * `department`/`specialization` fields on providers) are free-text, so
 * arbitrary values are still accepted at runtime — this list drives UI
 * selectors and validation suggestions.
 *
 * Keep this list in sync with the backend constant at
 * `backend/src/modules/clinical/specialties.ts`.
 */
export const CLINICAL_SPECIALTIES = [
  'General Medicine',
  'Primary Care',
  'Family Medicine',
  'Internal Medicine',
  'Pediatrics',
  'Cardiology',
  'Pulmonology',
  'Neurology',
  'Endocrinology',
  'Behavioral Health',
  'Urgent Care',
  'Telehealth',
] as const;

export type ClinicalSpecialty = (typeof CLINICAL_SPECIALTIES)[number];

/**
 * Sentinel value used by selectors to indicate the user wants to enter a
 * specialty not present in the predefined list.
 */
export const CUSTOM_SPECIALTY_SENTINEL = 'Custom';

/**
 * Specialties offered in the template form selector, including the
 * "Custom" sentinel that triggers a free-text input.
 */
export const SPECIALTY_OPTIONS: readonly string[] = [
  ...CLINICAL_SPECIALTIES,
  CUSTOM_SPECIALTY_SENTINEL,
];

/**
 * Departments mirror specialties for seeded content. Kept as a separate
 * list because an organization may model departments differently from
 * clinical specialties.
 */
export const CLINICAL_DEPARTMENTS = [
  'Primary Care',
  'Cardiology',
  'Pulmonology',
  'Neurology',
  'Pediatrics',
  'Behavioral Health',
  'Urgent Care',
  'Telehealth',
] as const;

export type ClinicalDepartment = (typeof CLINICAL_DEPARTMENTS)[number];
