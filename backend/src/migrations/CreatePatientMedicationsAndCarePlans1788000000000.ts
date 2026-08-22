import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientMedicationsAndCarePlans1788000000000 implements MigrationInterface {
    name = 'CreatePatientMedicationsAndCarePlans1788000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── patient_medications ──
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "patient_medications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "patient_name" varchar(200) NOT NULL, "medication_name" varchar(255) NOT NULL, "rx_norm_code" varchar(20), "dosage" varchar(100), "frequency" varchar(100), "route" varchar(50), "duration" varchar(100), "instructions" text, "source" varchar(30) NOT NULL DEFAULT 'patient_reported', "taking_status" varchar(30) NOT NULL DEFAULT 'taking', "status" varchar(20) NOT NULL DEFAULT 'active', "start_date" date, "stop_date" date, "taking_notes" text, "prescription_id" uuid, "encounter_id" varchar(100), "provider_id" varchar(100), "provider_name" varchar(200), "reported_by" varchar(200), "pbm_source" varchar(100), "notes" text, "is_reviewed" boolean NOT NULL DEFAULT false, "reviewed_at" TIMESTAMP WITH TIME ZONE, "reviewed_by" varchar(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_patient_medications" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_medications_tenant_patient" ON "patient_medications" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_medications_tenant_patient_status" ON "patient_medications" ("tenant_id", "patient_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_medications_tenant_patient_source" ON "patient_medications" ("tenant_id", "patient_id", "source")`);

        // ── care_plans ──
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "care_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "patient_name" varchar(200) NOT NULL, "title" varchar(255) NOT NULL, "description" text, "status" varchar(20) NOT NULL DEFAULT 'active', "intent" varchar(20) NOT NULL DEFAULT 'plan', "category" varchar(50) NOT NULL DEFAULT 'chronic_care', "addresses" jsonb NOT NULL DEFAULT '[]', "care_team" jsonb NOT NULL DEFAULT '[]', "encounter_id" varchar(100), "provider_id" varchar(100), "provider_name" varchar(200), "start_date" date, "end_date" date, "is_ai_generated" boolean NOT NULL DEFAULT false, "is_approved" boolean NOT NULL DEFAULT false, "approved_at" TIMESTAMP WITH TIME ZONE, "approved_by" varchar(100), "patient_education" jsonb NOT NULL DEFAULT '[]', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_care_plans" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plans_tenant_patient" ON "care_plans" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plans_tenant_patient_status" ON "care_plans" ("tenant_id", "patient_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plans_tenant_status" ON "care_plans" ("tenant_id", "status")`);

        // ── care_plan_goals ──
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "care_plan_goals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "care_plan_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "description" text NOT NULL, "target_value" varchar(100), "target_unit" varchar(50), "current_value" varchar(100), "last_measured_at" TIMESTAMP WITH TIME ZONE, "metric_name" varchar(100), "target_direction" varchar(20), "status" varchar(20) NOT NULL DEFAULT 'active', "priority" varchar(20) NOT NULL DEFAULT 'medium', "target_date" date, "start_date" date, "achieved_date" date, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_care_plan_goals" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plan_goals_tenant_plan" ON "care_plan_goals" ("tenant_id", "care_plan_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plan_goals_tenant_patient" ON "care_plan_goals" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plan_goals_tenant_patient_status" ON "care_plan_goals" ("tenant_id", "patient_id", "status")`);

        // ── care_plan_tasks ──
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "care_plan_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "care_plan_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "title" varchar(255) NOT NULL, "description" text, "task_type" varchar(30) NOT NULL DEFAULT 'custom', "status" varchar(20) NOT NULL DEFAULT 'pending', "assigned_to" varchar(20) NOT NULL DEFAULT 'patient', "assigned_provider_id" varchar(100), "assigned_provider_name" varchar(200), "frequency" varchar(20) NOT NULL DEFAULT 'one_time', "start_date" TIMESTAMP WITH TIME ZONE, "due_date" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "completed_by" varchar(200), "metric_name" varchar(100), "target_value" varchar(100), "target_unit" varchar(50), "reported_value" varchar(100), "reported_at" TIMESTAMP WITH TIME ZONE, "patient_notes" text, "priority" varchar(20) NOT NULL DEFAULT 'medium', "is_ai_suggested" boolean NOT NULL DEFAULT false, "goal_id" uuid, "encounter_id" varchar(100), "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_care_plan_tasks" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plan_tasks_tenant_plan" ON "care_plan_tasks" ("tenant_id", "care_plan_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plan_tasks_tenant_patient" ON "care_plan_tasks" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plan_tasks_tenant_patient_status" ON "care_plan_tasks" ("tenant_id", "patient_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plan_tasks_tenant_patient_assigned" ON "care_plan_tasks" ("tenant_id", "patient_id", "assigned_to")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_care_plan_tasks_tenant_assigned_status" ON "care_plan_tasks" ("tenant_id", "assigned_to", "status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plan_tasks_tenant_assigned_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plan_tasks_tenant_patient_assigned"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plan_tasks_tenant_patient_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plan_tasks_tenant_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plan_tasks_tenant_plan"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "care_plan_tasks"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plan_goals_tenant_patient_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plan_goals_tenant_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plan_goals_tenant_plan"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "care_plan_goals"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plans_tenant_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plans_tenant_patient_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_care_plans_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "care_plans"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_medications_tenant_patient_source"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_medications_tenant_patient_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_medications_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_medications"`);
    }
}
