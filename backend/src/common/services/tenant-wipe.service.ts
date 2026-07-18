import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

interface WipeStep {
  name: string;
  sql: string;
}

/**
 * Hard-deletes all clinical/EHR data for a tenant while preserving core
 * account configuration (users, providers, subscriptions, workflow templates,
 * integrations, notifications, etc.).
 *
 * Deletions are executed inside a single transaction. If any step fails,
 * the entire operation is rolled back.
 */
@Injectable()
export class TenantWipeService {
  private readonly logger = new Logger(TenantWipeService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Wipe all clinical data for a tenant.
   *
   * @param tenantId - The tenant UUID to wipe.
   * @throws Error if the transaction fails; the error is logged and rethrown.
   */
  async wipeClinicalData(tenantId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`[TenantWipe] Starting clinical data wipe for tenant ${tenantId}`);

      for (const step of this.getWipeSteps()) {
        this.logger.debug(`[TenantWipe] ${step.name}`);
        await queryRunner.query(step.sql, [tenantId]);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`[TenantWipe] Clinical data wipe completed for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(
        `[TenantWipe] Wipe failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      try {
        await queryRunner.rollbackTransaction();
        this.logger.log(`[TenantWipe] Transaction rolled back for tenant ${tenantId}`);
      } catch (rollbackError) {
        this.logger.error(
          `[TenantWipe] Rollback failed for tenant ${tenantId}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Returns the ordered list of DELETE statements.
   *
   * Order is children-before-parents (reverse dependency order) based on the
   * foreign-key map in the database audit. Tables without a tenant_id column
   * are deleted by referencing their parent's tenant_id.
   *
   * Core account / protected tables are intentionally excluded:
   *   users, subscriptions, subscription_invoices, subscription_payment_methods,
   *   subscription_payment_plans, providers, provider_availabilities,
   *   provider_availability_overrides, notifications, integrations,
   *   workflow_templates, clinical_templates, favorite_diagnoses,
   *   hipaa_audit_logs, and global reference tables.
   */
  private getWipeSteps(): WipeStep[] {
    return [
      // ── Level 0: Leaf / child tables ────────────────────────────────────
      // audit_logs is ambiguous; it is included only because tenant_id was
      // added to support tenant-scoped cleanup. Consider preserving these for
      // compliance if they are used for PHI access auditing.
      {
        name: 'audit_logs',
        sql: 'DELETE FROM "audit_logs" WHERE "tenant_id" = $1',
      },
      {
        name: 'appeal_status_history',
        sql: `DELETE FROM "appeal_status_history"
              WHERE "appeal_id" IN (SELECT "id" FROM "appeals" WHERE "tenant_id" = $1)`,
      },
      {
        name: 'claim_line_items',
        sql: `DELETE FROM "claim_line_items"
              WHERE "claim_id" IN (SELECT "id" FROM "encounter_claims" WHERE "tenant_id" = $1)`,
      },
      {
        name: 'superbill_charges',
        sql: `DELETE FROM "superbill_charges"
              WHERE "superbillId" IN (SELECT "id" FROM "superbills" WHERE "tenant_id" = $1)`,
      },
      {
        name: 'superbill_diagnoses',
        sql: `DELETE FROM "superbill_diagnoses"
              WHERE "superbillId" IN (SELECT "id" FROM "superbills" WHERE "tenant_id" = $1)`,
      },
      {
        name: 'superbill_procedures',
        sql: `DELETE FROM "superbill_procedures"
              WHERE "superbillId" IN (SELECT "id" FROM "superbills" WHERE "tenant_id" = $1)`,
      },
      {
        name: 'superbill_payments',
        sql: `DELETE FROM "superbill_payments"
              WHERE "superbillId" IN (SELECT "id" FROM "superbills" WHERE "tenant_id" = $1)`,
      },
      {
        name: 'remittance_service_lines',
        sql: 'DELETE FROM "remittance_service_lines" WHERE "tenant_id" = $1',
      },
      {
        name: 'claim_adjustments',
        sql: 'DELETE FROM "claim_adjustments" WHERE "tenant_id" = $1',
      },
      {
        name: 'portal_messages',
        sql: 'DELETE FROM "portal_messages" WHERE "tenant_id" = $1',
      },
      {
        name: 'prescription_status_history',
        sql: 'DELETE FROM "prescription_status_history" WHERE "tenant_id" = $1',
      },
      {
        name: 'prescription_refills',
        sql: 'DELETE FROM "prescription_refills" WHERE "tenant_id" = $1',
      },
      {
        name: 'lab_order_status_history',
        sql: 'DELETE FROM "lab_order_status_history" WHERE "tenant_id" = $1',
      },
      {
        name: 'lab_results',
        sql: 'DELETE FROM "lab_results" WHERE "tenant_id" = $1',
      },
      {
        name: 'lab_specimens',
        sql: 'DELETE FROM "lab_specimens" WHERE "tenant_id" = $1',
      },
      {
        name: 'lab_reference_ranges',
        sql: 'DELETE FROM "lab_reference_ranges" WHERE "tenant_id" = $1',
      },
      {
        name: 'lab_tests',
        sql: 'DELETE FROM "lab_tests" WHERE "tenant_id" = $1',
      },
      {
        name: 'lab_panels',
        sql: 'DELETE FROM "lab_panels" WHERE "tenant_id" = $1',
      },
      {
        name: 'patient_group_audit_logs',
        sql: 'DELETE FROM "patient_group_audit_logs" WHERE "tenant_id" = $1',
      },

      // ── Level 1: Parent / standalone tables ─────────────────────────────
      {
        name: 'appeals',
        sql: 'DELETE FROM "appeals" WHERE "tenant_id" = $1',
      },
      {
        name: 'encounter_claims',
        sql: 'DELETE FROM "encounter_claims" WHERE "tenant_id" = $1',
      },
      {
        name: 'remittance_claims',
        sql: 'DELETE FROM "remittance_claims" WHERE "tenant_id" = $1',
      },
      {
        name: 'portal_conversations',
        sql: 'DELETE FROM "portal_conversations" WHERE "tenant_id" = $1',
      },
      {
        name: 'superbills',
        sql: 'DELETE FROM "superbills" WHERE "tenant_id" = $1',
      },
      {
        name: 'prescriptions',
        sql: 'DELETE FROM "prescriptions" WHERE "tenant_id" = $1',
      },
      {
        name: 'lab_orders',
        sql: 'DELETE FROM "lab_orders" WHERE "tenant_id" = $1',
      },
      {
        name: 'imaging_orders',
        sql: 'DELETE FROM "imaging_orders" WHERE "tenant_id" = $1',
      },
      {
        name: 'invoices',
        sql: 'DELETE FROM "invoices" WHERE "tenant_id" = $1',
      },
      {
        name: 'payments',
        sql: 'DELETE FROM "payments" WHERE "tenant_id" = $1',
      },
      {
        name: 'insurance_verifications',
        sql: 'DELETE FROM "insurance_verifications" WHERE "tenant_id" = $1',
      },
      {
        name: 'patient_insurances',
        sql: 'DELETE FROM "patient_insurances" WHERE "tenant_id" = $1',
      },
      {
        name: 'patient_problems',
        sql: 'DELETE FROM "patient_problems" WHERE "tenant_id" = $1',
      },
      {
        name: 'patient_consents',
        sql: 'DELETE FROM "patient_consents" WHERE "tenant_id" = $1',
      },
      {
        name: 'patient_groups',
        sql: 'DELETE FROM "patient_groups" WHERE "tenant_id" = $1',
      },
      {
        name: 'telemedicine_sessions',
        sql: 'DELETE FROM "telemedicine_sessions" WHERE "tenant_id" = $1',
      },
      {
        name: 'denial_records',
        sql: 'DELETE FROM "denial_records" WHERE "tenant_id" = $1',
      },
      {
        name: 'underpayment_records',
        sql: 'DELETE FROM "underpayment_records" WHERE "tenant_id" = $1',
      },
      {
        name: 'eobs',
        sql: 'DELETE FROM "eobs" WHERE "tenant_id" = $1',
      },
      {
        name: 'workflow_instances',
        sql: 'DELETE FROM "workflow_instances" WHERE "tenant_id" = $1',
      },
      {
        name: 'payer_contracts',
        sql: 'DELETE FROM "payer_contracts" WHERE "tenant_id" = $1',
      },
      {
        name: 'appointments',
        sql: 'DELETE FROM "appointments" WHERE "tenant_id" = $1',
      },

      // ── Level 2: Mid-level parents ──────────────────────────────────────
      {
        name: 'encounters',
        sql: 'DELETE FROM "encounters" WHERE "tenant_id" = $1',
      },
      {
        name: 'remittances',
        sql: 'DELETE FROM "remittances" WHERE "tenant_id" = $1',
      },

      // ── Level 3: Root clinical tables ───────────────────────────────────
      {
        name: 'patients',
        sql: 'DELETE FROM "patients" WHERE "tenant_id" = $1',
      },
      {
        name: 'insurance_payers',
        sql: 'DELETE FROM "insurance_payers" WHERE "tenant_id" = $1',
      },
    ];
  }
}
