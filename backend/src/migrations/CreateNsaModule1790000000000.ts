import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNsaModule1790000000000 implements MigrationInterface {
    name = 'CreateNsaModule1790000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── good_faith_estimates ──────────────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "good_faith_estimates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "patient_name" varchar(200) NOT NULL, "superbill_id" varchar(100), "encounter_id" varchar(100), "provider_id" varchar(100), "provider_name" varchar(200), "gfe_type" varchar(20) NOT NULL, "status" varchar(20) NOT NULL DEFAULT 'draft', "version" integer NOT NULL DEFAULT 1, "service_date" date NOT NULL, "scheduled_date" TIMESTAMP WITH TIME ZONE, "total_charge" decimal(12,2) NOT NULL DEFAULT 0, "insurance_estimate" decimal(12,2) NOT NULL DEFAULT 0, "patient_estimate" decimal(12,2) NOT NULL DEFAULT 0, "items" jsonb NOT NULL DEFAULT '[]', "disclaimers" jsonb NOT NULL DEFAULT '[]', "compliance_notes" jsonb NOT NULL DEFAULT '[]', "delivery_method" varchar(20), "delivered_at" TIMESTAMP WITH TIME ZONE, "delivered_by" varchar(100), "acknowledged_at" TIMESTAMP WITH TIME ZONE, "acknowledged_by" varchar(200), "delivery_deadline" TIMESTAMP WITH TIME ZONE, "is_compliant" boolean NOT NULL DEFAULT false, "variance_amount" decimal(12,2) NOT NULL DEFAULT 0, "variance_status" varchar(20) NOT NULL DEFAULT 'none', "ai_accuracy_score" float, "ai_accuracy_flags" jsonb, "patient_friendly_explanation" text, "predicted_diagnosis_codes" jsonb, "reconciliation_data" jsonb, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_good_faith_estimates" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_gfe_tenant_patient" ON "good_faith_estimates" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_gfe_tenant_patient_status" ON "good_faith_estimates" ("tenant_id", "patient_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_gfe_tenant_status" ON "good_faith_estimates" ("tenant_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_gfe_tenant_superbill" ON "good_faith_estimates" ("tenant_id", "superbill_id")`);

        // ── nsa_variance_records ──────────────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "nsa_variance_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "gfe_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "claim_id" uuid, "remittance_claim_id" uuid, "gfe_amount" decimal(12,2) NOT NULL, "final_billed_amount" decimal(12,2) NOT NULL, "variance_amount" decimal(12,2) NOT NULL, "exceeds_threshold" boolean NOT NULL DEFAULT false, "status" varchar(20) NOT NULL DEFAULT 'detected', "notified_at" TIMESTAMP WITH TIME ZONE, "resolved_at" TIMESTAMP WITH TIME ZONE, "resolution_notes" text, "per_item_variance" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_nsa_variance_records" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nsa_variance_tenant_gfe" ON "nsa_variance_records" ("tenant_id", "gfe_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nsa_variance_tenant_patient" ON "nsa_variance_records" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nsa_variance_tenant_status" ON "nsa_variance_records" ("tenant_id", "status")`);

        // ── nsa_idr_cases ─────────────────────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "nsa_idr_cases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "patient_name" varchar(200), "claim_id" uuid, "gfe_id" uuid, "variance_record_id" uuid, "jurisdiction" varchar(20) NOT NULL DEFAULT 'federal', "status" varchar(20) NOT NULL DEFAULT 'open_negotiation', "payer_name" varchar(255), "qpa_amount" decimal(12,2), "billed_amount" decimal(12,2), "initial_offer" decimal(12,2), "final_offer" decimal(12,2), "determined_amount" decimal(12,2), "open_negotiation_date" TIMESTAMP WITH TIME ZONE, "idr_initiation_deadline" TIMESTAMP WITH TIME ZONE, "idr_submission_deadline" TIMESTAMP WITH TIME ZONE, "eligibility_score" float, "eligibility_factors" jsonb, "expected_recovery" decimal(12,2), "win_probability" float, "win_probability_factors" jsonb, "recommended_offer" decimal(12,2), "offer_rationale" text, "patient_acuity_letter" text, "support_documents" jsonb NOT NULL DEFAULT '[]', "encounter_notes" text, "cpt_codes" jsonb NOT NULL DEFAULT '[]', "resolved_at" TIMESTAMP WITH TIME ZONE, "resolution_notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_nsa_idr_cases" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nsa_idr_tenant_patient" ON "nsa_idr_cases" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nsa_idr_tenant_status" ON "nsa_idr_cases" ("tenant_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nsa_idr_tenant_claim" ON "nsa_idr_cases" ("tenant_id", "claim_id")`);

        // ── nsa_idr_deadlines ─────────────────────────────────────────────
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "nsa_idr_deadlines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "idr_case_id" uuid NOT NULL, "deadline_type" varchar(30) NOT NULL, "due_date" TIMESTAMP WITH TIME ZONE NOT NULL, "status" varchar(20) NOT NULL DEFAULT 'upcoming', "is_met" boolean NOT NULL DEFAULT false, "met_at" TIMESTAMP WITH TIME ZONE, "notification_sent" boolean NOT NULL DEFAULT false, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_nsa_idr_deadlines" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nsa_deadline_tenant_case" ON "nsa_idr_deadlines" ("tenant_id", "idr_case_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nsa_deadline_tenant_status" ON "nsa_idr_deadlines" ("tenant_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nsa_deadline_tenant_due" ON "nsa_idr_deadlines" ("tenant_id", "due_date")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_nsa_deadline_tenant_due"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_nsa_deadline_tenant_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_nsa_deadline_tenant_case"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "nsa_idr_deadlines"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_nsa_idr_tenant_claim"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_nsa_idr_tenant_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_nsa_idr_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "nsa_idr_cases"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_nsa_variance_tenant_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_nsa_variance_tenant_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_nsa_variance_tenant_gfe"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "nsa_variance_records"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_gfe_tenant_superbill"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_gfe_tenant_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_gfe_tenant_patient_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_gfe_tenant_patient"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "good_faith_estimates"`);
    }
}
