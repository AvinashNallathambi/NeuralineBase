import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the trial_requests table used to track demo requests from the
 * marketing website through admin approval, trial provisioning, conversion,
 * and churn lifecycle.
 */
export class CreateTrialRequests1784361700000 implements MigrationInterface {
  name = 'CreateTrialRequests1784361700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "trial_requests_plan_type_enum" AS ENUM ('solo', 'professional', 'enterprise')
    `);
    await queryRunner.query(`
      CREATE TYPE "trial_requests_status_enum" AS ENUM ('pending', 'approved', 'active', 'rejected', 'disabled', 'converted', 'expired', 'wiped')
    `);

    await queryRunner.query(`
      CREATE TABLE "trial_requests" (
        "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email"             varchar(255) NOT NULL,
        "first_name"        varchar(100) NOT NULL,
        "last_name"         varchar(100) NOT NULL,
        "phone"             varchar(50),
        "practice_name"     varchar(255) NOT NULL,
        "plan_type"         "trial_requests_plan_type_enum" NOT NULL,
        "status"            "trial_requests_status_enum" NOT NULL DEFAULT 'pending',
        "tenant_id"         uuid,
        "admin_user_id"     uuid,
        "trial_ends_at"     timestamptz,
        "disabled_at"       timestamptz,
        "converted_at"      timestamptz,
        "wiped_at"          timestamptz,
        "deletion_warning_sent_at" timestamptz,
        "notes"             text,
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_trial_requests" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_trial_requests_status" ON "trial_requests" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_trial_requests_email" ON "trial_requests" ("email")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_trial_requests_tenant_id" ON "trial_requests" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trial_requests_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trial_requests_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trial_requests_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trial_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "trial_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "trial_requests_plan_type_enum"`);
  }
}
