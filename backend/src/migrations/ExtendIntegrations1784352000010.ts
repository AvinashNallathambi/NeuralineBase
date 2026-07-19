import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendIntegrations1784352000010 implements MigrationInterface {
  name = 'ExtendIntegrations1784352000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to integrations table
    await queryRunner.query(`
      ALTER TABLE "integrations"
      ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'disconnected'
    `);
    await queryRunner.query(`
      ALTER TABLE "integrations"
      ADD COLUMN IF NOT EXISTS "category" varchar(50)
    `);
    await queryRunner.query(`
      ALTER TABLE "integrations"
      ADD COLUMN IF NOT EXISTS "last_connected_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "integrations"
      ADD COLUMN IF NOT EXISTS "error_message" text
    `);
    await queryRunner.query(`
      ALTER TABLE "integrations"
      ADD COLUMN IF NOT EXISTS "credentials" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "integrations"
      ADD COLUMN IF NOT EXISTS "requires_oauth" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "integrations"
      ADD COLUMN IF NOT EXISTS "configurable" boolean NOT NULL DEFAULT false
    `);

    // Create integration_audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "integration_key" varchar(50) NOT NULL,
        "action" varchar(50) NOT NULL,
        "performed_by" varchar(255),
        "detail" text,
        "previous_status" varchar(50),
        "new_status" varchar(50),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_integration_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_audit_logs_tenant_key"
      ON "integration_audit_logs" ("tenant_id", "integration_key")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_audit_logs_tenant_created"
      ON "integration_audit_logs" ("tenant_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "integration_audit_logs"`);
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN IF EXISTS "configurable"`);
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN IF EXISTS "requires_oauth"`);
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN IF EXISTS "credentials"`);
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN IF EXISTS "error_message"`);
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN IF EXISTS "last_connected_at"`);
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN IF EXISTS "category"`);
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN IF EXISTS "status"`);
  }
}
