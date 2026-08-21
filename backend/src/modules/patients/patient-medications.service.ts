import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PatientMedication,
  PatientMedicationSource,
  PatientMedicationStatus,
  PatientMedicationTakingStatus,
} from './entities/patient-medication.entity';
import {
  CreatePatientMedicationDto,
  UpdatePatientMedicationDto,
  DiscontinuePatientMedicationDto,
  QueryPatientMedicationDto,
} from './dto/patient-medication.dto';

@Injectable()
export class PatientMedicationsService {
  private readonly logger = new Logger(PatientMedicationsService.name);

  constructor(
    @InjectRepository(PatientMedication)
    private readonly medicationRepository: Repository<PatientMedication>,
  ) {}

  async list(
    tenantId: string,
    patientId: string,
    query: QueryPatientMedicationDto = {},
  ): Promise<PatientMedication[]> {
    const where: Record<string, unknown> = { tenantId, patientId };
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    return this.medicationRepository.find({
      where,
      order: { status: 'ASC', createdAt: 'DESC' },
    });
  }

  async findOne(
    tenantId: string,
    patientId: string,
    medicationId: string,
  ): Promise<PatientMedication> {
    const medication = await this.medicationRepository.findOne({
      where: { id: medicationId, tenantId, patientId },
    });
    if (!medication) {
      throw new NotFoundException(`Medication with ID "${medicationId}" not found`);
    }
    return medication;
  }

  async create(
    tenantId: string,
    patientId: string,
    dto: CreatePatientMedicationDto,
    recordedBy?: string,
  ): Promise<PatientMedication> {
    const medication = this.medicationRepository.create({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      tenantId,
      patientId,
      source: dto.source || PatientMedicationSource.PATIENT_REPORTED,
      status: dto.status || PatientMedicationStatus.ACTIVE,
      takingStatus: dto.takingStatus || PatientMedicationTakingStatus.TAKING,
      recordedBy: recordedBy || null,
    });
    const saved = await this.medicationRepository.save(medication);
    this.logger.log(
      `Patient medication created: ${saved.id} ("${saved.name}") for patient ${patientId}`,
    );
    return saved;
  }

  async update(
    tenantId: string,
    patientId: string,
    medicationId: string,
    dto: UpdatePatientMedicationDto,
    recordedBy?: string,
  ): Promise<PatientMedication> {
    const medication = await this.findOne(tenantId, patientId, medicationId);
    const { startDate, endDate, ...rest } = dto;
    Object.assign(medication, rest);
    if (startDate !== undefined) medication.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) medication.endDate = endDate ? new Date(endDate) : null;
    if (recordedBy) medication.recordedBy = recordedBy;
    const updated = await this.medicationRepository.save(medication);
    this.logger.log(`Patient medication updated: ${medicationId}`);
    return updated;
  }

  async discontinue(
    tenantId: string,
    patientId: string,
    medicationId: string,
    dto: DiscontinuePatientMedicationDto,
    recordedBy?: string,
  ): Promise<PatientMedication> {
    const medication = await this.findOne(tenantId, patientId, medicationId);
    medication.status = PatientMedicationStatus.DISCONTINUED;
    medication.takingStatus = PatientMedicationTakingStatus.NOT_TAKING;
    medication.endDate = new Date();
    medication.discontinuedReason = dto.reason || null;
    if (recordedBy) medication.recordedBy = recordedBy;
    const updated = await this.medicationRepository.save(medication);
    this.logger.log(`Patient medication discontinued: ${medicationId}`);
    return updated;
  }

  async remove(
    tenantId: string,
    patientId: string,
    medicationId: string,
  ): Promise<void> {
    const medication = await this.findOne(tenantId, patientId, medicationId);
    await this.medicationRepository.softRemove(medication);
    this.logger.log(`Patient medication soft deleted: ${medicationId}`);
  }

  // ── Encounter sync helpers ──────────────────────────────────────────

  /** Find medications that originated from a given encounter (for sync dedup). */
  async findByEncounter(
    tenantId: string,
    encounterId: string,
  ): Promise<PatientMedication[]> {
    return this.medicationRepository.find({ where: { tenantId, encounterId } });
  }

  /**
   * Upsert a prescribed medication list entry originating from an encounter.
   * Dedup key: encounterId + medication name (case-insensitive).
   */
  async upsertFromEncounter(
    tenantId: string,
    patientId: string,
    encounterId: string,
    med: {
      name: string;
      dosage?: string;
      frequency?: string;
      route?: string;
      instructions?: string;
      prescriberName?: string;
      prescriptionId?: string;
    },
  ): Promise<PatientMedication> {
    const existing = (await this.findByEncounter(tenantId, encounterId)).find(
      (m) => m.name.toLowerCase().trim() === med.name.toLowerCase().trim(),
    );

    if (existing) {
      existing.dosage = med.dosage || existing.dosage;
      existing.frequency = med.frequency || existing.frequency;
      existing.route = med.route || existing.route;
      existing.instructions = med.instructions ?? existing.instructions;
      existing.prescriberName = med.prescriberName || existing.prescriberName;
      existing.prescriptionId = med.prescriptionId || existing.prescriptionId;
      if (existing.status === PatientMedicationStatus.DISCONTINUED) {
        existing.status = PatientMedicationStatus.ACTIVE;
        existing.takingStatus = PatientMedicationTakingStatus.TAKING;
        existing.endDate = null;
        existing.discontinuedReason = null;
      }
      return this.medicationRepository.save(existing);
    }

    const medication = this.medicationRepository.create({
      tenantId,
      patientId,
      encounterId,
      name: med.name,
      dosage: med.dosage || null,
      frequency: med.frequency || null,
      route: med.route || null,
      instructions: med.instructions || null,
      prescriberName: med.prescriberName || null,
      prescriptionId: med.prescriptionId || null,
      source: PatientMedicationSource.PRESCRIBED,
      status: PatientMedicationStatus.ACTIVE,
      takingStatus: PatientMedicationTakingStatus.TAKING,
      startDate: new Date(),
    });
    return this.medicationRepository.save(medication);
  }

  /**
   * Discontinue an encounter-originated medication that was removed from the
   * encounter's treatment plan (only if still active and prescribed-source).
   */
  async discontinueFromEncounter(
    tenantId: string,
    medicationId: string,
    reason: string,
  ): Promise<void> {
    const medication = await this.medicationRepository.findOne({
      where: { id: medicationId, tenantId },
    });
    if (
      !medication ||
      medication.source !== PatientMedicationSource.PRESCRIBED ||
      medication.status !== PatientMedicationStatus.ACTIVE
    ) {
      return;
    }
    medication.status = PatientMedicationStatus.DISCONTINUED;
    medication.takingStatus = PatientMedicationTakingStatus.NOT_TAKING;
    medication.endDate = new Date();
    medication.discontinuedReason = reason;
    await this.medicationRepository.save(medication);
  }
}
