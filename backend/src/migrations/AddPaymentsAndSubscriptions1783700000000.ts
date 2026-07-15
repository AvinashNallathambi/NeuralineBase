import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the tables for the payments and subscriptions modules.
 *
 * The rest of the Neuraline schema was created via `synchronize=true` in early
 * development, but `DB_SYNCHRONIZE` is now disabled, so the new
 * payments / subscriptions entities need an explicit migration.
 *
 * Tables created:
 *   - subscription_plans        (SubscriptionPlan entity)
 *   - subscriptions             (Subscription entity)
 *   - subscription_invoices     (SubscriptionInvoice entity)
 *   - payments                  (Payment entity)
 *
 * Enum types follow TypeORM's `<table>_<column>_enum` naming convention and
 * uuid primary keys use `uuid_generate_v4()` to match the rest of the schema.
 */
export class AddPaymentsAndSubscriptions1783700000000 implements MigrationInterface {
  name = 'AddPaymentsAndSubscriptions1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── subscription_plans ────────────────────────────────────────────────
    await queryRunner.query(`CREATE TYPE "subscription_plans_tier_enum" AS ENUM ('solo', 'professional', 'enterprise')`);
    await queryRunner.query(`
      CREATE TABLE "subscription_plans" (
        "id"                      uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tier"                    "subscription_plans_tier_enum" NOT NULL,
        "name"                    varchar(100) NOT NULL,
        "description"             varchar(255) NOT NULL,
        "price_monthly_cents"     integer NOT NULL,
        "price_annual_cents"      integer NOT NULL,
        "max_providers"           integer,
        "max_patients"            integer,
        "max_locations"           integer,
        "includes_rcm"            boolean NOT NULL DEFAULT false,
        "includes_ai_scribe"      boolean NOT NULL DEFAULT false,
        "includes_ai_coding"      boolean NOT NULL DEFAULT false,
        "includes_patient_portal" boolean NOT NULL DEFAULT false,
        "includes_automation"     boolean NOT NULL DEFAULT false,
        "ai_credits_monthly"      integer NOT NULL DEFAULT 0,
        "is_active"               boolean NOT NULL DEFAULT true,
        "stripe_price_monthly_id" varchar(100),
        "stripe_price_annual_id"  varchar(100),
        "created_at"              timestamptz NOT NULL DEFAULT now(),
        "updated_at"              timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_subscription_plans" PRIMARY KEY ("id"),
        CONSTRAINT "uq_subscription_plans_tier" UNIQUE ("tier")
      )
    `);

