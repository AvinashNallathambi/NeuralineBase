import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentationSessionEncounterUniqueIndex1784800000000 implements MigrationInterface {
  name = 'AddDocumentationSessionEncounterUniqueIndex1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Unique partial index: only one active documentation session per encounter.
    // Active statuses: draft, transcribed, note_generated, reviewed.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_documentation_sessions_encounter_active"
      ON "documentation_sessions" ("tenant_id", "encounter_id")
      WHERE "encounter_id" IS NOT NULL
        AND "status" IN ('draft', 'transcribed', 'note_generated', 'reviewed')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_documentation_sessions_encounter_active"`);
  }
}
