import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInsuranceCardImages1784370000000 implements MigrationInterface {
  name = 'AddInsuranceCardImages1784370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_insurances"
      ADD COLUMN IF NOT EXISTS "card_front_image" text,
      ADD COLUMN IF NOT EXISTS "card_back_image" text,
      ADD COLUMN IF NOT EXISTS "card_extracted_confidence" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_insurances"
      DROP COLUMN IF EXISTS "card_extracted_confidence",
      DROP COLUMN IF EXISTS "card_back_image",
      DROP COLUMN IF EXISTS "card_front_image"
    `);
  }
}
