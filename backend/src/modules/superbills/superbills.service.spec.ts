import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { SuperbillsService } from './superbills.service';
import { Superbill, SuperbillStatus } from './entities/superbill.entity';
import { SuperbillDiagnosis } from './entities/superbill-diagnosis.entity';
import { SuperbillProcedure } from './entities/superbill-procedure.entity';
import { SuperbillCharge } from './entities/superbill-charge.entity';
import {
  SuperbillPayment,
  SuperbillPaymentType,
} from './entities/superbill-payment.entity';

/**
 * Unit tests for SuperbillsService.
 *
 * These tests mock the TypeORM repositories so they run without a database.
 * They verify the core business logic: balance calculation, payment application,
 * and status guard checks.
 *
 * Pattern: mock repository methods, call the service method, assert the result.
 */
describe('SuperbillsService', () => {
  let service: SuperbillsService;
  let superbillRepo: jest.Mocked<Pick<Repository<Superbill>, 'create' | 'save' | 'findOne' | 'find' | 'createQueryBuilder'>>;
  let paymentRepo: jest.Mocked<Pick<Repository<SuperbillPayment>, 'create' | 'save' | 'find'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperbillsService,
        {
          provide: getRepositoryToken(Superbill),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SuperbillDiagnosis),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(SuperbillProcedure),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(SuperbillCharge),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(SuperbillPayment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SuperbillsService);
    superbillRepo = module.get(getRepositoryToken(Superbill));
    paymentRepo = module.get(getRepositoryToken(SuperbillPayment));
  });

  describe('recalculateBalance', () => {
    it('should return 0 balance when totalAmount equals payments', async () => {
      const superbillId = 'test-id';
      const mockSuperbill = {
        id: superbillId,
        totalAmount: 200,
        balance: 200,
        status: SuperbillStatus.SUBMITTED,
        procedures: [],
        charges: [],
        diagnoses: [],
        payments: [],
      } as unknown as Superbill;

      superbillRepo.findOne.mockResolvedValue(mockSuperbill);
      paymentRepo.find.mockResolvedValue([
        { type: SuperbillPaymentType.COPAY, amount: 200 } as SuperbillPayment,
      ]);
      superbillRepo.save.mockResolvedValue(mockSuperbill);

      const balance = await service.recalculateBalance(superbillId);

      expect(balance).toBe(0);
    });

    it('should subtract both payments and adjustments from totalAmount', async () => {
      const mockSuperbill = {
        id: 'test-id',
        totalAmount: 500,
        balance: 500,
        status: SuperbillStatus.SUBMITTED,
        procedures: [],
        charges: [],
        diagnoses: [],
        payments: [],
      } as unknown as Superbill;

      superbillRepo.findOne.mockResolvedValue(mockSuperbill);
      paymentRepo.find.mockResolvedValue([
        { type: SuperbillPaymentType.INSURANCE_PAYMENT, amount: 300 } as SuperbillPayment,
        { type: SuperbillPaymentType.COPAY, amount: 100 } as SuperbillPayment,
        { type: SuperbillPaymentType.WRITE_OFF, amount: 50 } as SuperbillPayment,
      ]);
      superbillRepo.save.mockResolvedValue(mockSuperbill);

      const balance = await service.recalculateBalance('test-id');

      // 500 - (300 + 100) - 50 = 50
      expect(balance).toBe(50);
    });

    it('should never return a negative balance', async () => {
      const mockSuperbill = {
        id: 'test-id',
        totalAmount: 100,
        balance: 100,
        status: SuperbillStatus.SUBMITTED,
        procedures: [],
        charges: [],
        diagnoses: [],
        payments: [],
      } as unknown as Superbill;

      superbillRepo.findOne.mockResolvedValue(mockSuperbill);
      paymentRepo.find.mockResolvedValue([
        { type: SuperbillPaymentType.INSURANCE_PAYMENT, amount: 200 } as SuperbillPayment,
      ]);
      superbillRepo.save.mockResolvedValue(mockSuperbill);

      const balance = await service.recalculateBalance('test-id');

      expect(balance).toBe(0);
      expect(balance).not.toBeLessThan(0);
    });

    it('should handle string amounts from decimal columns (TypeORM numeric)', async () => {
      const mockSuperbill = {
        id: 'test-id',
        totalAmount: '250.00' as unknown as number,
        balance: 250,
        status: SuperbillStatus.SUBMITTED,
        procedures: [],
        charges: [],
        diagnoses: [],
        payments: [],
      } as unknown as Superbill;

      superbillRepo.findOne.mockResolvedValue(mockSuperbill);
      paymentRepo.find.mockResolvedValue([
        { type: SuperbillPaymentType.COPAY, amount: '50.00' as unknown as number } as SuperbillPayment,
      ]);
      superbillRepo.save.mockResolvedValue(mockSuperbill);

      const balance = await service.recalculateBalance('test-id');

      // Number('250.00') - Number('50.00') = 200
      expect(balance).toBe(200);
    });
  });

  describe('addPayment', () => {
    it('should throw BadRequestException when superbill is in DRAFT status', async () => {
      const mockSuperbill = {
        id: 'test-id',
        status: SuperbillStatus.DRAFT,
        totalAmount: 200,
        procedures: [],
        charges: [],
        diagnoses: [],
        payments: [],
      } as unknown as Superbill;

      superbillRepo.findOne.mockResolvedValue(mockSuperbill);

      await expect(
        service.addPayment('test-id', SuperbillPaymentType.COPAY, 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create and save a payment when superbill is submitted', async () => {
      const mockSuperbill = {
        id: 'test-id',
        status: SuperbillStatus.SUBMITTED,
        totalAmount: 200,
        procedures: [],
        charges: [],
        diagnoses: [],
        payments: [],
      } as unknown as Superbill;

      const mockPayment = { type: SuperbillPaymentType.COPAY, amount: 50 };

      superbillRepo.findOne.mockResolvedValue(mockSuperbill);
      paymentRepo.create.mockReturnValue(mockPayment as SuperbillPayment);
      paymentRepo.save.mockResolvedValue(mockPayment as SuperbillPayment);
      // recalculateBalance is called internally by addPayment
      paymentRepo.find.mockResolvedValue([]);

      await service.addPayment('test-id', SuperbillPaymentType.COPAY, 50);

      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SuperbillPaymentType.COPAY,
          amount: 50,
        }),
      );
      expect(paymentRepo.save).toHaveBeenCalled();
    });
  });
});
