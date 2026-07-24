import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds portal invitation token columns to the patients table.
 *
 * These columns support the admin-driven portal access workflow:
 *   - portal_invitation_token:      one-time token issued when an admin
 *                                    enables portal access; required by
 *                                    the setup-account endpoint.
 *   - portal_invitation_expires_at: token expiry (default 7 days).
 */
export class AddPatientPortalInvitationFields1785000000000 implements MigrationInterface {
  name = 'AddPatientPortalInvitationFields1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patients"
      ADD COLUMN IF NOT EXISTS "portal_invitation_token" varchar(255),
      ADD COLUMN IF NOT EXISTS "portal_invitation_expires_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patients"
      DROP COLUMN IF EXISTS "portal_invitation_expires_at",
      DROP COLUMN IF EXISTS "portal_invitation_token"
    `);
  }
}
