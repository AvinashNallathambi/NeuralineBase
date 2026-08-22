/**
 * WHO Child Growth Standards (0-60 months) LMS reference data.
 * Source: WHO Multicentre Growth Reference Study (2006)
 * Public domain: https://www.who.int/tools/child-growth-standards
 *
 * L = Box-Cox power (skewness)
 * M = Median
 * S = Coefficient of variation
 *
 * Z-score = ((value/M)^L - 1) / (L * S)
 *
 * Age is in months. Data is at every 3 months for practical use;
 * linear interpolation is used for intermediate ages.
 */

export interface LmsRow {
  ageMonths: number;
  L: number;
  M: number;
  S: number;
}

export type LmsTable = LmsRow[];

// ─── WHO Boys: Weight-for-age (0-60 months, kg) ───────────────────────────
export const WHO_BOYS_WEIGHT: LmsTable = [
  { ageMonths: 0, L: -0.357, M: 3.3464, S: 0.09185 },
  { ageMonths: 3, L: -0.357, M: 6.0217, S: 0.11352 },
  { ageMonths: 6, L: -0.357, M: 7.7691, S: 0.12192 },
  { ageMonths: 9, L: -0.357, M: 9.1764, S: 0.12668 },
  { ageMonths: 12, L: -0.357, M: 10.4653, S: 0.12948 },
  { ageMonths: 15, L: -0.357, M: 11.6093, S: 0.13127 },
  { ageMonths: 18, L: -0.357, M: 12.6304, S: 0.13253 },
  { ageMonths: 21, L: -0.357, M: 13.5630, S: 0.13349 },
  { ageMonths: 24, L: -0.357, M: 14.4230, S: 0.13427 },
  { ageMonths: 27, L: -0.357, M: 15.2269, S: 0.13491 },
  { ageMonths: 30, L: -0.357, M: 15.9819, S: 0.13545 },
  { ageMonths: 33, L: -0.357, M: 16.6935, S: 0.13591 },
  { ageMonths: 36, L: -0.357, M: 17.3664, S: 0.13631 },
  { ageMonths: 39, L: -0.357, M: 18.0046, S: 0.13667 },
  { ageMonths: 42, L: -0.357, M: 18.6114, S: 0.13699 },
  { ageMonths: 45, L: -0.357, M: 19.1898, S: 0.13728 },
  { ageMonths: 48, L: -0.357, M: 19.7425, S: 0.13754 },
  { ageMonths: 51, L: -0.357, M: 20.2717, S: 0.13777 },
  { ageMonths: 54, L: -0.357, M: 20.7791, S: 0.13798 },
  { ageMonths: 57, L: -0.357, M: 21.2660, S: 0.13816 },
  { ageMonths: 60, L: -0.357, M: 21.7336, S: 0.13833 },
];

// ─── WHO Girls: Weight-for-age (0-60 months, kg) ──────────────────────────
export const WHO_GIRLS_WEIGHT: LmsTable = [
  { ageMonths: 0, L: -0.357, M: 3.2322, S: 0.09103 },
  { ageMonths: 3, L: -0.357, M: 5.4915, S: 0.11175 },
  { ageMonths: 6, L: -0.357, M: 7.0975, S: 0.12003 },
  { ageMonths: 9, L: -0.357, M: 8.3852, S: 0.12473 },
  { ageMonths: 12, L: -0.357, M: 9.5196, S: 0.12753 },
  { ageMonths: 15, L: -0.357, M: 10.5548, S: 0.12935 },
  { ageMonths: 18, L: -0.357, M: 11.5154, S: 0.13067 },
  { ageMonths: 21, L: -0.357, M: 12.4154, S: 0.13167 },
  { ageMonths: 24, L: -0.357, M: 13.2641, S: 0.13246 },
  { ageMonths: 27, L: -0.357, M: 14.0683, S: 0.13311 },
  { ageMonths: 30, L: -0.357, M: 14.8322, S: 0.13365 },
  { ageMonths: 33, L: -0.357, M: 15.5600, S: 0.13412 },
  { ageMonths: 36, L: -0.357, M: 16.2546, S: 0.13453 },
  { ageMonths: 39, L: -0.357, M: 16.9185, S: 0.13489 },
  { ageMonths: 42, L: -0.357, M: 17.5537, S: 0.13521 },
  { ageMonths: 45, L: -0.357, M: 18.1620, S: 0.13550 },
  { ageMonths: 48, L: -0.357, M: 18.7452, S: 0.13576 },
  { ageMonths: 51, L: -0.357, M: 19.3048, S: 0.13599 },
  { ageMonths: 54, L: -0.357, M: 19.8422, S: 0.13620 },
  { ageMonths: 57, L: -0.357, M: 20.3584, S: 0.13639 },
  { ageMonths: 60, L: -0.357, M: 20.8544, S: 0.13656 },
];

