import { Injectable } from '@nestjs/common';
import { DenialRootCause } from './entities/denial-record.entity';

/**
 * Maps CARC (Claim Adjustment Reason Code) + RARC (Remittance Advice Remark Code)
 * combinations to root cause categories.
 *
 * This engine uses deterministic rules based on industry-standard mappings.
 * The CARC/RARC code master also carries a rootCauseCategory field that can
 * be used as a fallback.
 */
@Injectable()
export class DenialCategoryEngine {
  // CARC → root cause mapping (primary)
  private static readonly carcMapping: Record<string, DenialRootCause> = {
    // Eligibility / Coverage
    '1': DenialRootCause.PATIENT_RESPONSIBILITY, // deductible (PR group)
    '2': DenialRootCause.PATIENT_RESPONSIBILITY, // coinsurance (PR group)
    '3': DenialRootCause.PATIENT_RESPONSIBILITY, // copay (PR group)
    '48': DenialRootCause.NON_COVERED_SERVICE,
    '49': DenialRootCause.NON_COVERED_SERVICE,
    '55': DenialRootCause.NON_COVERED_SERVICE,
    '96': DenialRootCause.NON_COVERED_SERVICE,
    '109': DenialRootCause.WRONG_PAYER,
    '204': DenialRootCause.NON_COVERED_SERVICE,

    // Prior Authorization
    '197': DenialRootCause.PRIOR_AUTHORIZATION,
    '142': DenialRootCause.PRIOR_AUTHORIZATION,
    '198': DenialRootCause.PRIOR_AUTHORIZATION,

    // Medical Necessity
    '50': DenialRootCause.MEDICAL_NECESSITY,
    '151': DenialRootCause.MEDICAL_NECESSITY,
    '233': DenialRootCause.MEDICAL_NECESSITY,

    // Coding Errors
    '11': DenialRootCause.CODING_ERROR,
    '12': DenialRootCause.CODING_ERROR,
    '13': DenialRootCause.CODING_ERROR,
    '14': DenialRootCause.CODING_ERROR,
    '15': DenialRootCause.CODING_ERROR,

    // Missing Information
    '16': DenialRootCause.MISSING_INFORMATION,
    '17': DenialRootCause.MISSING_INFORMATION,
    '26': DenialRootCause.MISSING_INFORMATION,
    '27': DenialRootCause.MISSING_INFORMATION,

    // Duplicate
    '18': DenialRootCause.DUPLICATE,
    '72': DenialRootCause.DUPLICATE,

    // Timely Filing
    '29': DenialRootCause.TIMELY_FILING,

    // Coordination of Benefits
    '23': DenialRootCause.COORDINATION_OF_BENEFITS,
    '22': DenialRootCause.COORDINATION_OF_BENEFITS,

    // Bundling
    '97': DenialRootCause.BUNDLING,
    '234': DenialRootCause.BUNDLING,

    // Fee Schedule
    '45': DenialRootCause.FEE_SCHEDULE,

    // Benefit Maximum
    '119': DenialRootCause.BENEFIT_MAXIMUM,

    // Frequency Limit
    '243': DenialRootCause.FREQUENCY_LIMIT,
  };

  // RARC → root cause override (takes precedence when present)
  private static readonly rarcMapping: Record<string, DenialRootCause> = {
    'N5': DenialRootCause.PRIOR_AUTHORIZATION,
    'N657': DenialRootCause.PRIOR_AUTHORIZATION,
    'N386': DenialRootCause.MEDICAL_NECESSITY,
    'N280': DenialRootCause.MISSING_INFORMATION,
    'N56': DenialRootCause.CODING_ERROR,
    'M50': DenialRootCause.CODING_ERROR,
    'M76': DenialRootCause.CODING_ERROR,
    'M51': DenialRootCause.CODING_ERROR,
    'M127': DenialRootCause.MISSING_INFORMATION,
    'N522': DenialRootCause.DUPLICATE,
    'N362': DenialRootCause.FREQUENCY_LIMIT,
    'N59': DenialRootCause.BUNDLING,
    'N130': DenialRootCause.NON_COVERED_SERVICE,
    'MA130': DenialRootCause.MISSING_INFORMATION,
    'MA39': DenialRootCause.MISSING_INFORMATION,
    'MA42': DenialRootCause.MISSING_INFORMATION,
  };

