import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientImmunizations1789000000000 implements MigrationInterface {
    name = 'CreatePatientImmunizations1789000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "patient_immunizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "vaccine_name" varchar(255) NOT NULL, "cvx_code" varchar(20), "cpt_code" varchar(10), "ndc_code" varchar(20), "manufacturer" varchar(200), "lot_number" varchar(100), "expiration_date" date, "administered_date" date NOT NULL, "dose_number" integer, "dose_amount" varchar(20), "dose_unit" varchar(20), "route" varchar(50), "site" varchar(50), "status" varchar(20) NOT NULL DEFAULT 'completed', "source" varchar(30) NOT NULL DEFAULT 'administered', "encounter_id" varchar(100), "provider_id" varchar(100), "provider_name" varchar(200), "facility_name" varchar(255), "vis_date" date, "vfc_eligibility" varchar(30), "funding_source" varchar(30), "reaction_notes" text, "notes" text, "recorded_by" varchar(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_patient_immunizations" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_immunizations_tenant_patient" ON "patient_immunizations" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_immunizations_tenant_patient_cvx" ON "patient_immunizations" ("tenant_id", "patient_id", "cvx_code")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_immunizations_tenant_patient_date" ON "patient_immunizations" ("tenant_id", "patient_id", "administered_date")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_immunizations_tenant_patient_date"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_immunizations_tenant_patient_cvx"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_immunizations_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_immunizations"`);
    }
}
