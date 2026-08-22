import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPediatricPatientFields1789100000000 implements MigrationInterface {
    name = 'AddPediatricPatientFields1789100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "patients" ADD COLUMN IF NOT EXISTS "birth_weight_grams" integer`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "patients" ADD COLUMN IF NOT EXISTS "gestational_age_weeks" integer`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "patients" ADD COLUMN IF NOT EXISTS "father_height_cm" double precision`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "patients" ADD COLUMN IF NOT EXISTS "mother_height_cm" double precision`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "patients" DROP COLUMN IF EXISTS "mother_height_cm"`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "patients" DROP COLUMN IF EXISTS "father_height_cm"`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "patients" DROP COLUMN IF EXISTS "gestational_age_weeks"`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "patients" DROP COLUMN IF EXISTS "birth_weight_grams"`);
    }
}
