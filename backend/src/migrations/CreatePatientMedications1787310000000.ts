import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientMedications1787310000000 implements MigrationInterface {
    name = 'CreatePatientMedications1787310000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "patient_medications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "rxnorm_code" character varying(50), "dosage" character varying(100), "frequency" character varying(100), "route" character varying(50), "source" character varying(20) NOT NULL DEFAULT 'prescribed', "status" character varying(20) NOT NULL DEFAULT 'active', "taking_status" character varying(20) NOT NULL DEFAULT 'taking', "start_date" date, "end_date" date, "prescription_id" uuid, "encounter_id" character varying(100), "prescriber_name" character varying(200), "indication" character varying(255), "instructions" text, "notes" text, "discontinued_reason" text, "recorded_by" character varying(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_patient_medications" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_medications_tenant_patient" ON "patient_medications" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_medications_tenant_patient_status" ON "patient_medications" ("tenant_id", "patient_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_medications_tenant_encounter" ON "patient_medications" ("tenant_id", "encounter_id")`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_patient_medications_patient') THEN ALTER TABLE "patient_medications" ADD CONSTRAINT "FK_patient_medications_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patient_medications" DROP CONSTRAINT IF EXISTS "FK_patient_medications_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_medications_tenant_encounter"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_medications_tenant_patient_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_medications_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_medications"`);
    }
}
