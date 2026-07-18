import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Superbill, SuperbillStatus } from './entities/superbill.entity';
import { SuperbillDiagnosis } from './entities/superbill-diagnosis.entity';
import { SuperbillProcedure } from './entities/superbill-procedure.entity';
import { SuperbillCharge } from './entities/superbill-charge.entity';
import { SuperbillPayment, SuperbillPaymentType } from './entities/superbill-payment.entity';
import { CreateSuperbillDto } from './dto/create-superbill.dto';
import { UpdateSuperbillDto } from './dto/update-superbill.dto';

@Injectable()
export class SuperbillsService {
  constructor(
    @InjectRepository(Superbill)
    private superbillRepository: Repository<Superbill>,
    @InjectRepository(SuperbillDiagnosis)
    private diagnosisRepository: Repository<SuperbillDiagnosis>,
    @InjectRepository(SuperbillProcedure)
    private procedureRepository: Repository<SuperbillProcedure>,
    @InjectRepository(SuperbillCharge)
    private chargeRepository: Repository<SuperbillCharge>,
    @InjectRepository(SuperbillPayment)
    private paymentRepository: Repository<SuperbillPayment>,
  ) {}

  async create(createSuperbillDto: CreateSuperbillDto): Promise<Superbill> {
    const superbill = this.superbillRepository.create({
      ...createSuperbillDto,
      serviceDate: new Date(createSuperbillDto.serviceDate),
      submissionDate: createSuperbillDto.submissionDate
        ? new Date(createSuperbillDto.submissionDate)
        : undefined,
      admissionDate: createSuperbillDto.admissionDate
        ? new Date(createSuperbillDto.admissionDate)
        : undefined,
      dischargeDate: createSuperbillDto.dischargeDate
        ? new Date(createSuperbillDto.dischargeDate)
        : undefined,
      status: createSuperbillDto.status || SuperbillStatus.DRAFT,
      balance: createSuperbillDto.totalAmount,
    });

    const savedSuperbill = await this.superbillRepository.save(superbill);

    // Save related entities
    if (createSuperbillDto.diagnoses && createSuperbillDto.diagnoses.length > 0) {
      const diagnoses = createSuperbillDto.diagnoses.map((diagnosis) =>
        this.diagnosisRepository.create({
          ...diagnosis,
          superbillId: savedSuperbill.id,
        }),
      );
      savedSuperbill.diagnoses = await this.diagnosisRepository.save(diagnoses);
    }

    if (createSuperbillDto.procedures && createSuperbillDto.procedures.length > 0) {
      const procedures = createSuperbillDto.procedures.map((procedure) =>
        this.procedureRepository.create({
          ...procedure,
          serviceDate: new Date(procedure.serviceDate),
          superbillId: savedSuperbill.id,
        }),
      );
      savedSuperbill.procedures = await this.procedureRepository.save(procedures);
    }

    if (createSuperbillDto.charges && createSuperbillDto.charges.length > 0) {
      const charges = createSuperbillDto.charges.map((charge) =>
        this.chargeRepository.create({
          ...charge,
          superbillId: savedSuperbill.id,
        }),
      );
      savedSuperbill.charges = await this.chargeRepository.save(charges);
    }

    return this.findOne(savedSuperbill.id);
  }

