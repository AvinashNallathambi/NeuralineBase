import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds payment method management tables and fields:
 * - Creates subscription_payment_methods table (multiple payment methods per tenant)
 * - Adds stripe_payment_method_id column to subscriptions table
 *
 * This enables:
 * - Phase 1: Display/update real payment methods via Stripe
 * - Phase 2: Card expiry tracking + dunning
 * - Phase 3: Multiple payment methods (card + ACH + HSA/FSA)
 */
export class AddPaymentMethods1784352000000 implements MigrationInterface {
  name = 'AddPaymentMethods1784352000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Add stripe_payment_method_id to subscriptions ───────────────
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "stripe_payment_method_id" varchar(100)
    `);

    // ── Create subscription_payment_methods table ───────────────────
    await queryRunner.query(`
      CREATE TYPE "subscription_payment_methods_type_enum"
      AS ENUM ('card', 'us_bank_account', 'sepa_debit', 'bacs_debit', 'acss_debit')
    `);

    await queryRunner.query(`
      CREATE TABLE "subscription_payment_methods" (
        "id"                        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"                 uuid NOT NULL,
        "stripe_payment_method_id"  varchar(100) NOT NULL,
        "type"                      "subscription_payment_methods_type_enum" NOT NULL DEFAULT 'card',
        "card_brand"                varchar(20),
        "card_last4"                varchar(4),
        "card_exp_month"            integer,
        "card_exp_year"             integer,
        "card_funding"              varchar(20),
        "bank_name"                 varchar(100),
        "bank_last4"                varchar(4),
        "bank_account_type"         varchar(20),
        "billing_name"              varchar(200),
        "billing_address"           jsonb,
        "is_default"                boolean NOT NULL DEFAULT false,
        "is_hsa_fsa"                boolean NOT NULL DEFAULT false,
        "metadata"                  jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at"                timestamptz NOT NULL DEFAULT now(),
        "updated_at"                timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_subscription_payment_methods" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_subscription_payment_methods_tenant_id"
      ON "subscription_payment_methods" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_subscription_payment_methods_tenant_default"
      ON "subscription_payment_methods" ("tenant_id", "is_default")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_payment_methods"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_payment_methods_type_enum"`);
    await queryRunner.query(`
      ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripe_payment_method_id"
    `);
  }
}