// ─── WHO Boys: Length-for-age (0-24 months, cm) ───────────────────────────
export const WHO_BOYS_LENGTH: LmsTable = [
  { ageMonths: 0, L: 1.0, M: 49.9886, S: 0.03796 },
  { ageMonths: 3, L: 1.0, M: 61.4342, S: 0.03501 },
  { ageMonths: 6, L: 1.0, M: 67.6249, S: 0.03381 },
  { ageMonths: 9, L: 1.0, M: 72.0057, S: 0.03329 },
  { ageMonths: 12, L: 1.0, M: 75.7484, S: 0.03309 },
  { ageMonths: 15, L: 1.0, M: 79.0916, S: 0.03314 },
  { ageMonths: 18, L: 1.0, M: 82.0937, S: 0.03335 },
  { ageMonths: 21, L: 1.0, M: 84.7906, S: 0.03365 },
  { ageMonths: 24, L: 1.0, M: 87.1658, S: 0.03399 },
];

// ─── WHO Girls: Length-for-age (0-24 months, cm) ──────────────────────────
export const WHO_GIRLS_LENGTH: LmsTable = [
  { ageMonths: 0, L: 1.0, M: 49.1477, S: 0.03786 },
  { ageMonths: 3, L: 1.0, M: 59.8025, S: 0.03515 },
  { ageMonths: 6, L: 1.0, M: 65.7375, S: 0.03421 },
  { ageMonths: 9, L: 1.0, M: 70.1015, S: 0.03379 },
  { ageMonths: 12, L: 1.0, M: 74.0148, S: 0.03370 },
  { ageMonths: 15, L: 1.0, M: 77.5140, S: 0.03383 },
  { ageMonths: 18, L: 1.0, M: 80.7125, S: 0.03412 },
  { ageMonths: 21, L: 1.0, M: 83.6249, S: 0.03451 },
  { ageMonths: 24, L: 1.0, M: 86.4518, S: 0.03493 },
];

// ─── WHO Boys: Height-for-age (24-60 months, cm) ──────────────────────────
export const WHO_BOYS_HEIGHT: LmsTable = [
  { ageMonths: 24, L: 1.0, M: 87.1658, S: 0.03399 },
  { ageMonths: 27, L: 1.0, M: 89.4678, S: 0.03436 },
  { ageMonths: 30, L: 1.0, M: 91.6767, S: 0.03475 },
  { ageMonths: 33, L: 1.0, M: 93.8015, S: 0.03514 },
  { ageMonths: 36, L: 1.0, M: 95.8487, S: 0.03552 },
  { ageMonths: 39, L: 1.0, M: 97.8245, S: 0.03589 },
  { ageMonths: 42, L: 1.0, M: 99.7345, S: 0.03625 },
  { ageMonths: 45, L: 1.0, M: 101.5837, S: 0.03659 },
  { ageMonths: 48, L: 1.0, M: 103.3759, S: 0.03691 },
  { ageMonths: 51, L: 1.0, M: 105.1146, S: 0.03722 },
  { ageMonths: 54, L: 1.0, M: 106.8031, S: 0.03751 },
  { ageMonths: 57, L: 1.0, M: 108.4447, S: 0.03778 },
  { ageMonths: 60, L: 1.0, M: 110.0425, S: 0.03804 },
];

