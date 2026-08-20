import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds HTTP request context columns to the audit_logs table so the
 * AuditInterceptor can persist every authenticated request to the DB.
 *
 * Also adds composite indexes for tenant-scoped paginated queries
 * (by createdAt) and per-user lookups (by performedBy).
 */
export class ExtendAuditLogHttpColumns1787000000000 implements MigrationInterface {
  name = 'ExtendAuditLogHttpColumns1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "ip_address" varchar(45) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "user_agent" varchar(500) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "method" varchar(10) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "url" varchar(500) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "status_code" int NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "duration_ms" int NULL
    `);

    // Composite indexes for the admin audit-log dashboard
    // NOTE: audit_logs uses camelCase column names (createdAt, performedBy)
    // except for tenant_id which was added later with snake_case.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_logs_tenant_created_at"
        ON "audit_logs" ("tenant_id", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_logs_tenant_performed_by"
        ON "audit_logs" ("tenant_id", "performedBy")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_tenant_performed_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_tenant_created_at"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "duration_ms"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "status_code"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "url"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "method"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "user_agent"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "ip_address"`);
  }
}
