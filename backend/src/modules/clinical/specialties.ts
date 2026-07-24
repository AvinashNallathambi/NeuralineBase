/**
 * Shared clinical specialty taxonomy.
 *
 * Single source of truth for the list of specialties supported by the
 * platform. The `specialty` column on clinical templates (and the
 * `department`/`specialization` columns on providers) are free-text, so
 * arbitrary values are still accepted at runtime — this list is used to
 * drive UI selectors, seeded content, and validation suggestions.
 *
 * Keep this list in sync with the frontend constant at
 * `frontend/src/constants/specialties.ts`.
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
 * Sentinel value used by UI selectors to indicate the user wants to enter
 * a specialty not present in the predefined list.
 */
export const CUSTOM_SPECIALTY_SENTINEL = 'Custom';

/**
 * Departments mirror specialties for seeded content. Kept as a separate
 * list because an organization may model departments differently from
 * clinical specialties (e.g., a "Primary Care" department containing
 * both Family Medicine and Internal Medicine providers).
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
