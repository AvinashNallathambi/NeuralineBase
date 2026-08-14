import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientDocuments1785200000000 implements MigrationInterface {
    name = 'CreatePatientDocuments1785200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "patient_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "file_name" character varying(255) NOT NULL, "stored_file_name" character varying(255) NOT NULL, "mime_type" character varying(100) NOT NULL, "file_size" bigint NOT NULL, "document_type" character varying(30) NOT NULL DEFAULT 'other', "description" text, "uploaded_by_user_id" character varying(64), "storage_path" character varying(512) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_patient_documents" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_documents_tenant_patient" ON "patient_documents" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_documents_tenant_patient_type" ON "patient_documents" ("tenant_id", "patient_id", "document_type")`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_patient_documents_patient') THEN ALTER TABLE "patient_documents" ADD CONSTRAINT "FK_patient_documents_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patient_documents" DROP CONSTRAINT "FK_patient_documents_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_documents_tenant_patient_type"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_documents_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_documents"`);
    }
}
