import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeEncounterSignedByLockedByToVarchar1784265000000 implements MigrationInterface {
  name = 'ChangeEncounterSignedByLockedByToVarchar1784265000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change signed_by and locked_by from uuid to varchar(100) so that
    // non-UUID user identifiers (e.g. dev-user-1) can be stored.
    await queryRunner.query(`
      ALTER TABLE "encounters"
      ALTER COLUMN "signed_by" TYPE varchar(100) USING "signed_by"::text
    `);
    await queryRunner.query(`
      ALTER TABLE "encounters"
      ALTER COLUMN "locked_by" TYPE varchar(100) USING "locked_by"::text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "encounters"
      ALTER COLUMN "locked_by" TYPE uuid USING "locked_by"::uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "encounters"
      ALTER COLUMN "signed_by" TYPE uuid USING "signed_by"::uuid
    `);
  }
}
