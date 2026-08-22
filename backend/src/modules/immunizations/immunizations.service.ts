import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientImmunization } from './entities/patient-immunization.entity';
import { CreateImmunizationDto } from './dto/create-immunization.dto';

@Injectable()
export class ImmunizationsService {
  private readonly logger = new Logger(ImmunizationsService.name);

  constructor(
    @InjectRepository(PatientImmunization)
    private readonly repository: Repository<PatientImmunization>,
  ) {}

  async findByPatient(tenantId: string, patientId: string): Promise<PatientImmunization[]> {
    return this.repository.find({
      where: { tenantId, patientId },
      order: { administeredDate: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<PatientImmunization> {
    const record = await this.repository.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException(`Immunization "${id}" not found`);
    return record;
  }

  async create(tenantId: string, dto: CreateImmunizationDto, recordedBy?: string): Promise<PatientImmunization> {
    const record = new PatientImmunization();
    record.tenantId = tenantId;
    record.patientId = dto.patientId;
    record.vaccineName = dto.vaccineName;
    record.cvxCode = dto.cvxCode || null;
    record.cptCode = dto.cptCode || null;
    record.ndcCode = dto.ndcCode || null;
    record.manufacturer = dto.manufacturer || null;
    record.lotNumber = dto.lotNumber || null;
    record.expirationDate = dto.expirationDate ? new Date(dto.expirationDate) : null;
    record.administeredDate = new Date(dto.administeredDate);
    record.doseNumber = dto.doseNumber || null;
    record.doseAmount = dto.doseAmount || null;
    record.doseUnit = dto.doseUnit || null;
    record.route = dto.route || null;
    record.site = dto.site || null;
    record.status = (dto.status as any) || 'completed';
    record.source = (dto.source as any) || 'administered';
    record.encounterId = dto.encounterId || null;
    record.providerId = dto.providerId || null;
    record.providerName = dto.providerName || null;
    record.facilityName = dto.facilityName || null;
    record.visDate = dto.visDate ? new Date(dto.visDate) : null;
    record.vfcEligibility = dto.vfcEligibility || null;
    record.fundingSource = dto.fundingSource || null;
    record.reactionNotes = dto.reactionNotes || null;
    record.notes = dto.notes || null;
    record.recordedBy = recordedBy || null;

    const saved = await this.repository.save(record);
    this.logger.log(`Immunization created: ${saved.id} for patient ${dto.patientId}`);
    return saved;
  }

  async update(tenantId: string, id: string, dto: Partial<CreateImmunizationDto>): Promise<PatientImmunization> {
    const record = await this.findOne(tenantId, id);
    if (dto.vaccineName !== undefined) record.vaccineName = dto.vaccineName;
    if (dto.cvxCode !== undefined) record.cvxCode = dto.cvxCode || null;
    if (dto.cptCode !== undefined) record.cptCode = dto.cptCode || null;
    if (dto.ndcCode !== undefined) record.ndcCode = dto.ndcCode || null;
    if (dto.manufacturer !== undefined) record.manufacturer = dto.manufacturer || null;
    if (dto.lotNumber !== undefined) record.lotNumber = dto.lotNumber || null;
    if (dto.expirationDate !== undefined) record.expirationDate = dto.expirationDate ? new Date(dto.expirationDate) : null;
    if (dto.administeredDate !== undefined) record.administeredDate = new Date(dto.administeredDate);
    if (dto.doseNumber !== undefined) record.doseNumber = dto.doseNumber || null;
    if (dto.doseAmount !== undefined) record.doseAmount = dto.doseAmount || null;
    if (dto.doseUnit !== undefined) record.doseUnit = dto.doseUnit || null;
    if (dto.route !== undefined) record.route = dto.route || null;
    if (dto.site !== undefined) record.site = dto.site || null;
    if (dto.status !== undefined) record.status = dto.status as any;
    if (dto.source !== undefined) record.source = dto.source as any;
    if (dto.encounterId !== undefined) record.encounterId = dto.encounterId || null;
    if (dto.providerId !== undefined) record.providerId = dto.providerId || null;
    if (dto.providerName !== undefined) record.providerName = dto.providerName || null;
    if (dto.facilityName !== undefined) record.facilityName = dto.facilityName || null;
    if (dto.visDate !== undefined) record.visDate = dto.visDate ? new Date(dto.visDate) : null;
    if (dto.vfcEligibility !== undefined) record.vfcEligibility = dto.vfcEligibility || null;
    if (dto.fundingSource !== undefined) record.fundingSource = dto.fundingSource || null;
    if (dto.reactionNotes !== undefined) record.reactionNotes = dto.reactionNotes || null;
    if (dto.notes !== undefined) record.notes = dto.notes || null;
    return this.repository.save(record);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const record = await this.findOne(tenantId, id);
    await this.repository.softRemove(record);
    this.logger.log(`Immunization removed: ${id}`);
  }

  /** Returns immunizations in a simplified format for AI care gap detection */
  async getForAiCareGap(tenantId: string, patientId: string): Promise<Array<{ name: string; date?: string }>> {
    const records = await this.findByPatient(tenantId, patientId);
    return records
      .filter((r) => r.status === 'completed')
      .map((r) => ({
        name: r.vaccineName,
        date: r.administeredDate ? new Date(r.administeredDate).toISOString().split('T')[0] : undefined,
      }));
  }
}
