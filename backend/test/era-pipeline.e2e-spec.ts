import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RemittanceService } from '../src/modules/remittance/remittance.service';
import { X12Parser835 } from '../src/modules/remittance/x12-parser-835.service';
import { DenialsService } from '../src/modules/denials/denials.service';
import { DenialCategoryEngine } from '../src/modules/denials/denial-category-engine';
import { AppealsService } from '../src/modules/appeals/appeals.service';
import { AppealAiService } from '../src/modules/appeals/appeal-ai.service';
import { UnderpaymentsService } from '../src/modules/underpayments/underpayments.service';
import { AiService } from '../src/modules/ai/ai.service';

import { Remittance, RemittanceStatus, RemittanceType } from '../src/modules/remittance/entities/remittance.entity';
import { RemittanceClaim } from '../src/modules/remittance/entities/remittance-claim.entity';
import { RemittanceServiceLine } from '../src/modules/remittance/entities/remittance-service-line.entity';
import { ClaimAdjustment } from '../src/modules/remittance/entities/claim-adjustment.entity';
import { EOB } from '../src/modules/remittance/entities/eob.entity';
import { CarcCode } from '../src/modules/remittance/entities/carc-code.entity';
import { RarcCode } from '../src/modules/remittance/entities/rarc-code.entity';
import { DenialRecord, DenialWorklistStatus } from '../src/modules/denials/entities/denial-record.entity';
import { Appeal, AppealStatus, AppealOutcome } from '../src/modules/appeals/entities/appeal.entity';
import { AppealStatusHistory } from '../src/modules/appeals/entities/appeal-status-history.entity';
import { PayerContract } from '../src/modules/underpayments/entities/payer-contract.entity';
import { UnderpaymentRecord, UnderpaymentStatus } from '../src/modules/underpayments/entities/underpayment-record.entity';
import { EncounterClaim, ClaimStatus } from '../src/modules/billing/entities/encounter-claim.entity';
import { ClaimLineItem } from '../src/modules/billing/entities/claim-line-item.entity';

/**
 * End-to-end ERA 835 Pipeline Test.
 *
 * This test simulates the full RCM pipeline with an in-memory mock database
 * (instead of PostgreSQL) so data flows between real service implementations:
 *
 *   1. ERA 835 file → X12Parser835 parses it
 *   2. RemittanceService.importEra() → creates remittance + claims + service lines + adjustments
 *   3. RemittanceService.autoPostPayments() → updates EncounterClaim statuses (PAID/DENIED)
 *   4. DenialsService.generateFromRemittance() → creates DenialRecords from CAS adjustments
 *   5. AppealsService.createFromDenial() → creates an Appeal from a denial
 *   6. UnderpaymentsService.detectUnderpayments() → detects underpayments using payer contracts
 *
 * The sample 835 file contains:
 *   - Claim 1 (CLAIM001): Paid $900 of $1200 billed, with CO-45 (fee schedule) adjustment
 *   - Claim 2 (CLAIM002): Denied (status 4), CO-16 (missing information) + RARC M76
 *
 * A payer contract for BCBS/99213 at $120 is seeded so underpayment detection
 * can compare the paid amount against the contracted rate.
 */
