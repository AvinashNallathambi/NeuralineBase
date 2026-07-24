import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterDocumentationSessionProviderIdToVarchar1784473000000 implements MigrationInterface {
  name = 'AlterDocumentationSessionProviderIdToVarchar1784473000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documentation_session" ALTER COLUMN "provider_id" TYPE VARCHAR(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documentation_session" ALTER COLUMN "provider_id" TYPE uuid USING provider_id::uuid`,
    );
  }
}
