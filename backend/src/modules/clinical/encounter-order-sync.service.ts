import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LaboratoryService } from '../laboratory/laboratory.service';
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import { PatientsService } from '../patients/patients.service';
import { ProvidersService } from '../providers/providers.service';
import { LabOrder } from '../laboratory/entities/lab-order.entity';
import { LabTest } from '../laboratory/entities/lab-test.entity';
import { ImagingOrder } from '../laboratory/entities/imaging-order.entity';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { Encounter } from './entities/encounter.entity';

/**
 * Propagates lab orders, imaging orders, and medications stored in the
 * encounter's JSONB columns into the real `lab_orders`, `imaging_orders`,
 * and `prescriptions` tables so they appear in the Laboratory module,
 * Prescriptions module, patient portal, and participate in the full
 * order lifecycle (collect → result → complete).
 *
 * Dedup key:
 *   - Lab:         encounterId + test name (case-insensitive)
 *   - Imaging:     encounterId + study name (case-insensitive)
 *   - Medications: encounterId + medication name (case-insensitive)
 *
 * Orders that have already progressed past "ordered" (e.g. collected,
 * in_progress, resulted, completed) are never modified by the sync — the
 * lab/radiology team owns the lifecycle from that point forward.
 * Prescriptions past "draft" are left to the pharmacy/prescriber workflow.
 */
@Injectable()
export class EncounterOrderSyncService {
  private readonly logger = new Logger(EncounterOrderSyncService.name);

  constructor(
    private readonly laboratoryService: LaboratoryService,
    private readonly prescriptionsService: PrescriptionsService,
    private readonly patientsService: PatientsService,
    private readonly providersService: ProvidersService,
    @InjectRepository(LabOrder)
    private readonly labOrderRepository: Repository<LabOrder>,
    @InjectRepository(LabTest)
    private readonly labTestRepository: Repository<LabTest>,
    @InjectRepository(ImagingOrder)
    private readonly imagingOrderRepository: Repository<ImagingOrder>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
  ) {}

  /**
   * Synchronise lab orders, imaging orders, and medications from an
   * encounter's JSONB fields into the real database tables.
   */
  async syncEncounterOrders(tenantId: string, encounter: Encounter): Promise<void> {
    const patientName = await this.resolvePatientName(tenantId, encounter.patientId);
    const providerName = await this.resolveProviderName(tenantId, encounter.providerId);

    if (encounter.orders) {
      await this.syncLabOrders(tenantId, encounter, patientName, providerName);
      await this.syncImagingOrders(tenantId, encounter, patientName, providerName);
    }
    if (encounter.treatmentPlan?.medications) {
      await this.syncMedications(tenantId, encounter, patientName, providerName);
    }
  }

  // ───────────────────────────────────────────────────────────
  // Lab Orders
  // ───────────────────────────────────────────────────────────

