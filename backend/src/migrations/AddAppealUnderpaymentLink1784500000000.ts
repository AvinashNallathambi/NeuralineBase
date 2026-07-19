import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppealUnderpaymentLink1784500000000 implements MigrationInterface {
  name = 'AddAppealUnderpaymentLink1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add underpayment_id column to appeals table, linking appeals to
    // underpayment records when both dispute the same claim.
    await queryRunner.query(`
      ALTER TABLE "appeals"
      ADD COLUMN IF NOT EXISTS "underpayment_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appeals_underpayment_id"
      ON "appeals" ("underpayment_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_appeals_underpayment_id"`);
    await queryRunner.query(`ALTER TABLE "appeals" DROP COLUMN IF EXISTS "underpayment_id"`);
  }
}
