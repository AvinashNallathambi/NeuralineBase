import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateScreeningModule1792000000000 implements MigrationInterface {
    name = 'CreateScreeningModule1792000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "screening_instruments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "code" varchar(50) NOT NULL, "title" varchar(255) NOT NULL, "description" text, "category" varchar(30) NOT NULL, "is_predefined" boolean NOT NULL DEFAULT false, "is_locked" boolean NOT NULL DEFAULT false, "loinc_code" varchar(20), "version" varchar(20) NOT NULL DEFAULT '1.0', "questions" jsonb NOT NULL DEFAULT '[]', "scoring_rules" jsonb, "administration_rules" jsonb, "estimated_minutes" int NOT NULL DEFAULT 5, "is_active" boolean NOT NULL DEFAULT true, "created_by" varchar(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_screening_instruments" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_screening_instrument_tenant" ON "screening_instruments" ("tenant_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_screening_instrument_code" ON "screening_instruments" ("tenant_id", "code")`);

        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "screening_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "instrument_id" uuid NOT NULL, "instrument_code" varchar(50) NOT NULL, "instrument_title" varchar(255) NOT NULL, "patient_id" varchar(100) NOT NULL, "patient_name" varchar(200) NOT NULL, "encounter_id" varchar(100), "status" varchar(20) NOT NULL DEFAULT 'in_progress', "answers" jsonb NOT NULL DEFAULT '[]', "score" jsonb, "alerts" jsonb NOT NULL DEFAULT '[]', "administered_by" varchar(50) NOT NULL, "administered_by_user_id" varchar(100), "administered_by_name" varchar(200), "administration_context" varchar(50), "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE, "duration_seconds" int, "notes" text, "fhir_observation_id" varchar(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_screening_results" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_screening_result_tenant" ON "screening_results" ("tenant_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_screening_result_instrument" ON "screening_results" ("tenant_id", "instrument_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_screening_result_tenant_patient" ON "screening_results" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_screening_result_completed" ON "screening_results" ("tenant_id", "completed_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_screening_result_completed"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_screening_result_tenant_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_screening_result_instrument"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_screening_result_tenant"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "screening_results"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_screening_instrument_code"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_screening_instrument_tenant"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "screening_instruments"`);
    }
}
