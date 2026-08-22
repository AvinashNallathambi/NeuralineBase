import { api } from './api';

export interface GrowthDataPoint {
  encounterId: string;
  encounterDate: string;
  ageMonths: number;
  adjustedAgeMonths: number;
  value: number;
  unit: string;
  percentile: number;
  zScore: number;
  source: 'WHO' | 'CDC';
}

export interface PercentileCurve {
  ageMonths: number;
  p3: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p97: number;
}

export type SpecialtyChart = 'down-syndrome' | 'achondroplasia' | 'turner-syndrome';

export interface GrowthVelocity {
  measurement: string;
  valuePerYear: number;
  unit: string;
  period: string;
  assessment: 'normal' | 'slow' | 'rapid' | 'insufficient-data';
}

export interface GrowthChartResponse {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  sex: 'male' | 'female';
  gestationalAgeWeeks?: number;
  fatherHeightCm?: number;
  motherHeightCm?: number;
  midParentalHeight?: { targetHeightCm: number; rangeLowCm: number; rangeHighCm: number } | null;
  specialty?: SpecialtyChart;
  measurements: {
    weight: GrowthDataPoint[];
    height: GrowthDataPoint[];
    headCircumference: GrowthDataPoint[];
    bmi: GrowthDataPoint[];
  };
  percentileCurves: {
    weight: PercentileCurve[];
    height: PercentileCurve[];
    headCircumference: PercentileCurve[];
    bmi: PercentileCurve[];
  };
  velocity: GrowthVelocity[];
}

export const growthService = {
  getGrowthChart: (patientId: string, specialty?: SpecialtyChart) =>
    api.get<GrowthChartResponse>(`/growth/chart/${patientId}${specialty ? `?specialty=${specialty}` : ''}`).then((r) => r.data),

  getSpecialtyCharts: () =>
    api.get<Array<{ value: SpecialtyChart; label: string }>>('/growth/specialty-charts').then((r) => r.data),

  portalGetMyGrowthChart: () =>
    api.get<GrowthChartResponse>('/patients/portal/growth-chart').then((r) => r.data),

  // ── AI Features ──
  assessGrowth: (data: {
    patientAgeMonths: number;
    patientSex: string;
    gestationalAgeWeeks?: number;
    weightMeasurements: Array<{ date: string; value: number; unit: string; percentile?: number }>;
    heightMeasurements: Array<{ date: string; value: number; unit: string; percentile?: number }>;
    headCircumferenceMeasurements?: Array<{ date: string; value: number; percentile?: number }>;
    bmiMeasurements?: Array<{ date: string; value: number; percentile?: number }>;
    conditions?: Array<{ condition: string; icd10Code?: string }>;
    midParentalHeight?: { targetHeightCm: number; rangeLowCm: number; rangeHighCm: number };
  }) => api.post('/ai/growth-assessment', data).then((r) => r.data),

  getCounseling: (data: {
    patientAgeMonths: number;
    patientSex: string;
    patientName?: string;
    weightPercentile?: number;
    heightPercentile?: number;
    headCircumferencePercentile?: number;
    bmiPercentile?: number;
    weightTrend?: string;
    heightTrend?: string;
    midParentalHeight?: { targetHeightCm: number; rangeLowCm: number; rangeHighCm: number };
    conditions?: Array<{ condition: string }>;
    language?: string;
  }) => api.post('/ai/growth-counseling', data).then((r) => r.data),
};
