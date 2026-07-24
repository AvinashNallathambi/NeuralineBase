import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEncounterDocumentationSessionId1784800000001 implements MigrationInterface {
  name = 'AddEncounterDocumentationSessionId1784800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "encounters"
      ADD COLUMN IF NOT EXISTS "documentation_session_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_encounters_documentation_session_id"
      ON "encounters" ("documentation_session_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_encounters_documentation_session_id"`);
    await queryRunner.query(`ALTER TABLE "encounters" DROP COLUMN IF EXISTS "documentation_session_id"`);
  }
}
