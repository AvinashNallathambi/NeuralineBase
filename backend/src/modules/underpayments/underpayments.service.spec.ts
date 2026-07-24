import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UnderpaymentsService } from './underpayments.service';
import { PayerContract } from './entities/payer-contract.entity';
import {
  UnderpaymentRecord,
  UnderpaymentStatus,
} from './entities/underpayment-record.entity';
import { RemittanceClaim } from '../remittance/entities/remittance-claim.entity';
import { RemittanceServiceLine } from '../remittance/entities/remittance-service-line.entity';
import { Remittance } from '../remittance/entities/remittance.entity';
import { EncounterClaim } from '../billing/entities/encounter-claim.entity';

/**
 * Unit tests for UnderpaymentsService — contract management, expected payment
 * calculation, underpayment detection, and analytics.
 *
 * These tests mock all TypeORM repositories and verify:
 *   1. Contract CRUD and expected payment calculation (with modifier adjustments)
 *   2. Underpayment detection: variance > $5 and > 2% triggers a record
 *   3. Denied claims (status code 4) are skipped
 *   4. Already-detected underpayments are not duplicated
 *   5. Status updates and resolution tracking
 *   6. Analytics aggregation by payer and CPT code
 */
describe('UnderpaymentsService', () => {
  let service: UnderpaymentsService;
  let contractRepo: any;
  let underpaymentRepo: any;
  let remittanceClaimRepo: any;
  let serviceLineRepo: any;
  let remittanceRepo: any;
  let claimRepo: any;

  const TENANT_ID = 'tenant-001';

  beforeEach(async () => {
    contractRepo = {
      save: jest.fn(async (e) => ({ ...e, id: 'contract-001' }) as any),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    underpaymentRepo = {
      save: jest.fn(async (e) => ({ ...e, id: 'underpayment-001' }) as any),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    remittanceClaimRepo = { find: jest.fn() };
    serviceLineRepo = { find: jest.fn() };
    remittanceRepo = { findOne: jest.fn() };
    claimRepo = { findOne: jest.fn(), find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnderpaymentsService,
        { provide: getRepositoryToken(PayerContract), useValue: contractRepo },
        { provide: getRepositoryToken(UnderpaymentRecord), useValue: underpaymentRepo },
        { provide: getRepositoryToken(RemittanceClaim), useValue: remittanceClaimRepo },
        { provide: getRepositoryToken(RemittanceServiceLine), useValue: serviceLineRepo },
        { provide: getRepositoryToken(Remittance), useValue: remittanceRepo },
        { provide: getRepositoryToken(EncounterClaim), useValue: claimRepo },
      ],
    }).compile();

    service = module.get<UnderpaymentsService>(UnderpaymentsService);
  });

  describe('createContract()', () => {
    it('creates a payer contract with the provided data', async () => {
      const data = {
        payerName: 'BCBS',
        cptCode: '99213',
        contractedRate: 120,
        rateType: 'flat',
      };

      const result = await service.createContract(data as any, TENANT_ID);

      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          payerName: 'BCBS',
          cptCode: '99213',
          contractedRate: 120,
          rateType: 'flat',
          isActive: true,
        }),
      );
      expect(result.id).toBe('contract-001');
    });
  });

  describe('calculateExpectedPayment()', () => {
    it('returns expected payment = contractedRate × units', async () => {
      contractRepo.findOne.mockResolvedValue({
        id: 'contract-1',
        contractedRate: 120,
        modifierAdjustments: {},
      });

      const result = await service.calculateExpectedPayment(TENANT_ID, 'BCBS', '99213', 2);

      expect(result.expected).toBe(240); // 120 × 2
      expect(result.contract).toBeDefined();
    });

    it('applies modifier adjustments (e.g., 50% for modifier 50)', async () => {
      contractRepo.findOne.mockResolvedValue({
        id: 'contract-1',
        contractedRate: 200,
        modifierAdjustments: { '50': 0.5 }, // modifier 50 = 50% of rate
      });

      const result = await service.calculateExpectedPayment(
        TENANT_ID,
        'BCBS',
        '99213',
        1,
        ['50'],
      );

      expect(result.expected).toBe(100); // 200 × 1 × 0.5
    });

    it('returns 0 expected when no contract exists', async () => {
      contractRepo.findOne.mockResolvedValue(null);

      const result = await service.calculateExpectedPayment(TENANT_ID, 'Unknown Payer', '99213', 1);

      expect(result.expected).toBe(0);
      expect(result.contract).toBeNull();
    });
  });

  describe('detectUnderpayments()', () => {
    it('detects underpayment when variance > $5 and > 2% of expected', async () => {
      const claim = {
        id: 'rc-1',
        claimStatusCode: '1', // not denied
        remittanceId: 'rem-1',
        matchedClaimId: 'ec-1',
        matchedClaimNumber: 'CLM001',
        patientName: 'Jane Doe',
        serviceDate: new Date('2024-06-20'),
        postedAt: new Date('2024-07-15'),
      };

      const serviceLine = {
        id: 'sl-1',
        remittanceClaimId: 'rc-1',
        cptCode: '99213',
        units: 1,
        billedAmount: 200,
        paidAmount: 80, // paid $80, expected $120 → variance $40 (33%)
        modifier1: null,
        modifier2: null,
        modifier3: null,
        modifier4: null,
        serviceDate: new Date('2024-06-20'),
      };

      remittanceClaimRepo.find.mockResolvedValue([claim]);
      serviceLineRepo.find.mockResolvedValue([serviceLine]);
      remittanceRepo.findOne.mockResolvedValue({ payerName: 'BCBS' });
      contractRepo.findOne.mockResolvedValue({
        id: 'contract-1',
        contractedRate: 120,
        modifierAdjustments: {},
      });
      underpaymentRepo.findOne.mockResolvedValue(null); // not already detected

      const result = await service.detectUnderpayments('rem-1', TENANT_ID);

      expect(result.detectedCount).toBe(1);
      expect(result.totalVariance).toBe(40); // 120 - 80
      expect(underpaymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          cptCode: '99213',
          expectedAmount: 120,
          actualPaidAmount: 80,
          varianceAmount: 40,
          status: UnderpaymentStatus.DETECTED,
        }),
      );
    });

    it('does not detect underpayment when variance ≤ $5', async () => {
      const claim = {
        id: 'rc-1',
        claimStatusCode: '1',
        remittanceId: 'rem-1',
        matchedClaimId: 'ec-1',
      };
      const serviceLine = {
        id: 'sl-1',
        remittanceClaimId: 'rc-1',
        cptCode: '99213',
        units: 1,
        paidAmount: 118, // paid $118, expected $120 → variance $2 (< $5 threshold)
        modifier1: null,
        modifier2: null,
        modifier3: null,
        modifier4: null,
      };

      remittanceClaimRepo.find.mockResolvedValue([claim]);
      serviceLineRepo.find.mockResolvedValue([serviceLine]);
      remittanceRepo.findOne.mockResolvedValue({ payerName: 'BCBS' });
      contractRepo.findOne.mockResolvedValue({
        id: 'contract-1',
        contractedRate: 120,
        modifierAdjustments: {},
      });

      const result = await service.detectUnderpayments('rem-1', TENANT_ID);

      expect(result.detectedCount).toBe(0);
      expect(underpaymentRepo.save).not.toHaveBeenCalled();
    });

    it('skips denied claims (status code 4)', async () => {
      const deniedClaim = {
        id: 'rc-denied',
        claimStatusCode: '4', // denied
        remittanceId: 'rem-1',
      };

      remittanceClaimRepo.find.mockResolvedValue([deniedClaim]);

      const result = await service.detectUnderpayments('rem-1', TENANT_ID);

      expect(result.detectedCount).toBe(0);
      expect(serviceLineRepo.find).not.toHaveBeenCalled();
    });

    it('skips service lines with no contract rate', async () => {
      const claim = {
        id: 'rc-1',
        claimStatusCode: '1',
        remittanceId: 'rem-1',
      };
      const serviceLine = {
        id: 'sl-1',
        remittanceClaimId: 'rc-1',
        cptCode: '99999', // no contract for this CPT
        units: 1,
        paidAmount: 50,
        modifier1: null,
        modifier2: null,
        modifier3: null,
        modifier4: null,
      };

      remittanceClaimRepo.find.mockResolvedValue([claim]);
      serviceLineRepo.find.mockResolvedValue([serviceLine]);
      remittanceRepo.findOne.mockResolvedValue({ payerName: 'BCBS' });
      contractRepo.findOne.mockResolvedValue(null); // no contract

      const result = await service.detectUnderpayments('rem-1', TENANT_ID);

      expect(result.detectedCount).toBe(0);
    });

    it('does not create duplicate underpayment records', async () => {
      const claim = {
        id: 'rc-1',
        claimStatusCode: '1',
        remittanceId: 'rem-1',
        matchedClaimId: 'ec-1',
      };
      const serviceLine = {
        id: 'sl-1',
        remittanceClaimId: 'rc-1',
        cptCode: '99213',
        units: 1,
        paidAmount: 80,
        modifier1: null,
        modifier2: null,
        modifier3: null,
        modifier4: null,
      };

      remittanceClaimRepo.find.mockResolvedValue([claim]);
      serviceLineRepo.find.mockResolvedValue([serviceLine]);
      remittanceRepo.findOne.mockResolvedValue({ payerName: 'BCBS' });
      contractRepo.findOne.mockResolvedValue({
        id: 'contract-1',
        contractedRate: 120,
        modifierAdjustments: {},
      });
      // Already detected
      underpaymentRepo.findOne.mockResolvedValue({ id: 'existing-underpayment' });

      const result = await service.detectUnderpayments('rem-1', TENANT_ID);

      expect(result.detectedCount).toBe(0);
      expect(underpaymentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus()', () => {
    it('updates status and sets resolvedAt for terminal statuses', async () => {
      const record = {
        id: 'up-1',
        status: UnderpaymentStatus.DETECTED,
        recoveredAmount: null,
        resolutionNotes: null,
        resolvedAt: null,
      };
      underpaymentRepo.findOne.mockResolvedValue(record);

      const result = await service.updateStatus(
        'up-1',
        UnderpaymentStatus.RECOVERED,
        40,
        'Payer paid the difference',
      );

      expect(result.status).toBe(UnderpaymentStatus.RECOVERED);
      expect(result.recoveredAmount).toBe(40);
      expect(result.resolutionNotes).toBe('Payer paid the difference');
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException for non-existent record', async () => {
      underpaymentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('nonexistent', UnderpaymentStatus.RECOVERED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats()', () => {
    it('aggregates underpayment statistics by payer and CPT code', async () => {
      const records = [
        {
          payerName: 'BCBS',
          cptCode: '99213',
          varianceAmount: 40,
          recoveredAmount: 40,
          status: UnderpaymentStatus.RECOVERED,
        },
        {
          payerName: 'BCBS',
          cptCode: '99214',
          varianceAmount: 60,
          recoveredAmount: null,
          status: UnderpaymentStatus.DETECTED,
        },
        {
          payerName: 'Aetna',
          cptCode: '99213',
          varianceAmount: 30,
          recoveredAmount: null,
          status: UnderpaymentStatus.INVESTIGATING,
        },
      ];
      underpaymentRepo.find.mockResolvedValue(records);

      const stats = await service.getStats(TENANT_ID);

      expect(stats.totalUnderpayments).toBe(3);
      expect(stats.totalVariance).toBe(130); // 40 + 60 + 30
      expect(stats.totalRecovered).toBe(40);
      expect(stats.recoveredCount).toBe(1);
      expect(stats.detectedCount).toBe(1);
      expect(stats.investigatingCount).toBe(1);

      // By payer (sorted by variance DESC)
      expect(stats.byPayer[0].payer).toBe('BCBS');
      expect(stats.byPayer[0].variance).toBe(100); // 40 + 60
      expect(stats.byPayer[1].payer).toBe('Aetna');
      expect(stats.byPayer[1].variance).toBe(30);

      // By CPT code (sorted by variance DESC)
      expect(stats.byCptCode[0].cptCode).toBe('99213');
      expect(stats.byCptCode[0].variance).toBe(70); // 40 + 30
      expect(stats.byCptCode[1].cptCode).toBe('99214');
      expect(stats.byCptCode[1].variance).toBe(60);
    });
  });
});
