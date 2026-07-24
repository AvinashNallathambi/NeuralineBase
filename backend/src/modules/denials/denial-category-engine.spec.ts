import { DenialCategoryEngine } from './denial-category-engine';
import { DenialRootCause, DenialPriority } from './entities/denial-record.entity';

/**
 * Unit tests for DenialCategoryEngine — the deterministic CARC/RARC → root
 * cause mapping engine.
 *
 * These tests are pure (no DB, no NestJS DI) and verify:
 *   1. CARC-only categorization (e.g., CO-197 → prior_authorization)
 *   2. RARC override precedence (RARC takes precedence over CARC alone)
 *   3. CARC+RARC combination overrides (highest precedence)
 *   4. PR group code → patient_responsibility override
 *   5. Unknown codes → OTHER
 *   6. Priority calculation based on root cause, amount, and filing deadline
 *   7. Human-readable labels for all root cause categories
 */
describe('DenialCategoryEngine', () => {
  let engine: DenialCategoryEngine;

  beforeEach(() => {
    engine = new DenialCategoryEngine();
  });

  describe('categorize()', () => {
    it('maps CARC 197 to prior_authorization', () => {
      expect(engine.categorize('197', null, 'CO')).toBe(DenialRootCause.PRIOR_AUTHORIZATION);
    });

    it('maps CARC 50 to medical_necessity', () => {
      expect(engine.categorize('50', null, 'CO')).toBe(DenialRootCause.MEDICAL_NECESSITY);
    });

    it('maps CARC 16 to missing_information', () => {
      expect(engine.categorize('16', null, 'CO')).toBe(DenialRootCause.MISSING_INFORMATION);
    });

    it('maps CARC 18 to duplicate', () => {
      expect(engine.categorize('18', null, 'CO')).toBe(DenialRootCause.DUPLICATE);
    });

    it('maps CARC 29 to timely_filing', () => {
      expect(engine.categorize('29', null, 'CO')).toBe(DenialRootCause.TIMELY_FILING);
    });

    it('maps CARC 45 to fee_schedule', () => {
      expect(engine.categorize('45', null, 'CO')).toBe(DenialRootCause.FEE_SCHEDULE);
    });

    it('maps CARC 97 to bundling', () => {
      expect(engine.categorize('97', null, 'CO')).toBe(DenialRootCause.BUNDLING);
    });

    it('maps CARC 96 to non_covered_service', () => {
      expect(engine.categorize('96', null, 'CO')).toBe(DenialRootCause.NON_COVERED_SERVICE);
    });

    it('maps CARC 119 to benefit_maximum', () => {
      expect(engine.categorize('119', null, 'CO')).toBe(DenialRootCause.BENEFIT_MAXIMUM);
    });

    it('maps CARC 109 to wrong_payer', () => {
      expect(engine.categorize('109', null, 'CO')).toBe(DenialRootCause.WRONG_PAYER);
    });

    it('maps CARC 23 to coordination_of_benefits', () => {
      expect(engine.categorize('23', null, 'CO')).toBe(DenialRootCause.COORDINATION_OF_BENEFITS);
    });

    it('returns OTHER for unknown CARC codes', () => {
      expect(engine.categorize('999', null, 'CO')).toBe(DenialRootCause.OTHER);
    });

    it('overrides to patient_responsibility when group code is PR', () => {
      // CARC 45 normally maps to fee_schedule, but with PR group it's patient responsibility
      expect(engine.categorize('45', null, 'PR')).toBe(DenialRootCause.PATIENT_RESPONSIBILITY);
    });

    it('returns patient_responsibility for PR group even with unknown CARC', () => {
      expect(engine.categorize('999', null, 'PR')).toBe(DenialRootCause.PATIENT_RESPONSIBILITY);
    });

    it('RARC override takes precedence over CARC alone', () => {
      // CARC 16 alone → missing_information
      // RARC N5 → prior_authorization (overrides)
      expect(engine.categorize('16', 'N5', 'CO')).toBe(DenialRootCause.PRIOR_AUTHORIZATION);
    });

    it('CARC+RARC combination takes highest precedence', () => {
      // 16+MA130 → missing_information (combination)
      expect(engine.categorize('16', 'MA130', 'CO')).toBe(DenialRootCause.MISSING_INFORMATION);
      // 16+N386 → prior_authorization (combination override)
      expect(engine.categorize('16', 'N386', 'CO')).toBe(DenialRootCause.PRIOR_AUTHORIZATION);
      // 16+M76 → coding_error (combination override)
      expect(engine.categorize('16', 'M76', 'CO')).toBe(DenialRootCause.CODING_ERROR);
    });

    it('RARC N522 maps to duplicate', () => {
      expect(engine.categorize('18', 'N522', 'CO')).toBe(DenialRootCause.DUPLICATE);
    });

    it('RARC N362 maps to frequency_limit', () => {
      expect(engine.categorize('243', 'N362', 'CO')).toBe(DenialRootCause.FREQUENCY_LIMIT);
    });
  });

  describe('getLabel()', () => {
    it('returns human-readable labels for all root cause categories', () => {
      expect(engine.getLabel(DenialRootCause.PRIOR_AUTHORIZATION)).toBe('Prior Authorization');
      expect(engine.getLabel(DenialRootCause.MEDICAL_NECESSITY)).toBe('Medical Necessity');
      expect(engine.getLabel(DenialRootCause.CODING_ERROR)).toBe('Coding Error');
      expect(engine.getLabel(DenialRootCause.MISSING_INFORMATION)).toBe('Missing Information');
      expect(engine.getLabel(DenialRootCause.DUPLICATE)).toBe('Duplicate Claim');
      expect(engine.getLabel(DenialRootCause.TIMELY_FILING)).toBe('Timely Filing');
      expect(engine.getLabel(DenialRootCause.COORDINATION_OF_BENEFITS)).toBe('Coordination of Benefits');
      expect(engine.getLabel(DenialRootCause.NON_COVERED_SERVICE)).toBe('Non-Covered Service');
      expect(engine.getLabel(DenialRootCause.BUNDLING)).toBe('Bundling/Unbundling');
      expect(engine.getLabel(DenialRootCause.FEE_SCHEDULE)).toBe('Fee Schedule');
      expect(engine.getLabel(DenialRootCause.BENEFIT_MAXIMUM)).toBe('Benefit Maximum');
      expect(engine.getLabel(DenialRootCause.FREQUENCY_LIMIT)).toBe('Frequency Limit');
      expect(engine.getLabel(DenialRootCause.WRONG_PAYER)).toBe('Wrong Payer');
      expect(engine.getLabel(DenialRootCause.PATIENT_RESPONSIBILITY)).toBe('Patient Responsibility');
      expect(engine.getLabel(DenialRootCause.ELIGIBILITY)).toBe('Eligibility');
      expect(engine.getLabel(DenialRootCause.OTHER)).toBe('Other');
    });
  });

  describe('calculatePriority()', () => {
    it('returns critical for high-value denial with deadline ≤ 7 days', () => {
      const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      const priority = engine.calculatePriority(DenialRootCause.MISSING_INFORMATION, 600, deadline);
      expect(priority).toBe('critical');
    });

    it('returns critical for very high-value denial with deadline ≤ 14 days', () => {
      const deadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
      const priority = engine.calculatePriority(DenialRootCause.OTHER, 1500, deadline);
      expect(priority).toBe('critical');
    });

    it('returns high for denied amount > $2000 regardless of root cause', () => {
      const priority = engine.calculatePriority(DenialRootCause.OTHER, 2500, null);
      expect(priority).toBe('high');
    });

    it('returns high for medical_necessity with amount > $500', () => {
      const priority = engine.calculatePriority(DenialRootCause.MEDICAL_NECESSITY, 750, null);
      expect(priority).toBe('high');
    });

    it('returns medium for medical_necessity with amount ≤ $500', () => {
      const priority = engine.calculatePriority(DenialRootCause.MEDICAL_NECESSITY, 300, null);
      expect(priority).toBe('medium');
    });

    it('returns high for prior_authorization with amount > $500', () => {
      const priority = engine.calculatePriority(DenialRootCause.PRIOR_AUTHORIZATION, 600, null);
      expect(priority).toBe('high');
    });

    it('returns medium for amount > $200 with non-critical root cause', () => {
      const priority = engine.calculatePriority(DenialRootCause.FEE_SCHEDULE, 300, null);
      expect(priority).toBe('medium');
    });

    it('returns low for patient_responsibility regardless of amount', () => {
      const priority = engine.calculatePriority(DenialRootCause.PATIENT_RESPONSIBILITY, 5000, null);
      expect(priority).toBe('low');
    });

    it('returns low for small amounts with non-critical root cause', () => {
      const priority = engine.calculatePriority(DenialRootCause.OTHER, 50, null);
      expect(priority).toBe('low');
    });
  });
});
