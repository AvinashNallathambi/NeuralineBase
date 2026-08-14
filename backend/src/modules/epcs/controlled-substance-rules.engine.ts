import { Injectable, BadRequestException } from '@nestjs/common';
import { DeaSchedule } from '../prescriptions/entities/prescription.entity';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ControlledSubstanceRule {
  schedule: DeaSchedule;
  /** Maximum refills allowed (0 for Schedule II) */
  maxRefills: number;
  /** Maximum quantity per fill (null = no federal limit) */
  maxQuantityPerFill: number | null;
  /** Maximum days supply per fill */
  maxDaysSupply: number | null;
  /** Whether the prescription can be faxed */
  canFax: boolean;
  /** Whether partial fills are allowed */
  allowPartialFill: boolean;
  /** Whether refills require a new prescription */
  refillsRequireNewRx: boolean;
  /** Description for display */
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  schedule: DeaSchedule;
  rule: ControlledSubstanceRule;
}

export interface QuantityCheckResult {
  withinGuidelines: boolean;
  recommendedQuantity: number | null;
  recommendedDuration: string | null;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  cdcGuideline: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controlled Substance Schedule Rules (Federal — 21 CFR 1306)
// ─────────────────────────────────────────────────────────────────────────────

const FEDERAL_RULES: Record<DeaSchedule, ControlledSubstanceRule> = {
  II: {
    schedule: 'II',
    maxRefills: 0, // No refills for Schedule II (21 CFR 1306.12)
    maxQuantityPerFill: null, // No federal quantity limit, but state limits apply
    maxDaysSupply: null,
    canFax: false, // Cannot fax Schedule II (except for hospice/nursing home)
    allowPartialFill: true, // Partial fill allowed (21 CFR 1306.13)
    refillsRequireNewRx: true,
    description: 'Schedule II — No refills permitted. New prescription required for each fill.',
  },
  III: {
    schedule: 'III',
    maxRefills: 5, // Up to 5 refills within 6 months (21 CFR 1306.22)
    maxQuantityPerFill: null,
    maxDaysSupply: 180, // 6 months max including refills
    canFax: true,
    allowPartialFill: false,
    refillsRequireNewRx: false,
    description: 'Schedule III — Up to 5 refills within 6 months.',
  },
  IV: {
    schedule: 'IV',
    maxRefills: 5, // Up to 5 refills within 6 months (21 CFR 1306.23)
    maxQuantityPerFill: null,
    maxDaysSupply: 180,
    canFax: true,
    allowPartialFill: false,
    refillsRequireNewRx: false,
    description: 'Schedule IV — Up to 5 refills within 6 months.',
  },
  V: {
    schedule: 'V',
    maxRefills: 5, // Up to 5 refills within 6 months (21 CFR 1306.24)
    maxQuantityPerFill: null,
    maxDaysSupply: 180,
    canFax: true,
    allowPartialFill: false,
    refillsRequireNewRx: false,
    description: 'Schedule V — Up to 5 refills within 6 months.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// State-Specific Overrides
// ─────────────────────────────────────────────────────────────────────────────

interface StateOverride {
  maxQuantityPerFill?: number | null;
  maxDaysSupply?: number | null;
  maxRefills?: number;
  pdmpRequired?: boolean;
  pdmpQueryThreshold?: number; // Query PDMP if prescribing > N CS in a period
  naloxoneCoPrescribeMme?: number; // Co-prescribe naloxone if MME > threshold
  maxMmePerDay?: number; // State MME cap
}

const STATE_OVERRIDES: Record<string, StateOverride> = {
  // New York — strict EPCS mandate, PDMP required
  NY: { pdmpRequired: true, maxMmePerDay: 90, naloxoneCoPrescribeMme: 50 },
  // Florida — EPCS mandate, PDMP required
  FL: { pdmpRequired: true, maxMmePerDay: 90, naloxoneCoPrescribeMme: 50 },
  // Texas — PDMP required, MME limits
  TX: { pdmpRequired: true, maxMmePerDay: 90 },
  // Ohio — PDMP required, strict opioid limits
  OH: { pdmpRequired: true, maxMmePerDay: 90, naloxoneCoPrescribeMme: 50 },
  // North Carolina — EPCS mandate, PDMP required
  NC: { pdmpRequired: true, maxMmePerDay: 90 },
  // Arizona — EPCS mandate
  AZ: { pdmpRequired: true, maxMmePerDay: 90 },
  // Massachusetts — strict opioid limits
  MA: { pdmpRequired: true, maxMmePerDay: 50, naloxoneCoPrescribeMme: 50 },
  // Maine — 30 MME/day for acute pain
  ME: { pdmpRequired: true, maxMmePerDay: 30, naloxoneCoPrescribeMme: 50 },
};

// ─────────────────────────────────────────────────────────────────────────────
// CDC Opioid Prescribing Guidelines
// ─────────────────────────────────────────────────────────────────────────────

const CDC_ACUTE_PAIN_MAX_DAYS = 7;
const CDC_ACUTE_PAIN_MAX_QUANTITY = 21; // 3x daily for 7 days
const CDC_MME_DANGER_THRESHOLD = 50;
const CDC_MME_HIGH_RISK_THRESHOLD = 90;
const CDC_BENZO_OPIOID_WARNING = 'Benzodiazepine + opioid co-prescribing increases overdose risk 4x';

// ─────────────────────────────────────────────────────────────────────────────
// Common Controlled Substances — for medication lookup
// ─────────────────────────────────────────────────────────────────────────────

export interface ControlledSubstanceInfo {
  name: string;
  genericName: string;
  schedule: DeaSchedule;
  deaClass: string;
  commonStrengths: string[];
  /** Morphine Milligram Equivalents per unit (for opioids) */
  mmePerUnit?: number;
  /** Whether this is an opioid */
  isOpioid: boolean;
  /** Whether this is a benzodiazepine */
  isBenzodiazepine: boolean;
  /** Typical units (tablet, capsule, mL, etc.) */
  unit: string;
}

const CONTROLLED_SUBSTANCES: ControlledSubstanceInfo[] = [
  // ── Schedule II Opioids ──────────────────────────────────────────────────
  { name: 'OxyContin', genericName: 'oxycodone', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['10mg', '15mg', '20mg', '30mg', '40mg', '60mg', '80mg'], mmePerUnit: 1.5, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Percocet', genericName: 'oxycodone/acetaminophen', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['2.5/325mg', '5/325mg', '7.5/325mg', '10/325mg'], mmePerUnit: 1.5, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Oxycodone', genericName: 'oxycodone', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['5mg', '10mg', '15mg', '20mg', '30mg'], mmePerUnit: 1.5, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Hydrocodone', genericName: 'hydrocodone', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['5mg', '7.5mg', '10mg'], mmePerUnit: 1.0, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Vicodin', genericName: 'hydrocodone/acetaminophen', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['5/300mg', '5/325mg', '10/325mg'], mmePerUnit: 1.0, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Norco', genericName: 'hydrocodone/acetaminophen', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['5/325mg', '7.5/325mg', '10/325mg'], mmePerUnit: 1.0, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Morphine', genericName: 'morphine', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['15mg', '30mg', '60mg', '100mg'], mmePerUnit: 1.0, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'MS Contin', genericName: 'morphine ER', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['15mg', '30mg', '60mg', '100mg', '200mg'], mmePerUnit: 1.0, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Fentanyl', genericName: 'fentanyl', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['12mcg/h', '25mcg/h', '50mcg/h', '75mcg/h', '100mcg/h'], mmePerUnit: 7.2, isOpioid: true, isBenzodiazepine: false, unit: 'patch' },
  { name: 'Dilaudid', genericName: 'hydromorphone', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['2mg', '4mg', '8mg'], mmePerUnit: 4.0, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Opana', genericName: 'oxymorphone', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['5mg', '10mg', '15mg', '20mg', '30mg', '40mg'], mmePerUnit: 3.0, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Methadone', genericName: 'methadone', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['5mg', '10mg'], mmePerUnit: 4.7, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Codeine', genericName: 'codeine', schedule: 'II', deaClass: 'Opioid', commonStrengths: ['15mg', '30mg', '60mg'], mmePerUnit: 0.15, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },

  // ── Schedule II Stimulants ───────────────────────────────────────────────
  { name: 'Adderall', genericName: 'amphetamine/dextroamphetamine', schedule: 'II', deaClass: 'Stimulant', commonStrengths: ['5mg', '10mg', '15mg', '20mg', '30mg'], isOpioid: false, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Ritalin', genericName: 'methylphenidate', schedule: 'II', deaClass: 'Stimulant', commonStrengths: ['5mg', '10mg', '20mg'], isOpioid: false, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Concerta', genericName: 'methylphenidate ER', schedule: 'II', deaClass: 'Stimulant', commonStrengths: ['18mg', '27mg', '36mg', '54mg'], isOpioid: false, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Vyvanse', genericName: 'lisdexamfetamine', schedule: 'II', deaClass: 'Stimulant', commonStrengths: ['20mg', '30mg', '40mg', '50mg', '60mg', '70mg'], isOpioid: false, isBenzodiazepine: false, unit: 'capsule' },

  // ── Schedule III ─────────────────────────────────────────────────────────
  { name: 'Tylenol with Codeine', genericName: 'acetaminophen/codeine', schedule: 'III', deaClass: 'Opioid', commonStrengths: ['300/15mg', '300/30mg', '300/60mg'], mmePerUnit: 0.15, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Suboxone', genericName: 'buprenorphine/naloxone', schedule: 'III', deaClass: 'Opioid (MAT)', commonStrengths: ['2/0.5mg', '4/1mg', '8/2mg', '12/3mg'], mmePerUnit: 10.0, isOpioid: true, isBenzodiazepine: false, unit: 'sublingual' },
  { name: 'Buprenorphine', genericName: 'buprenorphine', schedule: 'III', deaClass: 'Opioid (MAT)', commonStrengths: ['2mg', '4mg', '8mg'], mmePerUnit: 10.0, isOpioid: true, isBenzodiazepine: false, unit: 'sublingual' },
  { name: 'Ketamine', genericName: 'ketamine', schedule: 'III', deaClass: 'Anesthetic', commonStrengths: ['10mg/mL', '50mg/mL'], isOpioid: false, isBenzodiazepine: false, unit: 'mL' },
  { name: 'Testosterone', genericName: 'testosterone', schedule: 'III', deaClass: 'Anabolic Steroid', commonStrengths: ['100mg/mL', '200mg/mL'], isOpioid: false, isBenzodiazepine: false, unit: 'mL' },

  // ── Schedule IV Benzodiazepines ──────────────────────────────────────────
  { name: 'Xanax', genericName: 'alprazolam', schedule: 'IV', deaClass: 'Benzodiazepine', commonStrengths: ['0.25mg', '0.5mg', '1mg', '2mg'], isOpioid: false, isBenzodiazepine: true, unit: 'tablet' },
  { name: 'Ativan', genericName: 'lorazepam', schedule: 'IV', deaClass: 'Benzodiazepine', commonStrengths: ['0.5mg', '1mg', '2mg'], isOpioid: false, isBenzodiazepine: true, unit: 'tablet' },
  { name: 'Valium', genericName: 'diazepam', schedule: 'IV', deaClass: 'Benzodiazepine', commonStrengths: ['2mg', '5mg', '10mg'], isOpioid: false, isBenzodiazepine: true, unit: 'tablet' },
  { name: 'Klonopin', genericName: 'clonazepam', schedule: 'IV', deaClass: 'Benzodiazepine', commonStrengths: ['0.5mg', '1mg', '2mg'], isOpioid: false, isBenzodiazepine: true, unit: 'tablet' },
  { name: 'Restoril', genericName: 'temazepam', schedule: 'IV', deaClass: 'Benzodiazepine', commonStrengths: ['7.5mg', '15mg', '30mg'], isOpioid: false, isBenzodiazepine: true, unit: 'capsule' },

  // ── Schedule IV Non-Benzo ────────────────────────────────────────────────
  { name: 'Ambien', genericName: 'zolpidem', schedule: 'IV', deaClass: 'Sedative', commonStrengths: ['5mg', '10mg'], isOpioid: false, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Tramadol', genericName: 'tramadol', schedule: 'IV', deaClass: 'Opioid', commonStrengths: ['50mg', '100mg'], mmePerUnit: 0.1, isOpioid: true, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Soma', genericName: 'carisoprodol', schedule: 'IV', deaClass: 'Muscle Relaxant', commonStrengths: ['250mg', '350mg'], isOpioid: false, isBenzodiazepine: false, unit: 'tablet' },

  // ── Schedule V ───────────────────────────────────────────────────────────
  { name: 'Lyrica', genericName: 'pregabalin', schedule: 'V', deaClass: 'Anticonvulsant', commonStrengths: ['25mg', '50mg', '75mg', '100mg', '150mg', '200mg', '300mg'], isOpioid: false, isBenzodiazepine: false, unit: 'capsule' },
  { name: 'Gabapentin Enacarbil', genericName: 'gabapentin enacarbil', schedule: 'V', deaClass: 'Anticonvulsant', commonStrengths: ['300mg', '600mg'], isOpioid: false, isBenzodiazepine: false, unit: 'tablet' },
  { name: 'Robitussin AC', genericName: 'guaifenesin/codeine', schedule: 'V', deaClass: 'Cough Suppressant', commonStrengths: ['100/10mg per 5mL'], mmePerUnit: 0.15, isOpioid: true, isBenzodiazepine: false, unit: 'mL' },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEA Number Validator (21 CFR 1306.02)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a DEA number using the DEA checksum algorithm.
 *
 * Format: 2 letters + 7 digits (e.g., AB1234563)
 * - First letter: A, B, F, G, M, P (registrant type)
 * - Second letter: registrant's last name initial
 * - Digits 1-5: serial number
 * - Digit 6: checksum
 *
 * Checksum algorithm:
 * 1. Sum digits 1, 3, 5 → sum1
 * 2. Sum digits 2, 4, 6, multiply by 2 → sum2
 * 3. Last digit of (sum1 + sum2) must equal digit 7
 */
export function validateDeaNumber(deaNumber: string): boolean {
  if (!deaNumber) return false;
  const cleaned = deaNumber.trim().toUpperCase();

  // Basic format check: 2 letters + 7 digits
  if (!/^[A-Z]{2}\d{7}$/.test(cleaned)) return false;

  // First letter must be a valid registrant type
  const validFirstLetters = ['A', 'B', 'F', 'G', 'M', 'P'];
  if (!validFirstLetters.includes(cleaned[0])) return false;

  // Checksum validation
  const digits = cleaned.substring(2).split('').map(Number);
  const sum1 = digits[0] + digits[2] + digits[4];
  const sum2 = (digits[1] + digits[3] + digits[5]) * 2;
  const checksum = (sum1 + sum2) % 10;

  return checksum === digits[6];
}

// ─────────────────────────────────────────────────────────────────────────────
// Rules Engine Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ControlledSubstanceRulesEngine {
  /**
   * Get the federal rule for a DEA schedule
   */
  getRule(schedule: DeaSchedule): ControlledSubstanceRule {
    return FEDERAL_RULES[schedule];
  }

  /**
   * Get state-specific override (merged with federal rule)
   */
  getRuleForState(schedule: DeaSchedule, state?: string | null): ControlledSubstanceRule & StateOverride {
    const federal = FEDERAL_RULES[schedule];
    const stateOverride = state ? STATE_OVERRIDES[state.toUpperCase()] || {} : {};
    return { ...federal, ...stateOverride };
  }

  /**
   * Validate a prescription against controlled substance rules
   */
  validate(
    schedule: DeaSchedule,
    quantity: number,
    refills: number,
    daysSupply: number | null,
    state?: string | null,
  ): ValidationResult {
    const rule = this.getRuleForState(schedule, state);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Refill validation
    if (refills > rule.maxRefills) {
      errors.push(
        `Schedule ${schedule} allows a maximum of ${rule.maxRefills} refills. Requested: ${refills}.`,
      );
    }

    // Quantity validation
    if (rule.maxQuantityPerFill && quantity > rule.maxQuantityPerFill) {
      errors.push(
        `Schedule ${schedule} in ${state} allows a maximum quantity of ${rule.maxQuantityPerFill} per fill. Requested: ${quantity}.`,
      );
    }

    // Days supply validation
    if (rule.maxDaysSupply && daysSupply && daysSupply > rule.maxDaysSupply) {
      errors.push(
        `Schedule ${schedule} allows a maximum ${rule.maxDaysSupply}-day supply. Requested: ${daysSupply} days.`,
      );
    }

    // PDMP warning
    if (rule.pdmpRequired) {
      warnings.push(`PDMP query is required in ${state} before prescribing Schedule ${schedule} controlled substances.`);
    }

    // Naloxone warning for opioids
    if (rule.naloxoneCoPrescribeMme) {
      warnings.push(
        `Consider co-prescribing naloxone for patients with MME > ${rule.naloxoneCoPrescribeMme}/day (required in ${state}).`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      schedule,
      rule,
    };
  }

  /**
   * Check quantity against CDC opioid prescribing guidelines
   */
  checkQuantity(
    medicationName: string,
    quantity: number,
    daysSupply: number | null,
    isAcutePain: boolean,
  ): QuantityCheckResult {
    const csInfo = this.findControlledSubstance(medicationName);

    if (!csInfo || !csInfo.isOpioid) {
      return {
        withinGuidelines: true,
        recommendedQuantity: null,
        recommendedDuration: null,
        message: 'Not an opioid — CDC opioid guidelines do not apply.',
        severity: 'info',
        cdcGuideline: 'N/A',
      };
    }

    if (isAcutePain) {
      // CDC: ≤3 days for acute pain, rarely >7 days
      if (daysSupply && daysSupply > CDC_ACUTE_PAIN_MAX_DAYS) {
        return {
          withinGuidelines: false,
          recommendedQuantity: CDC_ACUTE_PAIN_MAX_QUANTITY,
          recommendedDuration: `${CDC_ACUTE_PAIN_MAX_DAYS} days`,
          message: `CDC Guideline: For acute pain, ≤${CDC_ACUTE_PAIN_MAX_DAYS} days is typically sufficient. Quantity ${quantity} exceeds CDC recommendation by ${Math.round(((quantity - CDC_ACUTE_PAIN_MAX_QUANTITY) / CDC_ACUTE_PAIN_MAX_QUANTITY) * 100)}%.`,
          severity: 'critical',
          cdcGuideline: 'CDC Guideline for Prescribing Opioids — Acute Pain: ≤3 days, rarely >7 days',
        };
      }

      if (quantity > CDC_ACUTE_PAIN_MAX_QUANTITY * 1.5) {
        return {
          withinGuidelines: false,
          recommendedQuantity: CDC_ACUTE_PAIN_MAX_QUANTITY,
          recommendedDuration: `${CDC_ACUTE_PAIN_MAX_DAYS} days`,
          message: `CDC Guideline: Quantity ${quantity} significantly exceeds the recommended ${CDC_ACUTE_PAIN_MAX_QUANTITY} tablets for acute pain.`,
          severity: 'warning',
          cdcGuideline: 'CDC Guideline for Prescribing Opioids — Acute Pain',
        };
      }
    }

    return {
      withinGuidelines: true,
      recommendedQuantity: null,
      recommendedDuration: null,
      message: 'Quantity is within CDC guidelines.',
      severity: 'info',
      cdcGuideline: 'CDC Guideline for Prescribing Opioids',
    };
  }

  /**
   * Calculate Morphine Milligram Equivalents (MME) per day
   */
  calculateMme(
    medicationName: string,
    strength: number, // mg per unit
    quantityPerDay: number, // units per day
  ): number {
    const csInfo = this.findControlledSubstance(medicationName);
    if (!csInfo || !csInfo.mmePerUnit) return 0;

    return Math.round(strength * quantityPerDay * csInfo.mmePerUnit * 100) / 100;
  }

  /**
   * Get MME risk level
   */
  getMmeRiskLevel(mme: number): { level: string; message: string; recommendation: string } {
    if (mme >= CDC_MME_HIGH_RISK_THRESHOLD) {
      return {
        level: 'critical',
        message: `MME ${mme}/day exceeds the CDC high-risk threshold of ${CDC_MME_HIGH_RISK_THRESHOLD}.`,
        recommendation: 'Avoid increasing dose. Consider tapering. Co-prescribe naloxone.',
      };
    }
    if (mme >= CDC_MME_DANGER_THRESHOLD) {
      return {
        level: 'high',
        message: `MME ${mme}/day exceeds the CDC caution threshold of ${CDC_MME_DANGER_THRESHOLD}.`,
        recommendation: 'Carefully reassess need for continued opioid therapy. Consider naloxone.',
      };
    }
    return {
      level: 'moderate',
      message: `MME ${mme}/day is within the moderate range.`,
      recommendation: 'Continue monitoring. Reassess at each visit.',
    };
  }

  /**
   * Check for benzodiazepine + opioid co-prescribing risk
   */
  checkBenzodiazepineOpioidRisk(
    medications: Array<{ name: string; isControlledSubstance?: boolean }>,
  ): { atRisk: boolean; message: string; severity: 'info' | 'warning' | 'critical' } {
    const csMeds = medications.filter((m) => m.isControlledSubstance);
    if (csMeds.length === 0) return { atRisk: false, message: '', severity: 'info' };

    const hasOpioid = csMeds.some((m) => {
      const info = this.findControlledSubstance(m.name);
      return info?.isOpioid;
    });
    const hasBenzo = csMeds.some((m) => {
      const info = this.findControlledSubstance(m.name);
      return info?.isBenzodiazepine;
    });

    if (hasOpioid && hasBenzo) {
      return {
        atRisk: true,
        message: CDC_BENZO_OPIOID_WARNING,
        severity: 'critical',
      };
    }

    return { atRisk: false, message: '', severity: 'info' };
  }

  /**
   * Look up a controlled substance by brand or generic name
   */
  findControlledSubstance(name: string): ControlledSubstanceInfo | null {
    const lower = name.toLowerCase().trim();
    return (
      CONTROLLED_SUBSTANCES.find(
        (cs) =>
          cs.name.toLowerCase() === lower ||
          cs.genericName.toLowerCase() === lower ||
          cs.genericName.toLowerCase().includes(lower) ||
          lower.includes(cs.genericName.toLowerCase()),
      ) || null
    );
  }

  /**
   * Search controlled substances (for medication search autocomplete)
   */
  searchControlledSubstances(query: string, limit = 20): ControlledSubstanceInfo[] {
    const lower = query.toLowerCase().trim();
    if (!lower) return CONTROLLED_SUBSTANCES.slice(0, limit);
    return CONTROLLED_SUBSTANCES.filter(
      (cs) =>
        cs.name.toLowerCase().includes(lower) ||
        cs.genericName.toLowerCase().includes(lower) ||
        cs.deaClass.toLowerCase().includes(lower),
    ).slice(0, limit);
  }

  /**
   * Get all controlled substances for a given schedule
   */
  getBySchedule(schedule: DeaSchedule): ControlledSubstanceInfo[] {
    return CONTROLLED_SUBSTANCES.filter((cs) => cs.schedule === schedule);
  }

  /**
   * Check if a medication is a controlled substance and return its schedule
   */
  getScheduleForMedication(name: string): DeaSchedule | null {
    const cs = this.findControlledSubstance(name);
    return cs?.schedule || null;
  }

  /**
   * Get all states with EPCS mandates
   */
  getEpcsMandateStates(): string[] {
    return Object.keys(STATE_OVERRIDES);
  }

  /**
   * Check if PDMP query is required for a state
   */
  isPdmpRequired(state?: string | null): boolean {
    if (!state) return false;
    return !!STATE_OVERRIDES[state.toUpperCase()]?.pdmpRequired;
  }
}
