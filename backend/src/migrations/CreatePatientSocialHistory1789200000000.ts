import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientSocialHistory1789200000000 implements MigrationInterface {
    name = 'CreatePatientSocialHistory1789200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "patient_social_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "category" character varying(30) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active', "detail" text, "frequency" character varying(100), "amount" character varying(100), "duration_years" integer, "quit_date" date, "verification_status" character varying(20) NOT NULL DEFAULT 'confirmed', "recorded_by" character varying(64), "source" character varying(20) NOT NULL DEFAULT 'staff', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_patient_social_history" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_social_history_tenant_patient" ON "patient_social_history" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_social_history_tenant_patient_category" ON "patient_social_history" ("tenant_id", "patient_id", "category")`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_patient_social_history_patient') THEN ALTER TABLE "patient_social_history" ADD CONSTRAINT "FK_patient_social_history_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patient_social_history" DROP CONSTRAINT "FK_patient_social_history_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_social_history_tenant_patient_category"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_social_history_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_social_history"`);
    }
}
