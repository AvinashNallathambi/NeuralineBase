import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEpisodes1791000000000 implements MigrationInterface {
    name = 'CreateEpisodes1791000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "episodes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" varchar(100) NOT NULL, "patient_name" varchar(200) NOT NULL, "title" varchar(255) NOT NULL, "description" text, "episode_type" varchar(20) NOT NULL DEFAULT 'acute', "status" varchar(20) NOT NULL DEFAULT 'active', "conditions" jsonb NOT NULL DEFAULT '[]', "care_team" jsonb NOT NULL DEFAULT '[]', "managing_provider_id" varchar(100), "managing_provider_name" varchar(200), "start_date" TIMESTAMP WITH TIME ZONE NOT NULL, "end_date" TIMESTAMP WITH TIME ZONE, "encounter_ids" jsonb NOT NULL DEFAULT '[]', "care_plan_ids" jsonb NOT NULL DEFAULT '[]', "cost_summary" jsonb, "outcome" jsonb, "ai_insights" jsonb, "timeline" jsonb NOT NULL DEFAULT '[]', "tags" jsonb NOT NULL DEFAULT '[]', "notes" text, "fhir_episode_id" varchar(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_episodes" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_episode_tenant" ON "episodes" ("tenant_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_episode_tenant_patient" ON "episodes" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_episode_tenant_status" ON "episodes" ("tenant_id", "status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_episode_tenant_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_episode_tenant_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_episode_tenant"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "episodes"`);
    }
}