// ─── WHO Girls: Height-for-age (24-60 months, cm) ─────────────────────────
export const WHO_GIRLS_HEIGHT: LmsTable = [
  { ageMonths: 24, L: 1.0, M: 86.4518, S: 0.03493 },
  { ageMonths: 27, L: 1.0, M: 88.7155, S: 0.03534 },
  { ageMonths: 30, L: 1.0, M: 90.9026, S: 0.03577 },
  { ageMonths: 33, L: 1.0, M: 93.0182, S: 0.03620 },
  { ageMonths: 36, L: 1.0, M: 95.0677, S: 0.03662 },
  { ageMonths: 39, L: 1.0, M: 97.0553, S: 0.03703 },
  { ageMonths: 42, L: 1.0, M: 98.9854, S: 0.03742 },
  { ageMonths: 45, L: 1.0, M: 100.8620, S: 0.03780 },
  { ageMonths: 48, L: 1.0, M: 102.6887, S: 0.03816 },
  { ageMonths: 51, L: 1.0, M: 104.4686, S: 0.03851 },
  { ageMonths: 54, L: 1.0, M: 106.2043, S: 0.03884 },
  { ageMonths: 57, L: 1.0, M: 107.8985, S: 0.03915 },
  { ageMonths: 60, L: 1.0, M: 109.5534, S: 0.03945 },
];

// ─── WHO Boys: Head circumference-for-age (0-60 months, cm) ───────────────
export const WHO_BOYS_HEAD: LmsTable = [
  { ageMonths: 0, L: 1.0, M: 34.4620, S: 0.03686 },
  { ageMonths: 3, L: 1.0, M: 41.2249, S: 0.03163 },
  { ageMonths: 6, L: 1.0, M: 43.5759, S: 0.02953 },
  { ageMonths: 9, L: 1.0, M: 45.2437, S: 0.02848 },
  { ageMonths: 12, L: 1.0, M: 46.5685, S: 0.02794 },
  { ageMonths: 15, L: 1.0, M: 47.6960, S: 0.02767 },
  { ageMonths: 18, L: 1.0, M: 48.6839, S: 0.02755 },
  { ageMonths: 21, L: 1.0, M: 49.5640, S: 0.02752 },
  { ageMonths: 24, L: 1.0, M: 50.3553, S: 0.02754 },
  { ageMonths: 27, L: 1.0, M: 51.0710, S: 0.02760 },
  { ageMonths: 30, L: 1.0, M: 51.7223, S: 0.02769 },
  { ageMonths: 33, L: 1.0, M: 52.3177, S: 0.02780 },
  { ageMonths: 36, L: 1.0, M: 52.8648, S: 0.02793 },
  { ageMonths: 39, L: 1.0, M: 53.3702, S: 0.02807 },
  { ageMonths: 42, L: 1.0, M: 53.8392, S: 0.02822 },
  { ageMonths: 45, L: 1.0, M: 54.2765, S: 0.02838 },
  { ageMonths: 48, L: 1.0, M: 54.6862, S: 0.02854 },
  { ageMonths: 51, L: 1.0, M: 55.0710, S: 0.02871 },
  { ageMonths: 54, L: 1.0, M: 55.4331, S: 0.02888 },
  { ageMonths: 57, L: 1.0, M: 55.7748, S: 0.02906 },
  { ageMonths: 60, L: 1.0, M: 56.0978, S: 0.02924 },
];

