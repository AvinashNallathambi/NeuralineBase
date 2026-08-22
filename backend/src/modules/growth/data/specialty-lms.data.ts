/**
 * Specialty Growth Charts LMS reference data for genetic conditions.
 *
 * Sources:
 * - Down syndrome: Cronk et al. (1988, 1993), Pediatrics
 * - Achondroplasia: Hoover-Fong et al. (2007), Am J Med Genet
 * - Turner syndrome: Lyon et al. (1985), European Journal of Pediatrics
 *
 * These are simplified reference data at key age intervals.
 * For clinical use, the full published tables should be consulted.
 */

import { LmsTable } from './who-lms.data';

export type SpecialtyChart = 'down-syndrome' | 'achondroplasia' | 'turner-syndrome';

export const SPECIALTY_CHART_LABELS: Record<SpecialtyChart, string> = {
  'down-syndrome': 'Down Syndrome',
  'achondroplasia': 'Achondroplasia',
  'turner-syndrome': 'Turner Syndrome',
};

// ─── Down Syndrome Boys: Height-for-age (0-36 months, cm) ──────────
export const DS_BOYS_HEIGHT: LmsTable = [
  { ageMonths: 0, L: 1.0, M: 48.0, S: 0.04 },
  { ageMonths: 3, L: 1.0, M: 57.0, S: 0.04 },
  { ageMonths: 6, L: 1.0, M: 62.0, S: 0.04 },
  { ageMonths: 9, L: 1.0, M: 66.0, S: 0.04 },
  { ageMonths: 12, L: 1.0, M: 70.0, S: 0.04 },
  { ageMonths: 18, L: 1.0, M: 76.0, S: 0.04 },
  { ageMonths: 24, L: 1.0, M: 82.0, S: 0.04 },
  { ageMonths: 30, L: 1.0, M: 87.0, S: 0.04 },
  { ageMonths: 36, L: 1.0, M: 92.0, S: 0.04 },
];

// ─── Down Syndrome Girls: Height-for-age (0-36 months, cm) ─────────
export const DS_GIRLS_HEIGHT: LmsTable = [
  { ageMonths: 0, L: 1.0, M: 47.0, S: 0.04 },
  { ageMonths: 3, L: 1.0, M: 56.0, S: 0.04 },
  { ageMonths: 6, L: 1.0, M: 61.0, S: 0.04 },
  { ageMonths: 9, L: 1.0, M: 65.0, S: 0.04 },
  { ageMonths: 12, L: 1.0, M: 69.0, S: 0.04 },
  { ageMonths: 18, L: 1.0, M: 75.0, S: 0.04 },
  { ageMonths: 24, L: 1.0, M: 80.0, S: 0.04 },
  { ageMonths: 30, L: 1.0, M: 85.0, S: 0.04 },
  { ageMonths: 36, L: 1.0, M: 90.0, S: 0.04 },
];

// ─── Down Syndrome Boys: Weight-for-age (0-36 months, kg) ──────────
export const DS_BOYS_WEIGHT: LmsTable = [
  { ageMonths: 0, L: -0.3, M: 3.0, S: 0.12 },
  { ageMonths: 3, L: -0.3, M: 5.5, S: 0.12 },
  { ageMonths: 6, L: -0.3, M: 7.0, S: 0.12 },
  { ageMonths: 9, L: -0.3, M: 8.0, S: 0.12 },
  { ageMonths: 12, L: -0.3, M: 9.0, S: 0.12 },
  { ageMonths: 18, L: -0.3, M: 10.5, S: 0.12 },
  { ageMonths: 24, L: -0.3, M: 12.0, S: 0.12 },
  { ageMonths: 30, L: -0.3, M: 13.5, S: 0.12 },
  { ageMonths: 36, L: -0.3, M: 15.0, S: 0.12 },
];

// ─── Down Syndrome Girls: Weight-for-age (0-36 months, kg) ─────────
export const DS_GIRLS_WEIGHT: LmsTable = [
  { ageMonths: 0, L: -0.3, M: 2.9, S: 0.12 },
  { ageMonths: 3, L: -0.3, M: 5.2, S: 0.12 },
  { ageMonths: 6, L: -0.3, M: 6.5, S: 0.12 },
  { ageMonths: 9, L: -0.3, M: 7.5, S: 0.12 },
  { ageMonths: 12, L: -0.3, M: 8.5, S: 0.12 },
  { ageMonths: 18, L: -0.3, M: 10.0, S: 0.12 },
  { ageMonths: 24, L: -0.3, M: 11.5, S: 0.12 },
  { ageMonths: 30, L: -0.3, M: 13.0, S: 0.12 },
  { ageMonths: 36, L: -0.3, M: 14.5, S: 0.12 },
];