    // ── subscriptions ─────────────────────────────────────────────────────
    await queryRunner.query(`CREATE TYPE "subscriptions_status_enum" AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'paused')`);
    await queryRunner.query(`CREATE TYPE "subscriptions_billingcycle_enum" AS ENUM ('monthly', 'annual')`);
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id"                       uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"                uuid NOT NULL,
        "plan_tier"                varchar(50) NOT NULL,
        "status"                   "subscriptions_status_enum" NOT NULL DEFAULT 'trialing',
        "billing_cycle"            "subscriptions_billingcycle_enum" NOT NULL DEFAULT 'monthly',
        "price_cents"              integer NOT NULL,
        "currency"                 varchar(3) NOT NULL DEFAULT 'usd',
        "trial_ends_at"            timestamptz,
        "current_period_start"     timestamptz,
        "current_period_end"       timestamptz,
        "cancelled_at"             timestamptz,
        "cancel_at_period_end"     boolean NOT NULL DEFAULT false,
        "stripe_customer_id"       varchar(100),
        "stripe_subscription_id"   varchar(100),
        "provider"                 varchar(50) NOT NULL DEFAULT 'mock',
        "metadata"                 jsonb NOT NULL DEFAULT '{}',
        "created_at"               timestamptz NOT NULL DEFAULT now(),
        "updated_at"               timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_subscriptions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_subscriptions_tenant_id" ON "subscriptions" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_subscriptions_status" ON "subscriptions" ("status")`);

    // ── subscription_invoices ─────────────────────────────────────────────
    await queryRunner.query(`CREATE TYPE "subscription_invoices_status_enum" AS ENUM ('paid', 'open', 'failed', 'void', 'refunded')`);
    await queryRunner.query(`
      CREATE TABLE "subscription_invoices" (
        "id"                         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"                  uuid NOT NULL,
        "subscription_id"            uuid NOT NULL,
        "invoice_number"             varchar(50) NOT NULL,
        "plan_tier"                  varchar(50) NOT NULL,
        "billing_cycle"              varchar(20) NOT NULL,
        "amount"                     numeric(10,2) NOT NULL,
        "currency"                   varchar(3) NOT NULL DEFAULT 'usd',
        "status"                     "subscription_invoices_status_enum" NOT NULL DEFAULT 'open',
        "period_start"               timestamptz NOT NULL,
        "period_end"                 timestamptz NOT NULL,
        "paid_at"                    timestamptz,
        "failure_reason"             text,
        "stripe_invoice_id"          varchar(100),
        "stripe_hosted_invoice_url"  varchar(500),
        "created_at"                 timestamptz NOT NULL DEFAULT now(),
        "updated_at"                 timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_subscription_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "uq_subscription_invoices_invoice_number" UNIQUE ("invoice_number")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_subscription_invoices_tenant_id" ON "subscription_invoices" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_subscription_invoices_subscription_id" ON "subscription_invoices" ("subscription_id")`);
    await queryRunner.query(`CREATE INDEX "idx_subscription_invoices_tenant_subscription" ON "subscription_invoices" ("tenant_id", "subscription_id")`);
    await queryRunner.query(`CREATE INDEX "idx_subscription_invoices_tenant_status" ON "subscription_invoices" ("tenant_id", "status")`);

    // ── payments ──────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE TYPE "payments_status_enum" AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "payments_method_enum" AS ENUM ('card', 'ach', 'cash', 'check', 'other')`);
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id"                  uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"           uuid NOT NULL,
        "invoice_id"          uuid,
        "patient_id"          uuid NOT NULL,
        "patient_name"        varchar(255) NOT NULL,
        "amount"              numeric(10,2) NOT NULL,
        "status"              "payments_status_enum" NOT NULL DEFAULT 'pending',
        "method"              "payments_method_enum" NOT NULL DEFAULT 'card',
        "provider"            varchar(50) NOT NULL,
        "provider_payment_id" varchar(255),
        "client_secret"       varchar(500),
        "currency"            varchar(3) NOT NULL DEFAULT 'usd',
        "description"         varchar(500),
        "failure_reason"      text,
        "metadata"            jsonb NOT NULL DEFAULT '{}',
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_payments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_payments_tenant_id" ON "payments" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_payments_invoice_id" ON "payments" ("invoice_id")`);
    await queryRunner.query(`CREATE INDEX "idx_payments_patient_id" ON "payments" ("patient_id")`);
    await queryRunner.query(`CREATE INDEX "idx_payments_tenant_invoice" ON "payments" ("tenant_id", "invoice_id")`);
    await queryRunner.query(`CREATE INDEX "idx_payments_tenant_patient" ON "payments" ("tenant_id", "patient_id")`);
    await queryRunner.query(`CREATE INDEX "idx_payments_tenant_status" ON "payments" ("tenant_id", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payments_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payments_tenant_patient"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payments_tenant_invoice"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payments_patient_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payments_invoice_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payments_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscription_invoices_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscription_invoices_tenant_subscription"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscription_invoices_subscription_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscription_invoices_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_invoices"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_invoices_status_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscriptions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscriptions_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscriptions_billingcycle_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscriptions_status_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_plans"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_plans_tier_enum"`);
  }
}