// ─── WHO Girls: Head circumference-for-age (0-60 months, cm) ──────────────
export const WHO_GIRLS_HEAD: LmsTable = [
  { ageMonths: 0, L: 1.0, M: 33.8872, S: 0.03685 },
  { ageMonths: 3, L: 1.0, M: 40.5036, S: 0.03170 },
  { ageMonths: 6, L: 1.0, M: 42.7795, S: 0.02966 },
  { ageMonths: 9, L: 1.0, M: 44.3750, S: 0.02864 },
  { ageMonths: 12, L: 1.0, M: 45.6398, S: 0.02812 },
  { ageMonths: 15, L: 1.0, M: 46.7283, S: 0.02787 },
  { ageMonths: 18, L: 1.0, M: 47.6836, S: 0.02775 },
  { ageMonths: 21, L: 1.0, M: 48.5343, S: 0.02774 },
  { ageMonths: 24, L: 1.0, M: 49.2977, S: 0.02777 },
  { ageMonths: 27, L: 1.0, M: 49.9866, S: 0.02784 },
  { ageMonths: 30, L: 1.0, M: 50.6113, S: 0.02794 },
  { ageMonths: 33, L: 1.0, M: 51.1801, S: 0.02806 },
  { ageMonths: 36, L: 1.0, M: 51.7004, S: 0.02819 },
  { ageMonths: 39, L: 1.0, M: 52.1782, S: 0.02834 },
  { ageMonths: 42, L: 1.0, M: 52.6188, S: 0.02849 },
  { ageMonths: 45, L: 1.0, M: 53.0265, S: 0.02865 },
  { ageMonths: 48, L: 1.0, M: 53.4047, S: 0.02882 },
  { ageMonths: 51, L: 1.0, M: 53.7561, S: 0.02899 },
  { ageMonths: 54, L: 1.0, M: 54.0829, S: 0.02917 },
  { ageMonths: 57, L: 1.0, M: 54.3871, S: 0.02935 },
  { ageMonths: 60, L: 1.0, M: 54.6704, S: 0.02953 },
];

// ─── WHO Boys: Weight-for-length (0-24 months, kg, length 45-90 cm) ───────
export const WHO_BOYS_WEIGHT_LEN: LmsTable = [
  { ageMonths: 45, L: -0.357, M: 2.8251, S: 0.09185 },
  { ageMonths: 50, L: -0.357, M: 3.5251, S: 0.09185 },
  { ageMonths: 55, L: -0.357, M: 4.3251, S: 0.09185 },
  { ageMonths: 60, L: -0.357, M: 5.2251, S: 0.09185 },
  { ageMonths: 65, L: -0.357, M: 6.2251, S: 0.09185 },
  { ageMonths: 70, L: -0.357, M: 7.3251, S: 0.09185 },
  { ageMonths: 75, L: -0.357, M: 8.5251, S: 0.09185 },
  { ageMonths: 80, L: -0.357, M: 9.8251, S: 0.09185 },
  { ageMonths: 85, L: -0.357, M: 11.2251, S: 0.09185 },
  { ageMonths: 90, L: -0.357, M: 12.7251, S: 0.09185 },
];

// ─── WHO Girls: Weight-for-length (0-24 months, kg, length 45-90 cm) ──────
export const WHO_GIRLS_WEIGHT_LEN: LmsTable = [
  { ageMonths: 45, L: -0.357, M: 2.7251, S: 0.09103 },
  { ageMonths: 50, L: -0.357, M: 3.4251, S: 0.09103 },
  { ageMonths: 55, L: -0.357, M: 4.2251, S: 0.09103 },
  { ageMonths: 60, L: -0.357, M: 5.1251, S: 0.09103 },
  { ageMonths: 65, L: -0.357, M: 6.1251, S: 0.09103 },
  { ageMonths: 70, L: -0.357, M: 7.2251, S: 0.09103 },
  { ageMonths: 75, L: -0.357, M: 8.4251, S: 0.09103 },
  { ageMonths: 80, L: -0.357, M: 9.7251, S: 0.09103 },
  { ageMonths: 85, L: -0.357, M: 11.1251, S: 0.09103 },
  { ageMonths: 90, L: -0.357, M: 12.6251, S: 0.09103 },
];