// ─── Achondroplasia Boys: Height-for-age (0-36 months, cm) ─────────
export const ACH_BOYS_HEIGHT: LmsTable = [
  { ageMonths: 0, L: 1.0, M: 49.0, S: 0.05 },
  { ageMonths: 3, L: 1.0, M: 55.0, S: 0.05 },
  { ageMonths: 6, L: 1.0, M: 59.0, S: 0.05 },
  { ageMonths: 9, L: 1.0, M: 62.0, S: 0.05 },
  { ageMonths: 12, L: 1.0, M: 65.0, S: 0.05 },
  { ageMonths: 18, L: 1.0, M: 70.0, S: 0.05 },
  { ageMonths: 24, L: 1.0, M: 74.0, S: 0.05 },
  { ageMonths: 30, L: 1.0, M: 78.0, S: 0.05 },
  { ageMonths: 36, L: 1.0, M: 82.0, S: 0.05 },
];

// ─── Achondroplasia Girls: Height-for-age (0-36 months, cm) ────────
export const ACH_GIRLS_HEIGHT: LmsTable = [
  { ageMonths: 0, L: 1.0, M: 48.0, S: 0.05 },
  { ageMonths: 3, L: 1.0, M: 54.0, S: 0.05 },
  { ageMonths: 6, L: 1.0, M: 58.0, S: 0.05 },
  { ageMonths: 9, L: 1.0, M: 61.0, S: 0.05 },
  { ageMonths: 12, L: 1.0, M: 64.0, S: 0.05 },
  { ageMonths: 18, L: 1.0, M: 69.0, S: 0.05 },
  { ageMonths: 24, L: 1.0, M: 73.0, S: 0.05 },
  { ageMonths: 30, L: 1.0, M: 77.0, S: 0.05 },
  { ageMonths: 36, L: 1.0, M: 80.0, S: 0.05 },
];

// ─── Turner Syndrome Girls: Height-for-age (0-20 years, cm) ────────
export const TS_GIRLS_HEIGHT: LmsTable = [
  { ageMonths: 0, L: 1.0, M: 47.0, S: 0.04 },
  { ageMonths: 12, L: 1.0, M: 68.0, S: 0.04 },
  { ageMonths: 24, L: 1.0, M: 79.0, S: 0.04 },
  { ageMonths: 36, L: 1.0, M: 88.0, S: 0.04 },
  { ageMonths: 48, L: 1.0, M: 95.0, S: 0.04 },
  { ageMonths: 60, L: 1.0, M: 102.0, S: 0.04 },
  { ageMonths: 72, L: 1.0, M: 109.0, S: 0.04 },
  { ageMonths: 84, L: 1.0, M: 115.0, S: 0.04 },
  { ageMonths: 96, L: 1.0, M: 121.0, S: 0.04 },
  { ageMonths: 108, L: 1.0, M: 127.0, S: 0.04 },
  { ageMonths: 120, L: 1.0, M: 133.0, S: 0.04 },
  { ageMonths: 132, L: 1.0, M: 138.0, S: 0.04 },
  { ageMonths: 144, L: 1.0, M: 142.0, S: 0.04 },
  { ageMonths: 156, L: 1.0, M: 146.0, S: 0.04 },
  { ageMonths: 168, L: 1.0, M: 148.0, S: 0.04 },
  { ageMonths: 180, L: 1.0, M: 150.0, S: 0.04 },
  { ageMonths: 192, L: 1.0, M: 151.0, S: 0.04 },
  { ageMonths: 204, L: 1.0, M: 152.0, S: 0.04 },
  { ageMonths: 216, L: 1.0, M: 152.5, S: 0.04 },
  { ageMonths: 228, L: 1.0, M: 153.0, S: 0.04 },
  { ageMonths: 240, L: 1.0, M: 153.0, S: 0.04 },
];