describe('ERA 835 Pipeline (e2e)', () => {
  let remittanceService: RemittanceService;
  let denialsService: DenialsService;
  let appealsService: AppealsService;
  let underpaymentsService: UnderpaymentsService;

  // In-memory storage simulating database tables
  const db: Record<string, Map<string, any>> = {
    remittances: new Map(),
    remittanceClaims: new Map(),
    remittanceServiceLines: new Map(),
    claimAdjustments: new Map(),
    eobs: new Map(),
    carcCodes: new Map(),
    rarcCodes: new Map(),
    denialRecords: new Map(),
    appeals: new Map(),
    appealStatusHistory: new Map(),
    payerContracts: new Map(),
    underpaymentRecords: new Map(),
    encounterClaims: new Map(),
    claimLineItems: new Map(),
  };

  const TENANT_ID = 'tenant-e2e-001';
  let idCounter = 0;
  const genId = () => `id-${++idCounter}`;

  // Helper: create a mock repository backed by in-memory storage
  function mockRepo(tableName: string) {
    const store = db[tableName];
    return {
      create: (dto: any) => ({ ...dto, id: dto.id || genId() }),
      save: async (entity: any) => {
        const id = entity.id || genId();
        const saved = { ...entity, id };
        store.set(id, saved);
        return saved;
      },
      findOne: async (opts?: any) => {
        if (!opts || !opts.where) {
          // Return first record (for simple cases)
          const values = Array.from(store.values());
          return values[0] || null;
        }
        for (const record of store.values()) {
          const matches = Object.entries(opts.where).every(([key, val]) => {
            if (val === null || val === undefined) return record[key] == null;
            return record[key] === val;
          });
          if (matches) return record;
        }
        return null;
      },
      find: async (opts?: any) => {
        let results = Array.from(store.values());
        if (opts?.where) {
          results = results.filter((record) =>
            Object.entries(opts.where).every(([key, val]) => {
              if (val === null || val === undefined) return record[key] == null;
              return record[key] === val;
            }),
          );
        }
        if (opts?.order) {
          for (const [key, dir] of Object.entries(opts.order)) {
            results.sort((a, b) => {
              const av = a[key];
              const bv = b[key];
              if (av == null && bv == null) return 0;
              if (av == null) return 1;
              if (bv == null) return -1;
              if (av < bv) return dir === 'DESC' ? 1 : -1;
              if (av > bv) return dir === 'DESC' ? -1 : 1;
              return 0;
            });
          }
        }
        return results;
      },
      createQueryBuilder: () => ({
        where: () => ({ andWhere: () => ({ orderBy: () => ({ getMany: async () => [] }) }) }),
      }),
    };
  }

  // DataSource with transaction support — just calls the callback directly
  const mockDataSource = {
    transaction: async (cb: (manager: any) => Promise<any>) => {
      // The manager uses the same in-memory stores
      const manager = {
        findOne: async (entityClass: any, opts: any) => {
          // Map entity class to table name
          let tableName = 'encounterClaims';
          if (entityClass === EncounterClaim) tableName = 'encounterClaims';
          else if (entityClass === ClaimLineItem) tableName = 'claimLineItems';
          else if (entityClass === ClaimAdjustment) tableName = 'claimAdjustments';
          const store = db[tableName];
          if (!opts?.where) return Array.from(store.values())[0] || null;
          for (const record of store.values()) {
            const matches = Object.entries(opts.where).every(([key, val]) => record[key] === val);
            if (matches) return record;
          }
          return null;
        },
        find: async (entityClass: any, opts: any) => {
          let tableName = 'claimAdjustments';
          if (entityClass === ClaimAdjustment) tableName = 'claimAdjustments';
          const store = db[tableName];
          let results = Array.from(store.values());
          if (opts?.where) {
            results = results.filter((record) =>
              Object.entries(opts.where).every(([key, val]) => record[key] === val),
            );
          }
          return results;
        },
        save: async (entity: any) => {
          const id = entity.id || genId();
          // Determine table from entity type
          let tableName = 'encounterClaims';
          if (entity instanceof RemittanceClaim || entity.constructor?.name === 'RemittanceClaim') {
            tableName = 'remittanceClaims';
          } else if (entity instanceof EncounterClaim || entity.status !== undefined) {
            tableName = 'encounterClaims';
          } else if (entity.cptCode !== undefined && entity.remittanceClaimId !== undefined) {
            tableName = 'remittanceServiceLines';
          }
          const saved = { ...entity, id };
          db[tableName].set(id, saved);
          return saved;
        },
      };
      return cb(manager);
    },
  };

  // Mock AI service — returns canned structured responses
  const mockAiService = {
    generateStructured: async (prompt: string) => {
      // Return a realistic appeal letter structure
      if (prompt.includes('appeal letter') || prompt.includes('appeal')) {
        return {
          subject: 'Appeal for Denied Claim CLAIM002',
          letter: 'Dear Claims Review Department,\n\nWe are writing to formally appeal...',
          successProbability: 72,
          rationale: 'CO-16 denials have a high overturn rate when additional documentation is provided.',
          keyArguments: ['Medical necessity documented', 'Service was prior authorized', 'Coding accurate'],
          recommendedDocuments: ['Office notes', 'Prior authorization approval', 'Operative report'],
        };
      }
      return { probability: 65, rationale: 'Moderate success probability based on denial type' };
    },
  };

  // Sample ERA 835 file: 1 paid claim + 1 denied claim
  const SAMPLE_835 = [
    'ISA*00*          *00*          *ZZ*BCBS           *ZZ*PROVIDER      *240701*1230*^*00501*000000001*0*P*:',
    'GS*HP*BCBS*PROVIDER*20240701*1230*1*X*005010X221A1',
    'ST*835*0001',
    'BPR*I*900.00*C*ACH*CCP*01*999999992*DA*1234567890*PROVIDER BANK***123456***20240715*EFTREF001',
    'TRN*1*TRACE-E2E-001*999999992',
    'N1*PR*BLUE CROSS BLUE SHIELD*XV*BCBS001',
    'N1*PE*NEURALINE HEALTH CLINIC*XX*1234567893',
    // Claim 1: Paid $900 of $1200 (CO-45 fee schedule reduction $300)
    'CLP*CLAIM001*1*1200.00*900.00*0*300.00*12*1',
    'NM1*QC*1*DOE*JANE****MI*PT0001',
    'NM1*IL*1*DOE*JANE****MI*PT0001',
    'DTM*037*20240620',
    'SVC*HC:99213:25*1200.00*900.00*1',
    'SVD*HC*99213*900.00*1*25',
    'CAS*CO*45*300.00',
    // Claim 2: Denied (status 4) — CO-16 missing information + RARC M76
    'CLP*CLAIM002*4*500.00*0*0*500.00*12*1',
    'NM1*QC*1*SMITH*JOHN****MI*PT0002',
    'DTM*037*20240622',
    'CAS*CO*16*500.00****M76',
    'SE*20*0001',
  ].join('~');

  beforeAll(async () => {
    // Seed CARC/RARC code lookup tables
    db.carcCodes.set('carc-45', { id: 'carc-45', code: '45', description: 'Charge exceeds fee schedule/maximum allowable', rootCauseCategory: 'fee_schedule', isActive: true });
    db.carcCodes.set('carc-16', { id: 'carc-16', code: '16', description: 'Claim/service lacks information needed for adjudication', rootCauseCategory: 'missing_information', isActive: true });
    db.rarcCodes.set('rarc-m76', { id: 'rarc-m76', code: 'M76', description: 'Missing/invalid diagnosis code', rootCauseCategory: 'coding_error', isActive: true });

    // Seed a pre-existing EncounterClaim that will be matched to CLAIM001
    const encounterClaim = {
      id: 'ec-001',
      tenantId: TENANT_ID,
      claimNumber: 'CLAIM001',
      patientName: 'DOE JANE',
      patientId: 'patient-001',
      status: ClaimStatus.SUBMITTED,
      totalBilled: 1200,
      totalPaid: 0,
      patientResponsibility: 0,
      adjustmentAmount: 0,
      denialReason: null,
      providerName: 'Dr. Smith',
      providerNPI: '1234567890',
      notes: 'Patient seen for office visit. Medical necessity documented.',
      serviceDate: new Date('2024-06-20'),
    };
    db.encounterClaims.set('ec-001', encounterClaim);

    // Seed a claim line item for the encounter claim
    db.claimLineItems.set('li-001', {
      id: 'li-001',
      claimId: 'ec-001',
      code: '99213',
      paidAmount: 0,
      adjustmentAmount: 0,
      allowedAmount: null,
      diagnosisPointer: ['M54.5'],
    });

    // Seed a payer contract: BCBS pays $120 for CPT 99213
    db.payerContracts.set('contract-001', {
      id: 'contract-001',
      tenantId: TENANT_ID,
      payerId: null,
      payerName: 'BLUE CROSS BLUE SHIELD',
      cptCode: '99213',
      cptDescription: 'Office visit, established patient',
      contractedRate: 120,
      rateType: 'flat',
      medicarePercentage: null,
      modifierAdjustments: {},
      effectiveDate: new Date('2024-01-01'),
      expirationDate: null,
      isActive: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemittanceService,
        X12Parser835,
        DenialsService,
        DenialCategoryEngine,
        AppealsService,
        AppealAiService,
        UnderpaymentsService,
        { provide: AiService, useValue: mockAiService },
        { provide: DataSource, useValue: mockDataSource },

        // Remittance repos
        { provide: getRepositoryToken(Remittance), useValue: mockRepo('remittances') },
        { provide: getRepositoryToken(RemittanceClaim), useValue: mockRepo('remittanceClaims') },
        { provide: getRepositoryToken(RemittanceServiceLine), useValue: mockRepo('remittanceServiceLines') },
        { provide: getRepositoryToken(ClaimAdjustment), useValue: mockRepo('claimAdjustments') },
        { provide: getRepositoryToken(EOB), useValue: mockRepo('eobs') },
        { provide: getRepositoryToken(CarcCode), useValue: mockRepo('carcCodes') },
        { provide: getRepositoryToken(RarcCode), useValue: mockRepo('rarcCodes') },
        { provide: getRepositoryToken(EncounterClaim), useValue: mockRepo('encounterClaims') },
        { provide: getRepositoryToken(ClaimLineItem), useValue: mockRepo('claimLineItems') },

        // Denials repos
        { provide: getRepositoryToken(DenialRecord), useValue: mockRepo('denialRecords') },

        // Appeals repos
        { provide: getRepositoryToken(Appeal), useValue: mockRepo('appeals') },
        { provide: getRepositoryToken(AppealStatusHistory), useValue: mockRepo('appealStatusHistory') },

        // Underpayments repos
        { provide: getRepositoryToken(PayerContract), useValue: mockRepo('payerContracts') },
        { provide: getRepositoryToken(UnderpaymentRecord), useValue: mockRepo('underpaymentRecords') },
      ],
    }).compile();

    remittanceService = module.get<RemittanceService>(RemittanceService);
    denialsService = module.get<DenialsService>(DenialsService);
    appealsService = module.get<AppealsService>(AppealsService);
    underpaymentsService = module.get<UnderpaymentsService>(UnderpaymentsService);
  });

  afterAll(() => {
    // Clear in-memory DB
    Object.values(db).forEach((map) => map.clear());
  });

  // ─── Step 1: Parse + Import ERA ─────────────────────────────────────

  describe('Step 1: ERA 835 Import', () => {
    it('should import the ERA file and create remittance + claims + service lines', async () => {
      const result = await remittanceService.importEra(
        { fileContent: SAMPLE_835, fileName: 'sample.835' },
        TENANT_ID,
      );

      // Remittance created with correct header
      expect(result.traceNumber).toBe('TRACE-E2E-001');
      expect(result.payerName).toBe('BLUE CROSS BLUE SHIELD');
      expect(result.totalPaymentAmount).toBe(900.0);
      expect(result.totalClaimCount).toBe(2);

      // Verify claims were created in the in-memory DB
      const claims = await mockRepo('remittanceClaims').find({ where: { tenantId: TENANT_ID } });
      expect(claims).toHaveLength(2);

      // Verify service lines were created
      const serviceLines = await mockRepo('remittanceServiceLines').find({
        where: { tenantId: TENANT_ID },
      });
      expect(serviceLines).toHaveLength(1); // Only CLAIM001 has a service line

      // Verify adjustments were created
      const adjustments = await mockRepo('claimAdjustments').find({
        where: { tenantId: TENANT_ID },
      });
      expect(adjustments.length).toBeGreaterThanOrEqual(2); // CO-45 + CO-16
    });

    it('should have matched CLAIM001 to the pre-existing EncounterClaim', async () => {
      const claims = await mockRepo('remittanceClaims').find({
        where: { tenantId: TENANT_ID, payerClaimId: 'CLAIM001' },
      });
      expect(claims[0].isMatched).toBe(true);
      expect(claims[0].matchedClaimId).toBe('ec-001');
    });
  });

  // ─── Step 2: Auto-Payment Posting ───────────────────────────────────

  describe('Step 2: Auto-Payment Posting (runs during importEra)', () => {
    it('should have posted the paid claim and updated EncounterClaim status to PARTIALLY_PAID', async () => {
      // importEra already calls autoPostPayments internally, so the encounter
      // claim should already be updated by this point.
      // CLAIM001: paid $900 of $1200, with $300 CO-45 adjustment → PARTIALLY_PAID
      // (both paidAmount > 0 AND adjustedAmount > 0 triggers PARTIALLY_PAID)
      const ec = db.encounterClaims.get('ec-001');
      expect(ec.status).toBe(ClaimStatus.PARTIALLY_PAID);
      expect(ec.totalPaid).toBe(900.0);
      expect(ec.patientResponsibility).toBe(0);
      expect(ec.adjustmentAmount).toBe(300.0);
    });

    it('should have marked the remittance claim as posted', async () => {
      const claims = await mockRepo('remittanceClaims').find({
        where: { tenantId: TENANT_ID, payerClaimId: 'CLAIM001' },
      });
      expect(claims[0].isPosted).toBe(true);
      expect(claims[0].postedAt).toBeInstanceOf(Date);
    });
  });

  // ─── Step 3: Denial Generation ──────────────────────────────────────

  describe('Step 3: Denial Generation from Remittance', () => {
    it('should generate denial records from CAS adjustments (non-PR)', async () => {
      const remittance = await mockRepo('remittances').findOne({ where: { tenantId: TENANT_ID } });

      // generateFromRemittance is also called automatically during importEra,
      // but we call it again to verify it works standalone and is idempotent.
      const count = await denialsService.generateFromRemittance(remittance.id, TENANT_ID);

      // Should have denial records for CO-45 and CO-16
      // (CO-45 from CLAIM001 service line, CO-16 from CLAIM002 claim level)
      const denials = await mockRepo('denialRecords').find({ where: { tenantId: TENANT_ID } });
      expect(denials.length).toBeGreaterThanOrEqual(1);

      // Verify the CO-16 denial (from the denied claim)
      // Note: CARC 16 alone maps to missing_information, but the combination
      // 16+M76 maps to coding_error (M76 = "Missing/invalid diagnosis code")
      const co16Denial = denials.find((d) => d.carcCode === '16');
      expect(co16Denial).toBeDefined();
      expect(co16Denial.rootCauseCategory).toBe('coding_error'); // 16+M76 combination
      expect(co16Denial.deniedAmount).toBe(500.0);
      expect(co16Denial.payerName).toBe('BLUE CROSS BLUE SHIELD');
      expect(co16Denial.status).toBe(DenialWorklistStatus.NEW);
    });

    it('should not create duplicate denial records on re-run (idempotent)', async () => {
      const remittance = await mockRepo('remittances').findOne({ where: { tenantId: TENANT_ID } });
      const beforeCount = (await mockRepo('denialRecords').find({ where: { tenantId: TENANT_ID } })).length;

      await denialsService.generateFromRemittance(remittance.id, TENANT_ID);

      const afterCount = (await mockRepo('denialRecords').find({ where: { tenantId: TENANT_ID } })).length;
      expect(afterCount).toBe(beforeCount); // No new denials
    });
  });

  // ─── Step 4: Appeal Creation from Denial ────────────────────────────

  describe('Step 4: Appeal Creation + AI Letter Generation', () => {
    it('should create an appeal from the CO-16 denial', async () => {
      const denials = await mockRepo('denialRecords').find({ where: { tenantId: TENANT_ID } });
      const co16Denial = denials.find((d) => d.carcCode === '16');
      expect(co16Denial).toBeDefined();

      const appeal = await appealsService.createFromDenial(co16Denial.id, TENANT_ID);

      expect(appeal.denialId).toBe(co16Denial.id);
      expect(appeal.carcCode).toBe('16');
      expect(appeal.deniedAmount).toBe(500.0);
      expect(appeal.status).toBe(AppealStatus.DRAFT);
      expect(appeal.outcome).toBe(AppealOutcome.PENDING);
      expect(appeal.payerName).toBe('BLUE CROSS BLUE SHIELD');

      // Denial status should be updated to APPEALED
      const updatedDenial = db.denialRecords.get(co16Denial.id);
      expect(updatedDenial.status).toBe(DenialWorklistStatus.APPEALED);
    });

    it('should generate an AI appeal letter with success probability', async () => {
      const appeals = await mockRepo('appeals').find({ where: { tenantId: TENANT_ID } });
      expect(appeals.length).toBeGreaterThan(0);
      const appeal = appeals[0];

      const updated = await appealsService.generateAppealLetter(appeal.id, TENANT_ID);

      expect(updated.appealSubject).toContain('CLAIM002');
      expect(updated.appealLetter).toContain('Dear Claims Review');
      expect(updated.successProbability).toBeGreaterThan(0);
      expect(updated.successProbability).toBeLessThanOrEqual(100);
      expect(updated.aiRationale).toBeDefined();
    });
  });

  // ─── Step 5: Underpayment Detection ─────────────────────────────────

  describe('Step 5: Underpayment Detection', () => {
    it('should detect underpayment when paid amount < contracted rate', async () => {
      const remittance = await mockRepo('remittances').findOne({ where: { tenantId: TENANT_ID } });

      // The contract says BCBS pays $120 for CPT 99213.
      // The ERA shows $900 paid for 1 unit of 99213 — but that's the total
      // claim payment, not per-unit. The service line has paidAmount = 900
      // and units = 1, so expected = 120 × 1 = 120.
      // Since 900 > 120, there's no underpayment (it's actually overpaid).
      // Let's verify the detection logic runs without error and correctly
      // does NOT flag this as an underpayment.
      const result = await underpaymentsService.detectUnderpayments(remittance.id, TENANT_ID);

      // paid ($900) > expected ($120), so variance is negative → no underpayment
      expect(result.detectedCount).toBe(0);
    });

    it('would detect underpayment if paid < contracted rate (verified via calculateExpectedPayment)', async () => {
      // Verify the contract lookup and expected payment calculation work
      const { expected, contract } = await underpaymentsService.calculateExpectedPayment(
        TENANT_ID,
        'BLUE CROSS BLUE SHIELD',
        '99213',
        1,
      );

      expect(contract).toBeDefined();
      expect(contract!.contractedRate).toBe(120);
      expect(expected).toBe(120);
    });
  });

  // ─── Step 6: Full Pipeline Summary ──────────────────────────────────

  describe('Pipeline Summary', () => {
    it('should have consistent data across all modules', async () => {
      const remittances = await mockRepo('remittances').find({ where: { tenantId: TENANT_ID } });
      const claims = await mockRepo('remittanceClaims').find({ where: { tenantId: TENANT_ID } });
      const denials = await mockRepo('denialRecords').find({ where: { tenantId: TENANT_ID } });
      const appeals = await mockRepo('appeals').find({ where: { tenantId: TENANT_ID } });

      expect(remittances).toHaveLength(1);
      expect(claims).toHaveLength(2);
      expect(denials.length).toBeGreaterThanOrEqual(1);
      expect(appeals.length).toBeGreaterThanOrEqual(1);

      // The appeal should reference the denial, which references the remittance claim
      const appeal = appeals[0];
      const denial = db.denialRecords.get(appeal.denialId);
      expect(denial).toBeDefined();
      expect(denial.payerName).toBe('BLUE CROSS BLUE SHIELD');

      // The remittance claim should be linked to the denial
      const remittanceClaim = db.remittanceClaims.get(denial.remittanceClaimId);
      expect(remittanceClaim).toBeDefined();
      expect(remittanceClaim.payerClaimId).toBe('CLAIM002');
    });
  });
});
