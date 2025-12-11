import { MigrationInterface, QueryRunner } from "typeorm";

export class FixStoragePaths1765300009000 implements MigrationInterface {
    name = 'FixStoragePaths1765300009000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Prefix any bare storage_path with column:
        await queryRunner.query(`
          UPDATE "model_field"
          SET storage_path = 'column:' || storage_path
          WHERE storage_path IS NOT NULL
            AND storage_path NOT LIKE '%:%'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove column: prefix we added (only for ones we touched)
        await queryRunner.query(`
          UPDATE "model_field"
          SET storage_path = substring(storage_path from 8)
          WHERE storage_path LIKE 'column:%'
        `);
    }
}
