import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPatientPortalInvitation1784700000001 implements MigrationInterface {
    name = 'AddPatientPortalInvitation1784700000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Portal invitation token columns added to patient entity but missing from DB
        await queryRunner.query(`ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "portal_invitation_token" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "portal_invitation_expires_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "portal_invitation_expires_at"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "portal_invitation_token"`);
    }
}
