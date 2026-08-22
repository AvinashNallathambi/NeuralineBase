import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientAllergiesAndFamilyHistory1789000000000 implements MigrationInterface {
    name = 'CreatePatientAllergiesAndFamilyHistory1789000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ─── patient_allergies ───────────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "patient_allergies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "allergen" character varying(255) NOT NULL, "reaction" text, "severity" character varying(20) NOT NULL DEFAULT 'moderate', "clinical_status" character varying(20) NOT NULL DEFAULT 'active', "verification_status" character varying(20) NOT NULL DEFAULT 'confirmed', "onset_date" date, "recorded_by" character varying(64), "source" character varying(20) NOT NULL DEFAULT 'staff', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_patient_allergies" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_allergies_tenant_patient" ON "patient_allergies" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_allergies_tenant_patient_status" ON "patient_allergies" ("tenant_id", "patient_id", "clinical_status")`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_patient_allergies_patient') THEN ALTER TABLE "patient_allergies" ADD CONSTRAINT "FK_patient_allergies_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$`);

        // ─── patient_family_history ─────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "patient_family_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "relationship" character varying(20) NOT NULL, "member_name" character varying(100), "condition" character varying(255) NOT NULL, "code" character varying(20), "code_system" character varying(20), "age_of_onset" integer, "is_deceased" boolean NOT NULL DEFAULT false, "age_at_death" integer, "clinical_status" character varying(20) NOT NULL DEFAULT 'active', "verification_status" character varying(20) NOT NULL DEFAULT 'unconfirmed', "recorded_by" character varying(64), "source" character varying(20) NOT NULL DEFAULT 'staff', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_patient_family_history" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_family_history_tenant_patient" ON "patient_family_history" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_family_history_tenant_patient_rel" ON "patient_family_history" ("tenant_id", "patient_id", "relationship")`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_patient_family_history_patient') THEN ALTER TABLE "patient_family_history" ADD CONSTRAINT "FK_patient_family_history_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patient_family_history" DROP CONSTRAINT "FK_patient_family_history_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_family_history_tenant_patient_rel"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_family_history_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_family_history"`);
        await queryRunner.query(`ALTER TABLE "patient_allergies" DROP CONSTRAINT "FK_patient_allergies_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_allergies_tenant_patient_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_allergies_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_allergies"`);
    }
}
