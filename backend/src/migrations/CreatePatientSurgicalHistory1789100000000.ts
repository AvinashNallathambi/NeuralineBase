import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientSurgicalHistory1789100000000 implements MigrationInterface {
    name = 'CreatePatientSurgicalHistory1789100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "patient_surgical_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "procedure" character varying(255) NOT NULL, "procedure_code" character varying(20), "code_system" character varying(20), "procedure_date" date, "surgeon" character varying(200), "facility" character varying(255), "body_site" character varying(100), "outcome" character varying(50), "verification_status" character varying(20) NOT NULL DEFAULT 'confirmed', "recorded_by" character varying(64), "source" character varying(20) NOT NULL DEFAULT 'staff', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_patient_surgical_history" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_surgical_history_tenant_patient" ON "patient_surgical_history" ("tenant_id", "patient_id")`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_patient_surgical_history_patient') THEN ALTER TABLE "patient_surgical_history" ADD CONSTRAINT "FK_patient_surgical_history_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patient_surgical_history" DROP CONSTRAINT "FK_patient_surgical_history_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_surgical_history_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_surgical_history"`);
    }
}
