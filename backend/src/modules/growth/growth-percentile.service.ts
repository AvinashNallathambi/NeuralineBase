import { Injectable, Logger } from '@nestjs/common';
import { LmsTable } from './data/who-lms.data';
import {
  WHO_BOYS_WEIGHT, WHO_GIRLS_WEIGHT,
  WHO_BOYS_LENGTH, WHO_GIRLS_LENGTH,
  WHO_BOYS_HEIGHT, WHO_GIRLS_HEIGHT,
  WHO_BOYS_HEAD, WHO_GIRLS_HEAD,
} from './data/who-lms.data';
import {
  CDC_BOYS_WEIGHT, CDC_GIRLS_WEIGHT,
  CDC_BOYS_HEIGHT, CDC_GIRLS_HEIGHT,
  CDC_BOYS_BMI, CDC_GIRLS_BMI,
} from './data/cdc-lms.data';
import {
  SpecialtyChart,
  DS_BOYS_HEIGHT, DS_GIRLS_HEIGHT,
  DS_BOYS_WEIGHT, DS_GIRLS_WEIGHT,
  ACH_BOYS_HEIGHT, ACH_GIRLS_HEIGHT,
  TS_GIRLS_HEIGHT,
} from './data/specialty-lms.data';

export type GrowthSex = 'male' | 'female';
export type GrowthMeasurement = 'weight' | 'height' | 'head-circumference' | 'bmi';

export interface PercentileResult {
  zScore: number;
  percentile: number;
  /** Which reference table was used */
  source: string;
  /** Age in months (adjusted for prematurity if applicable) */
  adjustedAgeMonths: number;
  /** Chronological age in months */
  chronologicalAgeMonths: number;
}

@Injectable()
export class GrowthPercentileService {
  private readonly logger = new Logger(GrowthPercentileService.name);

  /**
   * Calculate age in months from date of birth and measurement date.
   */
  calculateAgeMonths(dateOfBirth: Date, measurementDate: Date): number {
    const dob = new Date(dateOfBirth);
    const md = new Date(measurementDate);
    const yearDiff = md.getFullYear() - dob.getFullYear();
    const monthDiff = md.getMonth() - dob.getMonth();
    const dayDiff = md.getDate() - dob.getDate();
    let months = yearDiff * 12 + monthDiff;
    if (dayDiff < 0) months -= 1;
    return Math.max(0, months);
  }

  /**
   * Calculate adjusted age for premature infants.
   * @param chronologicalAgeMonths Chronological age in months
   * @param gestationalAgeWeeks Gestational age at birth in weeks (37+ = term)
   * @returns Adjusted age in months (for first 2 years)
   */
  calculateAdjustedAge(chronologicalAgeMonths: number, gestationalAgeWeeks?: number): number {
    if (!gestationalAgeWeeks || gestationalAgeWeeks >= 37) return chronologicalAgeMonths;
    // Only adjust for first 24 months (standard clinical practice)
    if (chronologicalAgeMonths > 24) return chronologicalAgeMonths;
    const weeksEarly = 40 - gestationalAgeWeeks;
    const adjustmentMonths = weeksEarly / 4.345; // average weeks per month
    const adjusted = chronologicalAgeMonths - adjustmentMonths;
    return Math.max(0, adjusted);
  }

