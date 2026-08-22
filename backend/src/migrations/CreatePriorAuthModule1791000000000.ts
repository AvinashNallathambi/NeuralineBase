import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePriorAuthModule1791000000000 implements MigrationInterface {
    name = 'CreatePriorAuthModule1791000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── prior_auth_requests ────────────────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "prior_auth_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "patient_name" varchar(200), "encounter_id" varchar(100), "superbill_id" varchar(100), "provider_id" varchar(100), "provider_name" varchar(200), "benefit_type" varchar(20) NOT NULL DEFAULT 'medical', "status" varchar(20) NOT NULL DEFAULT 'draft', "urgency" varchar(20) NOT NULL DEFAULT 'standard', "payer_name" varchar(255), "payer_id" varchar(100), "plan_name" varchar(255), "policy_number" varchar(100), "group_number" varchar(100), "eligibility_verification_id" uuid, "procedure_codes" jsonb NOT NULL DEFAULT '[]', "diagnosis_codes" jsonb NOT NULL DEFAULT '[]', "clinical_evidence" jsonb, "clinical_notes" text, "auth_letter" text, "submission_method" varchar(20), "submitted_at" TIMESTAMP WITH TIME ZONE, "submitted_by" varchar(100), "auth_number" varchar(100), "payer_response_at" TIMESTAMP WITH TIME ZONE, "payer_decision_notes" text, "denial_reason" text, "denial_code" varchar(50), "service_date" date, "approved_start_date" date, "approved_end_date" date, "expiration_date" date, "visit_count_approved" integer, "visits_used" integer NOT NULL DEFAULT 0, "p2p_scheduled_at" TIMESTAMP WITH TIME ZONE, "p2p_notes" text, "assigned_to" varchar(100), "priority" integer NOT NULL DEFAULT 3, "due_date" TIMESTAMP WITH TIME ZONE, "estimated_cost" decimal(12,2), "version" integer NOT NULL DEFAULT 1, "superseded_by_id" uuid, "ai_requirement_prediction" jsonb, "ai_approval_prediction" jsonb, "ai_expiration_prediction" jsonb, "auto_triggered" boolean NOT NULL DEFAULT false, "auto_trigger_source" varchar(100), "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_prior_auth_requests" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pa_tenant_patient" ON "prior_auth_requests" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pa_tenant_patient_status" ON "prior_auth_requests" ("tenant_id", "patient_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pa_tenant_status" ON "prior_auth_requests" ("tenant_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pa_tenant_payer" ON "prior_auth_requests" ("tenant_id", "payer_name")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pa_tenant_assigned" ON "prior_auth_requests" ("tenant_id", "assigned_to")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pa_tenant_expiration" ON "prior_auth_requests" ("tenant_id", "expiration_date")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pa_tenant_encounter" ON "prior_auth_requests" ("tenant_id", "encounter_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pa_tenant_superbill" ON "prior_auth_requests" ("tenant_id", "superbill_id")`);

        // ── prior_auth_requirements ────────────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "prior_auth_requirements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "payer_name" varchar(255), "payer_id" varchar(100), "procedure_code" varchar(20) NOT NULL, "procedure_description" varchar(255), "requirement_type" varchar(20) NOT NULL DEFAULT 'always', "conditions" jsonb NOT NULL DEFAULT '[]', "required_criteria" jsonb NOT NULL DEFAULT '[]', "typical_turnaround_hours" integer, "typical_validity_days" integer, "submission_methods" jsonb NOT NULL DEFAULT '["electronic"]', "is_ai_generated" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "source" varchar(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_prior_auth_requirements" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_par_tenant_payer_code" ON "prior_auth_requirements" ("tenant_id", "payer_name", "procedure_code")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_par_tenant_payer" ON "prior_auth_requirements" ("tenant_id", "payer_name")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_par_tenant_code" ON "prior_auth_requirements" ("tenant_id", "procedure_code")`);

        // ── prior_auth_attachments ─────────────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "prior_auth_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "prior_auth_request_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "attachment_type" varchar(50) NOT NULL, "title" varchar(255) NOT NULL, "description" text, "content" text, "file_url" varchar(512), "file_name" varchar(255), "mime_type" varchar(100), "evidence_date" date, "is_ai_generated" boolean NOT NULL DEFAULT false, "ai_relevance_score" float, "satisfies_criterion" varchar(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_prior_auth_attachments" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_paa_tenant_pa" ON "prior_auth_attachments" ("tenant_id", "prior_auth_request_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_paa_tenant_patient" ON "prior_auth_attachments" ("tenant_id", "patient_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_paa_tenant_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_paa_tenant_pa"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "prior_auth_attachments"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_par_tenant_code"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_par_tenant_payer"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_par_tenant_payer_code"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "prior_auth_requirements"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pa_tenant_superbill"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pa_tenant_encounter"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pa_tenant_expiration"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pa_tenant_assigned"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pa_tenant_payer"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pa_tenant_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pa_tenant_patient_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pa_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "prior_auth_requests"`);
    }
}
