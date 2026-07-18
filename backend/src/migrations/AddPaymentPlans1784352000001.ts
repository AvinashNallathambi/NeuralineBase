import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates subscription_payment_plans table for payment plan / scheduled
 * payment management (Phase 4).
 */
export class AddPaymentPlans1784352000001 implements MigrationInterface {
  name = 'AddPaymentPlans1784352000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "subscription_payment_plans_frequency_enum"
      AS ENUM ('weekly', 'biweekly', 'monthly')
    `);
    await queryRunner.query(`
      CREATE TYPE "subscription_payment_plans_status_enum"
      AS ENUM ('active', 'completed', 'cancelled', 'past_due')
    `);

    await queryRunner.query(`
      CREATE TABLE "subscription_payment_plans" (
        "id"                        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"                 uuid NOT NULL,
        "subscription_id"           uuid,
        "description"               varchar(255) NOT NULL,
        "total_amount"              decimal(10,2) NOT NULL,
        "paid_amount"               decimal(10,2) NOT NULL DEFAULT 0,
        "installment_amount"        decimal(10,2) NOT NULL,
        "frequency"                 "subscription_payment_plans_frequency_enum" NOT NULL DEFAULT 'monthly',
        "total_installments"        integer NOT NULL,
        "paid_installments"         integer NOT NULL DEFAULT 0,
        "status"                    "subscription_payment_plans_status_enum" NOT NULL DEFAULT 'active',
        "next_payment_date"         timestamptz,
        "start_date"                timestamptz NOT NULL,
        "end_date"                  timestamptz,
        "stripe_payment_method_id"  varchar(100),
        "metadata"                  jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at"                timestamptz NOT NULL DEFAULT now(),
        "updated_at"                timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_subscription_payment_plans" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_subscription_payment_plans_tenant_id"
      ON "subscription_payment_plans" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_subscription_payment_plans_tenant_status"
      ON "subscription_payment_plans" ("tenant_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_payment_plans"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_payment_plans_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_payment_plans_frequency_enum"`);
  }
}
