import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds claim-lifecycle fields and the superbill_payments table to support
 * resubmit / void / corrected-claim / payment / adjustment / balance
 * workflows that were missing from the superbills module.
 *
 * Changes:
 *   - superbills: new columns (fee_schedule, claim_frequency, admission_date,
 *     discharge_date, is_employment_related, is_auto_accident,
 *     is_other_accident) and extended status enum (resubmitted, voided,
 *     corrected).
 *   - superbill_payments: new table backing the SuperbillPayment entity.
 */
export class AddSuperbillClaimLifecycle1784361800000 implements MigrationInterface {
  name = 'AddSuperbillClaimLifecycle1784361800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── superbills: extend status enum ────────────────────────────────────
    // TypeORM names the enum type `<table>_<column>_enum` by default.
    await queryRunner.query(`
      ALTER TYPE "superbills_status_enum"
        ADD VALUE IF NOT EXISTS 'resubmitted'
    `);
    await queryRunner.query(`
      ALTER TYPE "superbills_status_enum"
        ADD VALUE IF NOT EXISTS 'voided'
    `);
    await queryRunner.query(`
      ALTER TYPE "superbills_status_enum"
        ADD VALUE IF NOT EXISTS 'corrected'
    `);

    // ── superbills: new columns ───────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "superbills"
        ADD COLUMN IF NOT EXISTS "feeSchedule" varchar(100) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        ADD COLUMN IF NOT EXISTS "claimFrequency" varchar(10) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        ADD COLUMN IF NOT EXISTS "admissionDate" date NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        ADD COLUMN IF NOT EXISTS "dischargeDate" date NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        ADD COLUMN IF NOT EXISTS "isEmploymentRelated" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        ADD COLUMN IF NOT EXISTS "isAutoAccident" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        ADD COLUMN IF NOT EXISTS "isOtherAccident" boolean NOT NULL DEFAULT false
    `);

    // ── superbill_payments table ──────────────────────────────────────────
    // Enum type for superbill_payments.type — must exist before the table.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'superbill_payments_type_enum'
        ) THEN
          CREATE TYPE "superbill_payments_type_enum" AS ENUM (
            'copay', 'insurance_payment', 'write_off', 'adjustment'
          );
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "superbill_payments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" "superbill_payments_type_enum" NOT NULL,
        "amount" decimal(10, 2) NOT NULL,
        "date" date NULL,
        "note" text NULL,
        "source" varchar(100) NULL,
        "superbillId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_superbill_payments_superbill"
          FOREIGN KEY ("superbillId")
          REFERENCES "superbills" ("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_superbill_payments_superbillId"
        ON "superbill_payments" ("superbillId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_superbill_payments_superbillId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "superbill_payments"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "superbill_payments_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "superbills"
        DROP COLUMN IF EXISTS "isOtherAccident"
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        DROP COLUMN IF EXISTS "isAutoAccident"
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        DROP COLUMN IF EXISTS "isEmploymentRelated"
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        DROP COLUMN IF EXISTS "dischargeDate"
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        DROP COLUMN IF EXISTS "admissionDate"
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        DROP COLUMN IF EXISTS "claimFrequency"
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        DROP COLUMN IF EXISTS "feeSchedule"
    `);

    // Note: PG does not support removing individual values from an enum type
    // without recreating it. The added enum values (resubmitted, voided,
    // corrected) are left in place on rollback to avoid a destructive
    // enum rebuild.
  }
}