  /**
   * Select the appropriate LMS table based on sex, measurement, and age.
   * WHO charts: 0-24 months (length), 24-60 months (height), 0-60 months (weight, head)
   * CDC charts: 24-240 months (weight, height, BMI)
   * Specialty charts override standard charts when specified.
   */
  private selectTable(sex: GrowthSex, measurement: GrowthMeasurement, ageMonths: number, specialty?: SpecialtyChart): { table: LmsTable; source: 'WHO' | 'CDC' | string } | null {
    const isBoy = sex === 'male';

    // Specialty charts take precedence
    if (specialty === 'down-syndrome') {
      if (measurement === 'height' && ageMonths <= 36) {
        return { table: isBoy ? DS_BOYS_HEIGHT : DS_GIRLS_HEIGHT, source: 'DS-Height' };
      }
      if (measurement === 'weight' && ageMonths <= 36) {
        return { table: isBoy ? DS_BOYS_WEIGHT : DS_GIRLS_WEIGHT, source: 'DS-Weight' };
      }
      // Fall through to standard charts for measurements/ages not covered
    }
    if (specialty === 'achondroplasia') {
      if (measurement === 'height' && ageMonths <= 36) {
        return { table: isBoy ? ACH_BOYS_HEIGHT : ACH_GIRLS_HEIGHT, source: 'ACH-Height' };
      }
      // Weight and other measurements fall through to standard
    }
    if (specialty === 'turner-syndrome' && sex === 'female') {
      if (measurement === 'height') {
        return { table: TS_GIRLS_HEIGHT, source: 'TS-Height' };
      }
      // Weight falls through to standard
    }

    if (measurement === 'weight') {
      if (ageMonths <= 60) {
        return { table: isBoy ? WHO_BOYS_WEIGHT : WHO_GIRLS_WEIGHT, source: 'WHO' };
      }
      return { table: isBoy ? CDC_BOYS_WEIGHT : CDC_GIRLS_WEIGHT, source: 'CDC' };
    }

    if (measurement === 'height') {
      if (ageMonths < 24) {
        return { table: isBoy ? WHO_BOYS_LENGTH : WHO_GIRLS_LENGTH, source: 'WHO' };
      }
      if (ageMonths <= 60) {
        return { table: isBoy ? WHO_BOYS_HEIGHT : WHO_GIRLS_HEIGHT, source: 'WHO' };
      }
      return { table: isBoy ? CDC_BOYS_HEIGHT : CDC_GIRLS_HEIGHT, source: 'CDC' };
    }

    if (measurement === 'head-circumference') {
      if (ageMonths <= 60) {
        return { table: isBoy ? WHO_BOYS_HEAD : WHO_GIRLS_HEAD, source: 'WHO' };
      }
      // Head circumference not typically charted after age 3 (36 months)
      // but WHO data goes to 60 months. After 60, no reference.
      return null;
    }

    if (measurement === 'bmi') {
      if (ageMonths >= 24) {
        return { table: isBoy ? CDC_BOYS_BMI : CDC_GIRLS_BMI, source: 'CDC' };
      }
      // WHO BMI-for-age (2-5 years) — use CDC as approximation for 24-60 months
      // For < 24 months, BMI percentile is not typically calculated
      return null;
    }

    return null;
  }

  /**
   * Linear interpolation between two LMS rows.
   */
  private interpolateLms(table: LmsTable, ageMonths: number): { L: number; M: number; S: number } | null {
    if (table.length === 0) return null;

    // Before first data point
    if (ageMonths <= table[0].ageMonths) {
      return { L: table[0].L, M: table[0].M, S: table[0].S };
    }

    // After last data point
    const last = table[table.length - 1];
    if (ageMonths >= last.ageMonths) {
      return { L: last.L, M: last.M, S: last.S };
    }

    // Find surrounding rows
    for (let i = 0; i < table.length - 1; i++) {
      const lower = table[i];
      const upper = table[i + 1];
      if (ageMonths >= lower.ageMonths && ageMonths <= upper.ageMonths) {
        const ratio = (ageMonths - lower.ageMonths) / (upper.ageMonths - lower.ageMonths);
        return {
          L: lower.L + (upper.L - lower.L) * ratio,
          M: lower.M + (upper.M - lower.M) * ratio,
          S: lower.S + (upper.S - lower.S) * ratio,
        };
      }
    }

    return null;
  }

  /**
   * Calculate z-score from LMS parameters and a measured value.
   * Z = ((value/M)^L - 1) / (L * S)  when L != 0
   * Z = ln(value/M) / S              when L == 0
   */
  private calculateZScore(value: number, L: number, M: number, S: number): number {
    if (L === 0) {
      return Math.log(value / M) / S;
    }
    return (Math.pow(value / M, L) - 1) / (L * S);
  }

