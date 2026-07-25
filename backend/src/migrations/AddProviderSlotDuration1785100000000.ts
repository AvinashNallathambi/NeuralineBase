import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProviderSlotDuration1785100000000 implements MigrationInterface {
    name = 'AddProviderSlotDuration1785100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add slot_duration column to provider_availabilities for per-slot minute duration
        await queryRunner.query(`ALTER TABLE "provider_availabilities" ADD COLUMN IF NOT EXISTS "slot_duration" integer NOT NULL DEFAULT 30`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "provider_availabilities" DROP COLUMN IF EXISTS "slot_duration"`);
    }
}
