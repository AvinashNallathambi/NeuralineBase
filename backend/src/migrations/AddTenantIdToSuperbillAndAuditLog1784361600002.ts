import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds tenant_id columns to the superbills and audit_logs tables so that
 * tenant-scoped operations (including the "Start Fresh" clinical data wipe)
 * can target these tables directly.
 *
 * The columns are nullable to allow existing rows to be backfilled separately
 * before a future migration makes them NOT NULL.
 */
export class AddTenantIdToSuperbillAndAuditLog1784361600002 implements MigrationInterface {
  name = 'AddTenantIdToSuperbillAndAuditLog1784361600002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── superbills ────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "superbills"
        ADD COLUMN IF NOT EXISTS "tenant_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_superbills_tenant_id"
        ON "superbills" ("tenant_id")
    `);

    // ── audit_logs ────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "tenant_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_logs_tenant_id"
        ON "audit_logs" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_audit_logs_tenant_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        DROP COLUMN IF EXISTS "tenant_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_superbills_tenant_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "superbills"
        DROP COLUMN IF EXISTS "tenant_id"
    `);
  }
}
