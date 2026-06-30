import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Superbill, SuperbillStatus } from './entities/superbill.entity';
import { SuperbillDiagnosis } from './entities/superbill-diagnosis.entity';
import { SuperbillProcedure } from './entities/superbill-procedure.entity';
import { SuperbillCharge } from './entities/superbill-charge.entity';
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
  ) {}

  async create(createSuperbillDto: CreateSuperbillDto): Promise<Superbill> {
    const superbill = this.superbillRepository.create({
      ...createSuperbillDto,
      serviceDate: new Date(createSuperbillDto.serviceDate),
      submissionDate: createSuperbillDto.submissionDate
        ? new Date(createSuperbillDto.submissionDate)
        : undefined,
      status: createSuperbillDto.status || SuperbillStatus.DRAFT,
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
    if (
      superbill.status === SuperbillStatus.SUBMITTED ||
      superbill.status === SuperbillStatus.PROCESSED ||
      superbill.status === SuperbillStatus.PAID
    ) {
      throw new BadRequestException(
        'Cannot modify superbill that has been submitted',
      );
    }

    Object.assign(superbill, updateSuperbillDto);

    if (updateSuperbillDto.serviceDate) {
      superbill.serviceDate = new Date(updateSuperbillDto.serviceDate);
    }

    if (updateSuperbillDto.submissionDate) {
      superbill.submissionDate = new Date(updateSuperbillDto.submissionDate);
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

    return this.findOne(savedSuperbill.id);
  }

  async remove(id: string): Promise<void> {
    const superbill = await this.findOne(id);

    // Prevent deletion of submitted superbills
    if (
      superbill.status === SuperbillStatus.SUBMITTED ||
      superbill.status === SuperbillStatus.PROCESSED ||
      superbill.status === SuperbillStatus.PAID
    ) {
      throw new BadRequestException(
        'Cannot delete superbill that has been submitted',
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

    return {
      totalAmount,
      patientResponsibility,
      insurancePayment,
    };
  }
}
