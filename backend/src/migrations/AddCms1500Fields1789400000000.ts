import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCms1500Fields1789400000000 implements MigrationInterface {
    name = 'AddCms1500Fields1789400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "patientSex" character varying(1)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "insuranceProgram" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "insuredSex" character varying(1)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "insuredDOB" date`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "insuredAddress" jsonb`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "dateOfIllness" date`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "referringProviderName" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "referringProviderNPI" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "outsideLab" boolean`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "outsideLabCharges" decimal(10,2)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "resubmissionCode" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "originalRefNo" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "priorAuthNumber" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "acceptAssignment" boolean DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "patientAccountNo" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "renderingProviderId" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "physicianSignature" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "physicianSignatureDate" date`);
        await queryRunner.query(`ALTER TABLE "superbills" ADD COLUMN IF NOT EXISTS "amountPaid" decimal(10,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "amountPaid"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "physicianSignatureDate"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "physicianSignature"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "renderingProviderId"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "patientAccountNo"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "acceptAssignment"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "priorAuthNumber"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "originalRefNo"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "resubmissionCode"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "outsideLabCharges"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "outsideLab"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "referringProviderNPI"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "referringProviderName"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "dateOfIllness"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "insuredAddress"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "insuredDOB"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "insuredSex"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "insuranceProgram"`);
        await queryRunner.query(`ALTER TABLE "superbills" DROP COLUMN IF EXISTS "patientSex"`);
    }
}
