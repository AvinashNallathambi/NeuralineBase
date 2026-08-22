import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaccineInventory1789200000000 implements MigrationInterface {
    name = 'CreateVaccineInventory1789200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "vaccine_inventory" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "tenant_id" uuid NOT NULL,
                "vaccine_name" varchar(255) NOT NULL,
                "cvx_code" varchar(10),
                "ndc_code" varchar(20),
                "manufacturer" varchar(255),
                "lot_number" varchar(100) NOT NULL,
                "expiration_date" date NOT NULL,
                "quantity_on_hand" int NOT NULL DEFAULT 0,
                "quantity_administered" int NOT NULL DEFAULT 0,
                "quantity_received" int NOT NULL DEFAULT 0,
                "funding_source" varchar(20) NOT NULL DEFAULT 'private',
                "vfc_eligibility" varchar(50),
                "storage_location" varchar(100),
                "storage_temp_min" float,
                "storage_temp_max" float,
                "status" varchar(20) NOT NULL DEFAULT 'available',
                "received_date" date,
                "notes" text,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_vaccine_inventory" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vaccine_inventory_tenant_vaccine" ON "vaccine_inventory" ("tenant_id", "vaccine_name")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vaccine_inventory_tenant_lot" ON "vaccine_inventory" ("tenant_id", "lot_number")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vaccine_inventory_tenant_funding" ON "vaccine_inventory" ("tenant_id", "funding_source")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vaccine_inventory_tenant_funding"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vaccine_inventory_tenant_lot"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vaccine_inventory_tenant_vaccine"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vaccine_inventory"`);
    }
}
