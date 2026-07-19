import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentationSessions1784600000000 implements MigrationInterface {
  name = 'CreateDocumentationSessions1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "documentation_sessions_status_enum" AS ENUM('draft', 'transcribed', 'note_generated', 'reviewed', 'signed', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "documentation_sessions_consent_status_enum" AS ENUM('pending', 'granted', 'declined', 'provider_dictation')`);
    await queryRunner.query(`CREATE TYPE "documentation_sessions_audio_retention_policy_enum" AS ENUM('delete_after_transcription')`);
    await queryRunner.query(`CREATE TYPE "documentation_note_versions_source_enum" AS ENUM('ai_generated', 'clinician_edited', 'signed')`);
    await queryRunner.query(`
      CREATE TABLE "documentation_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "encounter_id" uuid,
        "patient_id" uuid NOT NULL,
        "provider_id" uuid NOT NULL,
        "status" "documentation_sessions_status_enum" NOT NULL DEFAULT 'draft',
        "consent_status" "documentation_sessions_consent_status_enum" NOT NULL DEFAULT 'pending',
        "consent_captured_by" uuid,
        "consent_captured_at" TIMESTAMP WITH TIME ZONE,
        "consent_method" character varying(100),
        "audio_retention_policy" "documentation_sessions_audio_retention_policy_enum" NOT NULL DEFAULT 'delete_after_transcription',
        "audio_deleted_at" TIMESTAMP WITH TIME ZONE,
        "transcript" text,
        "transcript_language" character varying(20),
        "transcript_confidence" numeric(5,4),
        "transcript_utterances" jsonb NOT NULL DEFAULT '[]',
        "soap_note" jsonb NOT NULL DEFAULT '{}',
        "ai_model" character varying(255),
        "signed_at" TIMESTAMP WITH TIME ZONE,
        "signed_by" uuid,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documentation_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_documentation_sessions_tenant_patient_created" ON "documentation_sessions" ("tenant_id", "patient_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_documentation_sessions_tenant_provider_status" ON "documentation_sessions" ("tenant_id", "provider_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_documentation_sessions_tenant_encounter" ON "documentation_sessions" ("tenant_id", "encounter_id")`);
    await queryRunner.query(`
      CREATE TABLE "documentation_note_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "source" "documentation_note_versions_source_enum" NOT NULL,
        "soap_note" jsonb NOT NULL,
        "created_by" uuid,
        "ai_model" character varying(255),
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documentation_note_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_documentation_note_versions_session_version" UNIQUE ("session_id", "version_number")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_documentation_note_versions_session" ON "documentation_note_versions" ("session_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_documentation_note_versions_tenant" ON "documentation_note_versions" ("tenant_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "documentation_note_versions"`);
    await queryRunner.query(`DROP TABLE "documentation_sessions"`);
    await queryRunner.query(`DROP TYPE "documentation_note_versions_source_enum"`);
    await queryRunner.query(`DROP TYPE "documentation_sessions_audio_retention_policy_enum"`);
    await queryRunner.query(`DROP TYPE "documentation_sessions_consent_status_enum"`);
    await queryRunner.query(`DROP TYPE "documentation_sessions_status_enum"`);
  }
}
