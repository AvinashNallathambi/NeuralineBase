import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEpcsTables1786000000000 implements MigrationInterface {
  name = 'CreateEpcsTables1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── EPCS Provider Enrollments ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "epcs_provider_enrollments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "user_name" varchar(200) NOT NULL,
        "dea_number" varchar(20) NOT NULL,
        "npi_number" varchar(20) NOT NULL,
        "state_license" varchar(50),
        "practice_state" varchar(2),
        "identity_proofing_status" varchar(30) NOT NULL DEFAULT 'not_started',
        "identity_proofed_at" timestamptz,
        "identity_proofed_by" uuid,
        "identity_proofing_method" varchar(50),
        "two_factor_method" varchar(20),
        "two_factor_enrolled_at" timestamptz,
        "two_factor_secret" varchar(255),
        "access_control_granted" boolean NOT NULL DEFAULT false,
        "access_control_granted_by" uuid,
        "access_control_granted_by_name" varchar(200),
        "access_control_granted_at" timestamptz,
        "status" varchar(30) NOT NULL DEFAULT 'pending',
        "suspended_reason" text,
        "suspended_at" timestamptz,
        "surescripts_spi" varchar(50),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_epcs_provider_enrollments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_epcs_enrollments_tenant_user"
      ON "epcs_provider_enrollments" ("tenant_id", "user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_enrollments_tenant_status"
      ON "epcs_provider_enrollments" ("tenant_id", "status")
    `);

    // ── EPCS Audit Logs (immutable, cryptographically chained) ──────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "epcs_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "action" varchar(50) NOT NULL,
        "prescription_id" uuid,
        "user_id" uuid,
        "user_name" varchar(200),
        "user_role" varchar(50),
        "patient_id" varchar(100),
        "patient_name" varchar(200),
        "medication" varchar(255),
        "dea_schedule" varchar(5),
        "quantity" int,
        "two_factor_method" varchar(20),
        "two_factor_success" boolean,
        "transmission_id" varchar(100),
        "pharmacy_ncpdp" varchar(20),
        "pharmacy_name" varchar(255),
        "previous_hash" varchar(64),
        "entry_hash" varchar(64) NOT NULL,
        "ip_address" varchar(45),
        "user_agent" varchar(500),
        "description" text,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_epcs_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_audit_tenant_created"
      ON "epcs_audit_logs" ("tenant_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_audit_tenant_prescription"
      ON "epcs_audit_logs" ("tenant_id", "prescription_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_audit_tenant_user"
      ON "epcs_audit_logs" ("tenant_id", "user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_audit_tenant_action"
      ON "epcs_audit_logs" ("tenant_id", "action")
    `);

    // ── EPCS Transmission Logs ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "epcs_transmission_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "prescription_id" uuid NOT NULL,
        "transmission_id" varchar(100) NOT NULL,
        "message_type" varchar(20) NOT NULL DEFAULT 'NewRx',
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "pharmacy_ncpdp" varchar(20),
        "pharmacy_name" varchar(255),
        "pharmacy_phone" varchar(20),
        "prescriber_dea" varchar(20),
        "prescriber_npi" varchar(20),
        "prescriber_spi" varchar(50),
        "signature_method" varchar(20),
        "signed_at" timestamptz,
        "response_code" varchar(10),
        "response_message" text,
        "transmitted_at" timestamptz,
        "confirmed_at" timestamptz,
        "retry_count" int NOT NULL DEFAULT 0,
        "error_details" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_epcs_transmission_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_transmission_tenant_prescription"
      ON "epcs_transmission_logs" ("tenant_id", "prescription_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_transmission_tenant_status"
      ON "epcs_transmission_logs" ("tenant_id", "status")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_epcs_transmission_tenant_txid"
      ON "epcs_transmission_logs" ("tenant_id", "transmission_id")
    `);

    // ── EPCS PDMP Queries ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "epcs_pdmp_queries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "patient_id" varchar(100) NOT NULL,
        "patient_name" varchar(200) NOT NULL,
        "provider_id" varchar(100) NOT NULL,
        "provider_name" varchar(200) NOT NULL,
        "state" varchar(2) NOT NULL,
        "query_status" varchar(20) NOT NULL DEFAULT 'pending',
        "query_id" varchar(100),
        "cs_prescription_count" int NOT NULL DEFAULT 0,
        "prescriber_count" int NOT NULL DEFAULT 0,
        "pharmacy_count" int NOT NULL DEFAULT 0,
        "total_mme" decimal(10,2) NOT NULL DEFAULT 0,
        "early_refill_count" int NOT NULL DEFAULT 0,
        "risk_level" varchar(20),
        "risk_score" int NOT NULL DEFAULT 0,
        "raw_response" jsonb,
        "ai_summary" text,
        "red_flags" jsonb,
        "recommendations" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_epcs_pdmp_queries" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_pdmp_tenant_patient"
      ON "epcs_pdmp_queries" ("tenant_id", "patient_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_pdmp_tenant_provider"
      ON "epcs_pdmp_queries" ("tenant_id", "provider_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_epcs_pdmp_tenant_created"
      ON "epcs_pdmp_queries" ("tenant_id", "created_at")
    `);

    // ── Extend prescriptions table with EPCS columns ───────────────────────
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "is_controlled_substance" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "dea_schedule" varchar(5)
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "prescriber_dea_number" varchar(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "prescriber_npi" varchar(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "epcs_signature_method" varchar(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "epcs_signed_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "epcs_signed_by" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "epcs_transmission_status" varchar(20) NOT NULL DEFAULT 'not_transmitted'
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "epcs_transmission_id" varchar(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "pharmacy_ncpdp" varchar(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "pdmp_query_id" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove EPCS columns from prescriptions
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "pdmp_query_id"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "pharmacy_ncpdp"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "epcs_transmission_id"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "epcs_transmission_status"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "epcs_signed_by"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "epcs_signed_at"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "epcs_signature_method"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "prescriber_npi"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "prescriber_dea_number"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "dea_schedule"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "is_controlled_substance"`);

    // Drop EPCS tables
    await queryRunner.query(`DROP TABLE IF EXISTS "epcs_pdmp_queries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "epcs_transmission_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "epcs_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "epcs_provider_enrollments"`);
  }
}
