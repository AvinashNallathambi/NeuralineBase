import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from '../clinical/entities/encounter.entity';
import { Patient } from '../patients/entities/patient.entity';
import {
  GrowthPercentileService,
  GrowthSex,
  GrowthMeasurement,
  PercentileResult,
} from './growth-percentile.service';
import { SpecialtyChart } from './data/specialty-lms.data';

export interface GrowthDataPoint {
  encounterId: string;
  encounterDate: string;
  ageMonths: number;
  adjustedAgeMonths: number;
  value: number;
  unit: string;
  percentile: number;
  zScore: number;
  source: string;
}

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
  sex: GrowthSex;
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
    weight: any[];
    height: any[];
    headCircumference: any[];
    bmi: any[];
  };
  velocity: GrowthVelocity[];
}

@Injectable()
export class GrowthChartService {
  private readonly logger = new Logger(GrowthChartService.name);

  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly percentileService: GrowthPercentileService,
  ) {}

  async getGrowthChart(
    tenantId: string,
    patientId: string,
    specialty?: SpecialtyChart,
  ): Promise<GrowthChartResponse> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, tenantId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const sex: GrowthSex = patient.gender === 'female' ? 'female' : 'male';
    const dob = new Date(patient.dateOfBirth);
    const gestationalAgeWeeks = (patient as any).gestationalAgeWeeks;

    // Fetch all encounters with vitals
    const encounters = await this.encounterRepository.find({
      where: { patientId, tenantId },
      order: { startTime: 'ASC' },
    });

    // Extract growth data points from encounter vitals
    const weightPoints: GrowthDataPoint[] = [];
    const heightPoints: GrowthDataPoint[] = [];
    const headPoints: GrowthDataPoint[] = [];
    const bmiPoints: GrowthDataPoint[] = [];

    for (const enc of encounters) {
      if (!enc.vitals) continue;
      const v = enc.vitals;
      const measurementDate = v.recordedDate ? new Date(v.recordedDate) : new Date(enc.startTime);

      // Weight
      if (v.weight) {
        const weightValue = parseFloat(v.weight);
        if (!isNaN(weightValue) && weightValue > 0) {
          const weightKg = this.normalizeWeight(weightValue, v.weightUnit);
          const result = this.percentileService.calculatePercentile(
            sex, 'weight', weightKg, dob, measurementDate, gestationalAgeWeeks, specialty,
          );
          if (result) {
            weightPoints.push(this.toDataPoint(enc.id, measurementDate, weightKg, v.weightUnit || 'kg', result));
          }
        }
      }

      // Height/Length
      if (v.height) {
        const heightValue = parseFloat(v.height);
        if (!isNaN(heightValue) && heightValue > 0) {
          const heightCm = this.normalizeHeight(heightValue, v.heightUnit);
          const result = this.percentileService.calculatePercentile(
            sex, 'height', heightCm, dob, measurementDate, gestationalAgeWeeks, specialty,
          );
          if (result) {
            heightPoints.push(this.toDataPoint(enc.id, measurementDate, heightCm, v.heightUnit || 'cm', result));
          }
        }
      }

      // Head circumference
      if (v.headCircumference) {
        const headValue = parseFloat(v.headCircumference);
        if (!isNaN(headValue) && headValue > 0) {
          const headCm = this.normalizeHeight(headValue, 'cm'); // head circ is always cm
          const result = this.percentileService.calculatePercentile(
            sex, 'head-circumference', headCm, dob, measurementDate, gestationalAgeWeeks, specialty,
          );
          if (result) {
            headPoints.push(this.toDataPoint(enc.id, measurementDate, headCm, 'cm', result));
          }
        }
      }

      // BMI
      if (v.bmi) {
        const bmiValue = parseFloat(v.bmi);
        if (!isNaN(bmiValue) && bmiValue > 0) {
          const result = this.percentileService.calculatePercentile(
            sex, 'bmi', bmiValue, dob, measurementDate, gestationalAgeWeeks, specialty,
          );
          if (result) {
            bmiPoints.push(this.toDataPoint(enc.id, measurementDate, bmiValue, 'kg/m²', result));
          }
        }
      }
    }

    // Calculate age range for percentile curves
    const now = new Date();
    const currentAgeMonths = this.percentileService.calculateAgeMonths(dob, now);
    const fromAge = 0;
    const toAge = Math.min(Math.max(currentAgeMonths + 6, 24), 240);

    // Generate percentile curves
    const percentileCurves = {
      weight: this.percentileService.generatePercentileCurves(sex, 'weight', fromAge, toAge, specialty),
      height: this.percentileService.generatePercentileCurves(sex, 'height', fromAge, toAge, specialty),
      headCircumference: this.percentileService.generatePercentileCurves(sex, 'head-circumference', fromAge, Math.min(toAge, 60), specialty),
      bmi: this.percentileService.generatePercentileCurves(sex, 'bmi', Math.max(fromAge, 24), toAge, specialty),
    };

    // Mid-parental height
    const fatherHeightCm = (patient as any).fatherHeightCm;
    const motherHeightCm = (patient as any).motherHeightCm;
    const midParentalHeight = this.percentileService.calculateMidParentalHeight(sex, fatherHeightCm, motherHeightCm);

    // Calculate growth velocity
    const velocity = this.calculateVelocity(weightPoints, heightPoints, headPoints);

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      dateOfBirth: dob.toISOString().split('T')[0],
      sex,
      gestationalAgeWeeks,
      fatherHeightCm,
      motherHeightCm,
      midParentalHeight,
      specialty,
      measurements: {
        weight: weightPoints,
        height: heightPoints,
        headCircumference: headPoints,
        bmi: bmiPoints,
      },
      percentileCurves,
      velocity,
    };
  }

  private calculateVelocity(
    weightPoints: GrowthDataPoint[],
    heightPoints: GrowthDataPoint[],
    headPoints: GrowthDataPoint[],
  ): GrowthVelocity[] {
    const velocities: GrowthVelocity[] = [];

    const calc = (points: GrowthDataPoint[], measurement: string, unit: string): GrowthVelocity | null => {
      if (points.length < 2) return null;
      const sorted = [...points].sort((a, b) => a.ageMonths - b.ageMonths);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const monthsDiff = last.ageMonths - first.ageMonths;
      if (monthsDiff < 1) return null;
      const valueDiff = last.value - first.value;
      const perYear = (valueDiff / monthsDiff) * 12;

      // Assessment thresholds (simplified)
      let assessment: 'normal' | 'slow' | 'rapid' | 'insufficient-data' = 'normal';
      if (measurement === 'height') {
        if (last.ageMonths > 24 && perYear < 5) assessment = 'slow';
        else if (last.ageMonths <= 24 && perYear < 10) assessment = 'slow';
      } else if (measurement === 'weight') {
        if (perYear < 1 && last.ageMonths > 12) assessment = 'slow';
      }

      return {
        measurement,
        valuePerYear: Math.round(perYear * 100) / 100,
        unit: `${unit}/year`,
        period: `${first.ageMonths} to ${last.ageMonths} months`,
        assessment,
      };
    };

    const wv = calc(weightPoints, 'weight', 'kg');
    if (wv) velocities.push(wv);
    const hv = calc(heightPoints, 'height', 'cm');
    if (hv) velocities.push(hv);
    const hv2 = calc(headPoints, 'head-circumference', 'cm');
    if (hv2) velocities.push(hv2);

    return velocities;
  }

  private toDataPoint(
    encounterId: string,
    date: Date,
    value: number,
    unit: string,
    result: PercentileResult,
  ): GrowthDataPoint {
    return {
      encounterId,
      encounterDate: date.toISOString().split('T')[0],
      ageMonths: result.chronologicalAgeMonths,
      adjustedAgeMonths: result.adjustedAgeMonths,
      value: Math.round(value * 100) / 100,
      unit,
      percentile: result.percentile,
      zScore: result.zScore,
      source: result.source as 'WHO' | 'CDC',
    };
  }

  private normalizeWeight(value: number, unit?: string): number {
    if (!unit || unit.toLowerCase().includes('kg')) return value;
    if (unit.toLowerCase().includes('lb')) return value * 0.453592;
    if (unit.toLowerCase().includes('g')) return value / 1000;
    return value;
  }

  private normalizeHeight(value: number, unit?: string): number {
    if (!unit || unit.toLowerCase().includes('cm')) return value;
    if (unit.toLowerCase().includes('in')) return value * 2.54;
    if (unit.toLowerCase().includes('m')) return value * 100;
    return value;
  }
}
