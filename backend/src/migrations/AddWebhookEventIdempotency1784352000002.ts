import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates subscription_webhook_events table for Stripe webhook idempotency.
 */
export class AddWebhookEventIdempotency1784352000002 implements MigrationInterface {
  name = 'AddWebhookEventIdempotency1784352000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription_webhook_events" (
        "event_id"                   varchar(100) NOT NULL,
        "event_type"                 varchar(100) NOT NULL,
        "provider_subscription_id"     varchar(100) NOT NULL,
        "status"                     varchar(50) NOT NULL,
        "processed"                  boolean NOT NULL DEFAULT true,
        "invoice_id"                 varchar(100),
        "error_message"              text,
        "processed_at"               timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_subscription_webhook_events" PRIMARY KEY ("event_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_subscription_webhook_events_processed_at"
      ON "subscription_webhook_events" ("processed_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_webhook_events"`);
  }
}