  async findAll(): Promise<Superbill[]> {
    return this.superbillRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByPatient(patientId: string): Promise<Superbill[]> {
    return this.superbillRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProvider(providerId: string): Promise<Superbill[]> {
    return this.superbillRepository.find({
      where: { providerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: SuperbillStatus): Promise<Superbill[]> {
    return this.superbillRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Superbill> {
    const superbill = await this.superbillRepository.findOne({
      where: { id },
    });

    if (!superbill) {
      throw new NotFoundException(`Superbill with ID ${id} not found`);
    }

    return superbill;
  }

  async update(
    id: string,
    updateSuperbillDto: UpdateSuperbillDto,
  ): Promise<Superbill> {
    const superbill = await this.findOne(id);

    // Prevent modification of submitted superbills
    if (superbill.status !== SuperbillStatus.DRAFT) {
      throw new BadRequestException(
        'Cannot modify superbill that is not in draft status',
      );
    }

    Object.assign(superbill, updateSuperbillDto);

    if (updateSuperbillDto.serviceDate) {
      superbill.serviceDate = new Date(updateSuperbillDto.serviceDate);
    }

    if (updateSuperbillDto.submissionDate) {
      superbill.submissionDate = new Date(updateSuperbillDto.submissionDate);
    }

    if (updateSuperbillDto.admissionDate) {
      superbill.admissionDate = new Date(updateSuperbillDto.admissionDate);
    }

    if (updateSuperbillDto.dischargeDate) {
      superbill.dischargeDate = new Date(updateSuperbillDto.dischargeDate);
    }

    const savedSuperbill = await this.superbillRepository.save(superbill);

    // Update related entities if provided
    if (updateSuperbillDto.diagnoses) {
      // Remove existing diagnoses
      await this.diagnosisRepository.delete({ superbillId: id });

      // Add new diagnoses
      const diagnoses = updateSuperbillDto.diagnoses.map((diagnosis) =>
        this.diagnosisRepository.create({
          ...diagnosis,
          superbillId: savedSuperbill.id,
        }),
      );
      savedSuperbill.diagnoses = await this.diagnosisRepository.save(diagnoses);
    }

    if (updateSuperbillDto.procedures) {
      // Remove existing procedures
      await this.procedureRepository.delete({ superbillId: id });

      // Add new procedures
      const procedures = updateSuperbillDto.procedures.map((procedure) =>
        this.procedureRepository.create({
          ...procedure,
          serviceDate: new Date(procedure.serviceDate),
          superbillId: savedSuperbill.id,
        }),
      );
      savedSuperbill.procedures = await this.procedureRepository.save(procedures);
    }

    if (updateSuperbillDto.charges) {
      // Remove existing charges
      await this.chargeRepository.delete({ superbillId: id });

      // Add new charges
      const charges = updateSuperbillDto.charges.map((charge) =>
        this.chargeRepository.create({
          ...charge,
          superbillId: savedSuperbill.id,
        }),
      );
      savedSuperbill.charges = await this.chargeRepository.save(charges);
    }

    await this.recalculateBalance(savedSuperbill.id);

    return this.findOne(savedSuperbill.id);
  }

  async remove(id: string): Promise<void> {
    const superbill = await this.findOne(id);

    // Prevent deletion of non-draft superbills
    if (superbill.status !== SuperbillStatus.DRAFT) {
      throw new BadRequestException(
        'Cannot delete superbill that is not in draft status',
      );
    }

    await this.superbillRepository.remove(superbill);
  }

  async submitForProcessing(id: string): Promise<Superbill> {
    const superbill = await this.findOne(id);

    if (superbill.status !== SuperbillStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft superbills can be submitted for processing',
      );
    }

    superbill.status = SuperbillStatus.SUBMITTED;
    superbill.submissionDate = new Date();

    return this.superbillRepository.save(superbill);
  }

  async resubmit(id: string): Promise<Superbill> {
    const superbill = await this.findOne(id);

    const allowedStatuses = [
      SuperbillStatus.SUBMITTED,
      SuperbillStatus.PROCESSED,
      SuperbillStatus.REJECTED,
      SuperbillStatus.RESUBMITTED,
      SuperbillStatus.CORRECTED,
    ];

    if (!allowedStatuses.includes(superbill.status)) {
      throw new BadRequestException(
        'Only submitted, processed, rejected, resubmitted, or corrected superbills can be resubmitted',
      );
    }

    superbill.status = SuperbillStatus.RESUBMITTED;
    superbill.submissionDate = new Date();

    return this.superbillRepository.save(superbill);
  }

  async markVoid(id: string): Promise<Superbill> {
    const superbill = await this.findOne(id);

    if (superbill.status === SuperbillStatus.DRAFT) {
      throw new BadRequestException('Cannot void a draft superbill');
    }

    if (superbill.status === SuperbillStatus.VOIDED) {
      throw new BadRequestException('Superbill is already voided');
    }

    superbill.status = SuperbillStatus.VOIDED;

    return this.superbillRepository.save(superbill);
  }

  async correctedClaim(id: string): Promise<Superbill> {
    const superbill = await this.findOne(id);

    const allowedStatuses = [
      SuperbillStatus.SUBMITTED,
      SuperbillStatus.PROCESSED,
      SuperbillStatus.REJECTED,
      SuperbillStatus.RESUBMITTED,
    ];

    if (!allowedStatuses.includes(superbill.status)) {
      throw new BadRequestException(
        'Only submitted, processed, rejected, or resubmitted superbills can be corrected',
      );
    }

    superbill.status = SuperbillStatus.CORRECTED;

    return this.superbillRepository.save(superbill);
  }

  async calculateTotals(id: string): Promise<{
    totalAmount: number;
    patientResponsibility: number;
    insurancePayment: number;
  }> {
    const superbill = await this.findOne(id);

    let totalAmount = 0;

    // Sum procedure charges
    superbill.procedures.forEach((procedure) => {
      totalAmount += procedure.charge * procedure.units;
    });

    // Sum additional charges
    superbill.charges.forEach((charge) => {
      totalAmount += charge.amount;
    });

    // Calculate patient responsibility (20% copay for this example)
    const patientResponsibility = totalAmount * 0.2;
    const insurancePayment = totalAmount - patientResponsibility;

    // Update superbill with calculated totals
    superbill.totalAmount = totalAmount;
    superbill.patientResponsibility = patientResponsibility;
    superbill.insurancePayment = insurancePayment;

    await this.superbillRepository.save(superbill);
    await this.recalculateBalance(superbill.id);

    return {
      totalAmount,
      patientResponsibility,
      insurancePayment,
    };
  }

  async addPayment(
    superbillId: string,
    type: SuperbillPaymentType,
    amount: number,
    date?: Date,
    note?: string,
    source?: string,
  ): Promise<Superbill> {
    const superbill = await this.findOne(superbillId);

    if (superbill.status === SuperbillStatus.DRAFT) {
      throw new BadRequestException('Cannot apply payments to a draft superbill');
    }

    const payment = this.paymentRepository.create({
      superbillId,
      type,
      amount,
      date: date ? new Date(date) : new Date(),
      note,
      source,
    });

    await this.paymentRepository.save(payment);
    await this.recalculateBalance(superbillId);

    return this.findOne(superbillId);
  }

  async recalculateBalance(superbillId: string): Promise<number> {
    const superbill = await this.findOne(superbillId);
    const payments = await this.paymentRepository.find({
      where: { superbillId },
    });

    const totalPaid = payments
      .filter((p) => p.type === SuperbillPaymentType.COPAY || p.type === SuperbillPaymentType.INSURANCE_PAYMENT)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalAdjustments = payments
      .filter((p) => p.type === SuperbillPaymentType.WRITE_OFF || p.type === SuperbillPaymentType.ADJUSTMENT)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const balance = Math.max(0, superbill.totalAmount - totalPaid - totalAdjustments);

    superbill.balance = balance;
    await this.superbillRepository.save(superbill);

    return balance;
  }
}
