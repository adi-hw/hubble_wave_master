import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModelopsDatasets1828000000000 implements MigrationInterface {
  name = 'ModelopsDatasets1828000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dataset_definitions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(120) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text,
        source_collection_code varchar(120) NOT NULL,
        filter jsonb NOT NULL DEFAULT '{}',
        label_mapping jsonb NOT NULL DEFAULT '{}',
        feature_mapping jsonb NOT NULL DEFAULT '{}',
        status varchar(20) NOT NULL DEFAULT 'draft',
        version int NOT NULL DEFAULT 1,
        metadata jsonb NOT NULL DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dataset_definitions_active ON dataset_definitions(is_active);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dataset_snapshots (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        dataset_definition_id uuid REFERENCES dataset_definitions(id) ON DELETE CASCADE,
        status varchar(20) NOT NULL DEFAULT 'pending',
        snapshot_uri text,
        row_count int,
        checksum varchar(64),
        metadata jsonb NOT NULL DEFAULT '{}',
        requested_by uuid,
        started_at timestamptz,
        completed_at timestamptz,
        error_message text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_definition ON dataset_snapshots(dataset_definition_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_status ON dataset_snapshots(status);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dataset_snapshots_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dataset_snapshots_definition`);
    await queryRunner.query(`DROP TABLE IF EXISTS dataset_snapshots`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dataset_definitions_active`);
    await queryRunner.query(`DROP TABLE IF EXISTS dataset_definitions`);
  }
}