  /**
   * Convert z-score to percentile using the standard normal CDF approximation.
   */
  private zScoreToPercentile(z: number): number {
    // Abramowitz & Stegun approximation of the standard normal CDF
    const absZ = Math.abs(z);
    const t = 1 / (1 + 0.2316419 * absZ);
    const d = 0.3989423 * Math.exp(-absZ * absZ / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    const cdf = z >= 0 ? 1 - p : p;
    return Math.round(cdf * 1000) / 10; // one decimal place
  }

  /**
   * Calculate percentile for a single measurement.
   */
  calculatePercentile(
    sex: GrowthSex,
    measurement: GrowthMeasurement,
    value: number,
    dateOfBirth: Date,
    measurementDate: Date,
    gestationalAgeWeeks?: number,
    specialty?: SpecialtyChart,
  ): PercentileResult | null {
    const chronologicalAge = this.calculateAgeMonths(dateOfBirth, measurementDate);
    const adjustedAge = this.calculateAdjustedAge(chronologicalAge, gestationalAgeWeeks);

    // Use adjusted age for chart selection (standard practice for preemies < 2 years)
    const ageForChart = adjustedAge;

    const selection = this.selectTable(sex, measurement, ageForChart, specialty);
    if (!selection) {
      this.logger.debug(`No reference table for ${measurement} at age ${ageForChart} months`);
      return null;
    }

    const lms = this.interpolateLms(selection.table, ageForChart);
    if (!lms) return null;

    const zScore = this.calculateZScore(value, lms.L, lms.M, lms.S);
    const percentile = this.zScoreToPercentile(zScore);

    return {
      zScore: Math.round(zScore * 100) / 100,
      percentile,
      source: selection.source as string,
      adjustedAgeMonths: Math.round(adjustedAge * 10) / 10,
      chronologicalAgeMonths: chronologicalAge,
    };
  }

  /**
   * Generate percentile curve data for charting.
   * Returns the 3rd, 5th, 10th, 25th, 50th, 75th, 90th, 95th, 97th percentile values
   * across the age range.
   */
  generatePercentileCurves(
    sex: GrowthSex,
    measurement: GrowthMeasurement,
    fromAgeMonths: number,
    toAgeMonths: number,
    specialty?: SpecialtyChart,
  ): Array<{ ageMonths: number; p3: number; p5: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number; p97: number }> {
    const result: Array<any> = [];
    const step = toAgeMonths <= 24 ? 1 : toAgeMonths <= 60 ? 3 : 6;

    for (let age = fromAgeMonths; age <= toAgeMonths; age += step) {
      const selection = this.selectTable(sex, measurement, age, specialty);
      if (!selection) continue;

      const lms = this.interpolateLms(selection.table, age);
      if (!lms) continue;

      const percentiles = [3, 5, 10, 25, 50, 75, 90, 95, 97];
      const zScores = percentiles.map((p) => this.percentileToZScore(p));
      const values = zScores.map((z) => this.zScoreToValue(z, lms.L, lms.M, lms.S));

      result.push({
        ageMonths: age,
        p3: Math.round(values[0] * 10) / 10,
        p5: Math.round(values[1] * 10) / 10,
        p10: Math.round(values[2] * 10) / 10,
        p25: Math.round(values[3] * 10) / 10,
        p50: Math.round(values[4] * 10) / 10,
        p75: Math.round(values[5] * 10) / 10,
        p90: Math.round(values[6] * 10) / 10,
        p95: Math.round(values[7] * 10) / 10,
        p97: Math.round(values[8] * 10) / 10,
      });
    }

    return result;
  }

  /**
   * Convert percentile to z-score (inverse of the normal CDF).
   */
  private percentileToZScore(percentile: number): number {
    // Beasley-Springer-Moro approximation for the inverse normal CDF
    const p = percentile / 100;
    const a = [-3.969683028665376e+01, 2.209460983245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161237e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q: number;
    let z: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      const r = q * q;
      z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    return z;
  }

  /**
   * Convert z-score back to a measurement value using LMS.
   * value = M * (1 + L * S * Z)^(1/L)  when L != 0
   * value = M * exp(S * Z)             when L == 0
   */
  private zScoreToValue(z: number, L: number, M: number, S: number): number {
    if (L === 0) {
      return M * Math.exp(S * z);
    }
    return M * Math.pow(1 + L * S * z, 1 / L);
  }

  /**
   * Calculate mid-parental height (target height).
   * Boys: (fatherHeight + motherHeight) / 2 + 6.5 cm
   * Girls: (fatherHeight + motherHeight) / 2 - 6.5 cm
   */
  calculateMidParentalHeight(sex: GrowthSex, fatherHeightCm?: number, motherHeightCm?: number): { targetHeightCm: number; rangeLowCm: number; rangeHighCm: number } | null {
    if (!fatherHeightCm || !motherHeightCm) return null;
    const midParent = (fatherHeightCm + motherHeightCm) / 2;
    const adjustment = sex === 'male' ? 6.5 : -6.5;
    const targetHeight = midParent + adjustment;
    // ± 8.5 cm covers ~2 SD (90% range)
    return {
      targetHeightCm: Math.round(targetHeight * 10) / 10,
      rangeLowCm: Math.round((targetHeight - 8.5) * 10) / 10,
      rangeHighCm: Math.round((targetHeight + 8.5) * 10) / 10,
    };
  }
}
