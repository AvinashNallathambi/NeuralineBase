import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentationSuggestions1784600000002 implements MigrationInterface {
  name = 'CreateDocumentationSuggestions1784600000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "documentation_suggestions_kind_enum" AS ENUM('order', 'coding', 'cdi', 'prior_auth', 'after_visit_summary', 'claim_scrub', 'revenue_risk')`);
    await queryRunner.query(`CREATE TYPE "documentation_suggestions_status_enum" AS ENUM('pending', 'accepted', 'dismissed')`);
    await queryRunner.query(`
      CREATE TABLE "documentation_suggestions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "kind" "documentation_suggestions_kind_enum" NOT NULL,
        "status" "documentation_suggestions_status_enum" NOT NULL DEFAULT 'pending',
        "payload" jsonb NOT NULL,
        "evidence_text" text,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documentation_suggestions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_documentation_suggestions_session_status" ON "documentation_suggestions" ("session_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_documentation_suggestions_tenant_kind" ON "documentation_suggestions" ("tenant_id", "kind")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "documentation_suggestions"`);
    await queryRunner.query(`DROP TYPE "documentation_suggestions_status_enum"`);
    await queryRunner.query(`DROP TYPE "documentation_suggestions_kind_enum"`);
  }
}
