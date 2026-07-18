import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCptCodesTable1784370578361 implements MigrationInterface {
    name = 'CreateCptCodesTable1784370578361'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_cpt_codes_code"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_trial_requests_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_trial_requests_email"`);
        await queryRunner.query(`DROP INDEX "public"."idx_trial_requests_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_superbill_payments_superbillId"`);
        await queryRunner.query(`DROP INDEX "public"."idx_superbills_tenant_id"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c99f542c7c0d13d247866b6880" ON "cpt_codes" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_6f18d459490bb48923b1f40bdb" ON "audit_logs" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4fbe3aaf3950e1aa356632718" ON "audit_logs" ("tenant_id", "entityType") `);
        await queryRunner.query(`CREATE INDEX "IDX_27915ff6dd562453e880f50fdd" ON "trial_requests" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3983036cafe675db90b704994e" ON "trial_requests" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_36f2ad284620fded5a946f1966" ON "trial_requests" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_7b9b139aacd9daa697470caa32" ON "superbills" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_685e588e43288a71b664eabb00" ON "superbills" ("tenant_id", "patientId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_685e588e43288a71b664eabb00"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7b9b139aacd9daa697470caa32"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_36f2ad284620fded5a946f1966"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3983036cafe675db90b704994e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_27915ff6dd562453e880f50fdd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4fbe3aaf3950e1aa356632718"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6f18d459490bb48923b1f40bdb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c99f542c7c0d13d247866b6880"`);
        await queryRunner.query(`CREATE INDEX "idx_superbills_tenant_id" ON "superbills" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_superbill_payments_superbillId" ON "superbill_payments" ("superbillId") `);
        await queryRunner.query(`CREATE INDEX "idx_trial_requests_tenant_id" ON "trial_requests" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_trial_requests_email" ON "trial_requests" ("email") `);
        await queryRunner.query(`CREATE INDEX "idx_trial_requests_status" ON "trial_requests" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_logs_tenant_id" ON "audit_logs" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_cpt_codes_code" ON "cpt_codes" ("code") `);
    }

}