  // CARC + RARC combination overrides (most specific)
  private static readonly combinationMapping: Record<string, DenialRootCause> = {
    '16+MA130': DenialRootCause.MISSING_INFORMATION,
    '16+N386': DenialRootCause.PRIOR_AUTHORIZATION,
    '16+M76': DenialRootCause.CODING_ERROR,
    '233+N386': DenialRootCause.MEDICAL_NECESSITY,
    '96+N130': DenialRootCause.NON_COVERED_SERVICE,
  };

  /**
   * Categorize a denial into a root cause category.
   * Priority: CARC+RARC combination > RARC alone > CARC alone > OTHER
   */
  categorize(
    carcCode: string,
    rarcCode?: string | null,
    groupCode?: string | null,
  ): DenialRootCause {
    // Check combination first
    if (rarcCode) {
      const comboKey = `${carcCode}+${rarcCode}`;
      const combo = DenialCategoryEngine.combinationMapping[comboKey];
      if (combo) return combo;
    }

    // Check RARC override
    if (rarcCode) {
      const rarcResult = DenialCategoryEngine.rarcMapping[rarcCode];
      if (rarcResult) return rarcResult;
    }

    // Check CARC
    const carcResult = DenialCategoryEngine.carcMapping[carcCode];
    if (carcResult) {
      // If group code is PR (patient responsibility), override to patient_responsibility
      if (groupCode === 'PR') {
        return DenialRootCause.PATIENT_RESPONSIBILITY;
      }
      return carcResult;
    }

    // If group code is PR, it's patient responsibility
    if (groupCode === 'PR') {
      return DenialRootCause.PATIENT_RESPONSIBILITY;
    }

    return DenialRootCause.OTHER;
  }

  /**
   * Get human-readable label for a root cause category.
   */
  getLabel(category: DenialRootCause): string {
    const labels: Record<DenialRootCause, string> = {
      [DenialRootCause.ELIGIBILITY]: 'Eligibility',
      [DenialRootCause.PRIOR_AUTHORIZATION]: 'Prior Authorization',
      [DenialRootCause.MEDICAL_NECESSITY]: 'Medical Necessity',
      [DenialRootCause.CODING_ERROR]: 'Coding Error',
      [DenialRootCause.MISSING_INFORMATION]: 'Missing Information',
      [DenialRootCause.DUPLICATE]: 'Duplicate Claim',
      [DenialRootCause.TIMELY_FILING]: 'Timely Filing',
      [DenialRootCause.COORDINATION_OF_BENEFITS]: 'Coordination of Benefits',
      [DenialRootCause.NON_COVERED_SERVICE]: 'Non-Covered Service',
      [DenialRootCause.BUNDLING]: 'Bundling/Unbundling',
      [DenialRootCause.FEE_SCHEDULE]: 'Fee Schedule',
      [DenialRootCause.BENEFIT_MAXIMUM]: 'Benefit Maximum',
      [DenialRootCause.FREQUENCY_LIMIT]: 'Frequency Limit',
      [DenialRootCause.WRONG_PAYER]: 'Wrong Payer',
      [DenialRootCause.PATIENT_RESPONSIBILITY]: 'Patient Responsibility',
      [DenialRootCause.OTHER]: 'Other',
    };
    return labels[category] || 'Other';
  }

  /**
   * Calculate denial priority based on root cause and denied amount.
   */
  calculatePriority(
    rootCause: DenialRootCause,
    deniedAmount: number,
    filingDeadline?: Date | null,
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: high-value denials with approaching deadline
    if (filingDeadline) {
      const daysLeft = Math.floor((filingDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 7 && deniedAmount > 500) return 'critical';
      if (daysLeft <= 14 && deniedAmount > 1000) return 'critical';
    }

    // High: high-value or high-recovery-probability categories
    if (deniedAmount > 2000) return 'high';
    if (
      rootCause === DenialRootCause.MEDICAL_NECESSITY ||
      rootCause === DenialRootCause.PRIOR_AUTHORIZATION ||
      rootCause === DenialRootCause.MISSING_INFORMATION
    ) {
      return deniedAmount > 500 ? 'high' : 'medium';
    }

    // Medium: moderate value
    if (deniedAmount > 200) return 'medium';

    // Low: small amounts or patient responsibility
    if (rootCause === DenialRootCause.PATIENT_RESPONSIBILITY) return 'low';
    return 'low';
  }
}
