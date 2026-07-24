import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientFlags1784700000000 implements MigrationInterface {
    name = 'CreatePatientFlags1784700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "patient_flags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "type" character varying(80) NOT NULL, "category" character varying(30) NOT NULL DEFAULT 'general', "severity" character varying(20) NOT NULL DEFAULT 'warning', "status" character varying(20) NOT NULL DEFAULT 'active', "show_as_banner" boolean NOT NULL DEFAULT false, "note" text, "created_by_user_id" character varying(64), "resolved_by_user_id" character varying(64), "resolved_at" TIMESTAMP WITH TIME ZONE, "resolution_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_patient_flags" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_patient_flags_tenant_patient" ON "patient_flags" ("tenant_id", "patient_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_patient_flags_tenant_patient_status" ON "patient_flags" ("tenant_id", "patient_id", "status")`);
        await queryRunner.query(`CREATE INDEX "IDX_patient_flags_tenant_patient_severity" ON "patient_flags" ("tenant_id", "patient_id", "severity")`);
        await queryRunner.query(`CREATE INDEX "IDX_patient_flags_tenant_patient_banner" ON "patient_flags" ("tenant_id", "patient_id", "show_as_banner")`);
        await queryRunner.query(`CREATE TABLE "patient_flag_acknowledgements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "flag_id" uuid NOT NULL, "user_id" character varying(64) NOT NULL, "user_email" character varying(255), "acknowledged_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_patient_flag_acknowledgements" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_patient_flag_ack_tenant_flag_user" ON "patient_flag_acknowledgements" ("tenant_id", "flag_id", "user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_patient_flag_ack_tenant_user" ON "patient_flag_acknowledgements" ("tenant_id", "user_id")`);
        await queryRunner.query(`ALTER TABLE "patient_flags" ADD CONSTRAINT "FK_patient_flags_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_flag_acknowledgements" ADD CONSTRAINT "FK_patient_flag_ack_flag" FOREIGN KEY ("flag_id") REFERENCES "patient_flags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patient_flag_acknowledgements" DROP CONSTRAINT "FK_patient_flag_ack_flag"`);
        await queryRunner.query(`ALTER TABLE "patient_flags" DROP CONSTRAINT "FK_patient_flags_patient"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_patient_flag_ack_tenant_user"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_patient_flag_ack_tenant_flag_user"`);
        await queryRunner.query(`DROP TABLE "patient_flag_acknowledgements"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_patient_flags_tenant_patient_banner"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_patient_flags_tenant_patient_severity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_patient_flags_tenant_patient_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_patient_flags_tenant_patient"`);
        await queryRunner.query(`DROP TABLE "patient_flags"`);
    }
}
