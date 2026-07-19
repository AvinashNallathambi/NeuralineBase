import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentationIntelligence1784600000001 implements MigrationInterface {
  name = 'CreateDocumentationIntelligence1784600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documentation_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "provider_id" uuid NOT NULL,
        "preferred_language" character varying(20) NOT NULL DEFAULT 'en',
        "note_style" character varying(30) NOT NULL DEFAULT 'concise',
        "required_sections" jsonb NOT NULL DEFAULT '[]',
        "do_not_infer" jsonb NOT NULL DEFAULT '[]',
        "custom_instructions" text,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documentation_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_documentation_preferences_tenant_provider" UNIQUE ("tenant_id", "provider_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "documentation_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "note_section" character varying(30) NOT NULL,
        "note_text" text NOT NULL,
        "speaker_label" character varying(50),
        "transcript_start_ms" integer,
        "transcript_end_ms" integer,
        "source_text" text NOT NULL,
        "match_score" numeric(5,4) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documentation_evidence" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_documentation_evidence_session_section" ON "documentation_evidence" ("session_id", "note_section")`);
    await queryRunner.query(`CREATE INDEX "IDX_documentation_evidence_tenant" ON "documentation_evidence" ("tenant_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "documentation_evidence"`);
    await queryRunner.query(`DROP TABLE "documentation_preferences"`);
  }
}
