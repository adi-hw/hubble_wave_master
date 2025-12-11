import { MigrationInterface, QueryRunner } from "typeorm";

export class DropDataObjects1776000003000 implements MigrationInterface {
    name = 'DropDataObjects1776000003000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS data_objects CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE data_objects (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            table_id uuid NOT NULL REFERENCES model_table(id) ON DELETE CASCADE,
            table_name text,
            attributes jsonb NOT NULL DEFAULT '{}',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
          )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_data_objects_table_id ON data_objects(table_id)`);
    }
}
