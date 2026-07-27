import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterDocumentationSessionProviderIdToVarchar1784473000000 implements MigrationInterface {
  name = 'AlterDocumentationSessionProviderIdToVarchar1784473000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard: this migration's timestamp (1784473000000) is BEFORE
    // CreateDocumentationSessions1784600000000, so the table may not exist yet
    // on fresh databases. Only alter if the table exists.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'documentation_session'
        ) THEN
          ALTER TABLE "documentation_session" ALTER COLUMN "provider_id" TYPE VARCHAR(100);
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documentation_session" ALTER COLUMN "provider_id" TYPE uuid USING provider_id::uuid`,
    );
  }
}
