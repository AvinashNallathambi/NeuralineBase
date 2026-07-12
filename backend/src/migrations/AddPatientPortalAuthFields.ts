import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientPortalAuthFields1700000000000 implements MigrationInterface {
  name = 'AddPatientPortalAuthFields1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add patient portal authentication fields to the patients table
    await queryRunner.query(`
      ALTER TABLE "patients"
      ADD COLUMN IF NOT EXISTS "password_hash" varchar(255),
      ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "mfa_secret" varchar(255),
      ADD COLUMN IF NOT EXISTS "portal_active" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "last_login_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "password_reset_token" varchar(255),
      ADD COLUMN IF NOT EXISTS "password_reset_expires_at" timestamptz
    `);

    // Add unique index on email for portal login (only for non-null emails)
    // Note: We use a partial index since email is nullable for existing patients
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_patients_tenant_email_portal"
      ON "patients" ("tenant_id", "email")
      WHERE "email" IS NOT NULL AND "portal_active" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_patients_tenant_email_portal"`);
    await queryRunner.query(`
      ALTER TABLE "patients"
      DROP COLUMN IF EXISTS "password_reset_expires_at",
      DROP COLUMN IF EXISTS "password_reset_token",
      DROP COLUMN IF EXISTS "last_login_at",
      DROP COLUMN IF EXISTS "portal_active",
      DROP COLUMN IF EXISTS "mfa_secret",
      DROP COLUMN IF EXISTS "mfa_enabled",
      DROP COLUMN IF EXISTS "password_hash"
    `);
  }
}