  private async syncLabOrders(
    tenantId: string,
    encounter: Encounter,
    patientName: string,
    providerName: string,
  ): Promise<void> {
    const encounterLabs = encounter.orders?.labs || [];

    // Load existing lab orders for this encounter
    const existingOrders = await this.labOrderRepository.find({
      where: { tenantId, encounterId: encounter.id },
    });

    // Load all tests for those orders to build a name → order map
    let existingByTestName = new Map<string, LabOrder>();
    if (existingOrders.length > 0) {
      const tests = await this.labTestRepository.find({
        where: { tenantId, orderId: In(existingOrders.map((o) => o.id)) },
      });
      for (const test of tests) {
        const key = test.name.toLowerCase();
        // Only map the first order per test name
        if (!existingByTestName.has(key)) {
          const order = existingOrders.find((o) => o.id === test.orderId);
          if (order) existingByTestName.set(key, order);
        }
      }
    }

    const stillPresentOrderIds = new Set<string>();

    for (const lab of encounterLabs) {
      const key = (lab.name || '').toLowerCase().trim();
      if (!key) continue;

      const existing = existingByTestName.get(key);

      if (existing) {
        stillPresentOrderIds.add(existing.id);
        // Only update status if the order is still editable and the
        // encounter status differs.
        if (
          lab.status &&
          lab.status !== existing.status &&
          ['draft', 'ordered'].includes(existing.status)
        ) {
          try {
            await this.laboratoryService.updateOrderStatus(tenantId, existing.id, {
              status: lab.status,
              reason: 'Updated from encounter',
            });
          } catch (err) {
            this.logger.warn(
              `Failed to update lab order ${existing.id} status from encounter: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } else {
        // Create a new lab order with a single test matching the encounter lab name
        try {
          await this.laboratoryService.createOrder(tenantId, {
            patientId: encounter.patientId,
            patientName,
            providerId: encounter.providerId,
            providerName,
            encounterId: encounter.id,
            tests: [{ name: lab.name, loincCode: lab.loincCode }],
            status: lab.status || 'ordered',
            priority: (lab.priority as any) || 'routine',
            notes: lab.notes || undefined,
            orderedDate: lab.orderedDate,
          } as any);
          this.logger.log(
            `Created lab order "${lab.name}" from encounter ${encounter.id}`,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to create lab order "${lab.name}" from encounter: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // Cancel orders that were removed from the encounter — but only if
    // they haven't been collected/processed yet.
    for (const order of existingOrders) {
      if (
        !stillPresentOrderIds.has(order.id) &&
        ['draft', 'ordered'].includes(order.status)
      ) {
        try {
          await this.laboratoryService.updateOrderStatus(tenantId, order.id, {
            status: 'cancelled',
            reason: 'Removed from encounter',
          });
        } catch (err) {
          this.logger.warn(
            `Failed to cancel orphaned lab order ${order.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // Imaging Orders
  // ───────────────────────────────────────────────────────────

  private async syncImagingOrders(
    tenantId: string,
    encounter: Encounter,
    patientName: string,
    providerName: string,
  ): Promise<void> {
    const encounterImaging = encounter.orders?.imaging || [];

    const existingOrders = await this.imagingOrderRepository.find({
      where: { tenantId, encounterId: encounter.id },
    });

    const existingByStudyName = new Map<string, ImagingOrder>();
    for (const order of existingOrders) {
      existingByStudyName.set(order.studyName.toLowerCase().trim(), order);
    }

    const stillPresentIds = new Set<string>();

    for (const img of encounterImaging) {
      const studyName = img.name || 'Unspecified';
      const key = studyName.toLowerCase().trim();
      if (!key) continue;

      const existing = existingByStudyName.get(key);

      if (existing) {
        stillPresentIds.add(existing.id);
        if (
          img.status &&
          img.status !== existing.status &&
          ['ordered', 'scheduled'].includes(existing.status)
        ) {
          try {
            await this.laboratoryService.updateImaging(tenantId, existing.id, {
              status: img.status,
            } as any);
          } catch (err) {
            this.logger.warn(
              `Failed to update imaging order ${existing.id} status from encounter: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } else {
        try {
          await this.laboratoryService.createImaging(tenantId, {
            patientId: encounter.patientId,
            patientName,
            providerId: encounter.providerId,
            providerName,
            encounterId: encounter.id,
            modality: (img.modality || 'other') as any,
            bodyPart: img.bodyPart || 'Unspecified',
            studyName,
            status: img.status || 'ordered',
            priority: 'routine',
            orderedDate: img.orderedDate,
          } as any);
          this.logger.log(
            `Created imaging order "${studyName}" from encounter ${encounter.id}`,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to create imaging order "${studyName}" from encounter: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // Cancel removed imaging orders (only if not yet in progress)
    for (const order of existingOrders) {
      if (
        !stillPresentIds.has(order.id) &&
        ['ordered', 'scheduled'].includes(order.status)
      ) {
        try {
          await this.laboratoryService.updateImaging(tenantId, order.id, {
            status: 'cancelled',
          } as any);
        } catch (err) {
          this.logger.warn(
            `Failed to cancel orphaned imaging order ${order.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // Medications → Prescriptions
  // ───────────────────────────────────────────────────────────

  private async syncMedications(
    tenantId: string,
    encounter: Encounter,
    patientName: string,
    providerName: string,
  ): Promise<void> {
    const encounterMeds = encounter.treatmentPlan?.medications || [];

    // Load existing prescriptions created from this encounter
    const existingPrescriptions = await this.prescriptionRepository.find({
      where: { tenantId, encounterId: encounter.id },
    });

    // Build a map of existing prescriptions keyed by medication name
    const existingByMedName = new Map<string, Prescription>();
    for (const rx of existingPrescriptions) {
      for (const med of rx.medications || []) {
        const key = (med.medication || '').toLowerCase().trim();
        if (key && !existingByMedName.has(key)) {
          existingByMedName.set(key, rx);
        }
      }
    }

    const stillPresentIds = new Set<string>();

    for (const med of encounterMeds) {
      const key = (med.name || '').toLowerCase().trim();
      if (!key) continue;

      const existing = existingByMedName.get(key);

      if (existing) {
        stillPresentIds.add(existing.id);
        // Only update if still in draft status
        if (existing.status === 'draft') {
          try {
            await this.prescriptionsService.update(tenantId, existing.id, {
              medications: [
                {
                  id: existing.medications[0]?.id || `med-${Date.now()}`,
                  medication: med.name,
                  dosage: med.dosage || '',
                  frequency: med.frequency || '',
                  route: med.route || 'oral',
                  duration: med.duration || '',
                  quantity: 0,
                  refills: med.refills || 0,
                  instructions: med.instructions,
                },
              ],
            } as any);
          } catch (err) {
            this.logger.warn(
              `Failed to update prescription ${existing.id} from encounter: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } else {
        // Create a new prescription from the encounter medication
        try {
          await this.prescriptionsService.create(tenantId, {
            patientId: encounter.patientId,
            patientName,
            providerId: encounter.providerId,
            providerName,
            encounterId: encounter.id,
            medications: [
              {
                id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                medication: med.name,
                dosage: med.dosage || '',
                frequency: med.frequency || '',
                route: med.route || 'oral',
                duration: med.duration || '',
                quantity: 0,
                refills: med.refills || 0,
                instructions: med.instructions,
              },
            ],
            status: 'active',
            prescribedDate: new Date().toISOString(),
          } as any);
          this.logger.log(
            `Created prescription for "${med.name}" from encounter ${encounter.id}`,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to create prescription for "${med.name}" from encounter: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // Cancel prescriptions that were removed from the encounter — only if
    // still in draft status (active prescriptions are owned by the
    // prescriber/pharmacy workflow).
    for (const rx of existingPrescriptions) {
      if (!stillPresentIds.has(rx.id) && rx.status === 'draft') {
        try {
          await this.prescriptionsService.updateStatus(tenantId, rx.id, {
            status: 'cancelled',
            reason: 'Removed from encounter',
          });
        } catch (err) {
          this.logger.warn(
            `Failed to cancel orphaned prescription ${rx.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // Name resolution helpers
  // ───────────────────────────────────────────────────────────

  private async resolvePatientName(tenantId: string, patientId: string): Promise<string> {
    try {
      const patient = await this.patientsService.findOne(tenantId, patientId);
      return `${patient.firstName} ${patient.lastName}`.trim();
    } catch {
      return patientId;
    }
  }

  private async resolveProviderName(tenantId: string, providerId: string): Promise<string> {
    try {
      const provider = await this.providersService.findOne(tenantId, providerId);
      return `${provider.firstName} ${provider.lastName}`.trim();
    } catch {
      return providerId;
    }
  }
}
