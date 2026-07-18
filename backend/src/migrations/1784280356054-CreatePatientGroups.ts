import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientGroups1784280356054 implements MigrationInterface {
    name = 'CreatePatientGroups1784280356054'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_subscription_payment_plans_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_subscription_payment_plans_tenant_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_subscription_payment_methods_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_subscription_payment_methods_tenant_default"`);
        await queryRunner.query(`CREATE TABLE "patient_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "name" character varying(200) NOT NULL, "description" text, "type" character varying(20) NOT NULL DEFAULT 'manual', "category" character varying(40) NOT NULL DEFAULT 'custom', "color" character varying(20), "icon" character varying(50), "tags" jsonb, "rules" jsonb, "member_ids" jsonb, "member_count" integer NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'active', "is_shared" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "last_refreshed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_517f4cf12c18e255f81b09a5d32" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_47c39f099182d0e419669c640d" ON "patient_groups" ("tenant_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_482b2c8f3d417497e89cb250d2" ON "patient_groups" ("tenant_id", "category") `);
        await queryRunner.query(`CREATE INDEX "IDX_72a58c860577546f8ac278d776" ON "patient_groups" ("tenant_id", "type") `);
        await queryRunner.query(`CREATE INDEX "IDX_373e644b2d074735c2d9cf605e" ON "patient_groups" ("tenant_id", "name") `);
        await queryRunner.query(`CREATE TABLE "patient_group_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "group_id" uuid NOT NULL, "action" character varying(50) NOT NULL, "user_id" uuid, "user_email" character varying(255), "user_role" character varying(50), "description" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_861120b532a982bd728cdace4af" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ae3f61cc248c455b60ca05b961" ON "patient_group_audit_logs" ("tenant_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_4bb4ae8c9be5e7502ad3c5b8ad" ON "patient_group_audit_logs" ("tenant_id", "action") `);
        await queryRunner.query(`CREATE INDEX "IDX_5449d6b9b3a7d27f369d3f1514" ON "patient_group_audit_logs" ("tenant_id", "group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9c843fd26aa1cd3ce9ff6c127" ON "subscription_payment_plans" ("tenant_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_83f2554c4ae90726848e09a115" ON "subscription_payment_plans" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ccd0e259ec2fe7ff2eebe18aee" ON "subscription_payment_methods" ("tenant_id", "is_default") `);
        await queryRunner.query(`CREATE INDEX "IDX_dfa840b715ba3465a52ac63130" ON "subscription_payment_methods" ("tenant_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_dfa840b715ba3465a52ac63130"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccd0e259ec2fe7ff2eebe18aee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83f2554c4ae90726848e09a115"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f9c843fd26aa1cd3ce9ff6c127"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5449d6b9b3a7d27f369d3f1514"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4bb4ae8c9be5e7502ad3c5b8ad"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae3f61cc248c455b60ca05b961"`);
        await queryRunner.query(`DROP TABLE "patient_group_audit_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_373e644b2d074735c2d9cf605e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_72a58c860577546f8ac278d776"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_482b2c8f3d417497e89cb250d2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47c39f099182d0e419669c640d"`);
        await queryRunner.query(`DROP TABLE "patient_groups"`);
        await queryRunner.query(`CREATE INDEX "idx_subscription_payment_methods_tenant_default" ON "subscription_payment_methods" ("tenant_id", "is_default") `);
        await queryRunner.query(`CREATE INDEX "idx_subscription_payment_methods_tenant_id" ON "subscription_payment_methods" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_subscription_payment_plans_tenant_status" ON "subscription_payment_plans" ("tenant_id", "status") `);
        await queryRunner.query(`CREATE INDEX "idx_subscription_payment_plans_tenant_id" ON "subscription_payment_plans" ("tenant_id") `);
    }

}
