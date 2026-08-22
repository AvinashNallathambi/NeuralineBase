import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateQualityMeasureResults1789300000000 implements MigrationInterface {
    name = 'CreateQualityMeasureResults1789300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "quality_measure_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "measure_id" character varying(64) NOT NULL, "measure_title" character varying(255) NOT NULL, "program" character varying(32) NOT NULL, "category" character varying(64) NOT NULL, "status" character varying(20) NOT NULL, "period_start" date NOT NULL, "period_end" date NOT NULL, "last_value" character varying(255), "target_value" character varying(255), "last_event_date" date, "explanation" text, "recommendation" text, "closeable_in_visit" boolean NOT NULL DEFAULT false, "suggested_action" character varying(512), "priority" integer NOT NULL DEFAULT 3, "cross_program_mappings" jsonb NOT NULL DEFAULT '[]', "data_elements" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_quality_measure_results" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_quality_measure_results_tenant_patient" ON "quality_measure_results" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_quality_measure_results_tenant_patient_measure" ON "quality_measure_results" ("tenant_id", "patient_id", "measure_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_quality_measure_results_tenant_measure_status" ON "quality_measure_results" ("tenant_id", "measure_id", "status")`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_quality_measure_results_patient') THEN ALTER TABLE "quality_measure_results" ADD CONSTRAINT "FK_quality_measure_results_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quality_measure_results" DROP CONSTRAINT "FK_quality_measure_results_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_quality_measure_results_tenant_measure_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_quality_measure_results_tenant_patient_measure"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_quality_measure_results_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "quality_measure_results"`);
    }
}
