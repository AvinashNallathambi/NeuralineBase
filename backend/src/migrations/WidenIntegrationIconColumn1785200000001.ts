import { MigrationInterface, QueryRunner } from "typeorm";

export class WidenIntegrationIconColumn1785200000001 implements MigrationInterface {
    name = 'WidenIntegrationIconColumn1785200000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "integrations" ALTER COLUMN "icon" TYPE varchar(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "integrations" ALTER COLUMN "icon" TYPE varchar(10)`);
    }
}
