import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModelopsModelArtifacts1828100000000 implements MigrationInterface {
  name = 'ModelopsModelArtifacts1828100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS model_artifacts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(120) NOT NULL,
        name varchar(255) NOT NULL,
        version varchar(50) NOT NULL,
        description text,
        dataset_snapshot_id uuid REFERENCES dataset_snapshots(id) ON DELETE SET NULL,
        artifact_bucket varchar(255) NOT NULL,
        artifact_key text NOT NULL,
        content_type varchar(120),
        checksum varchar(64),
        size_bytes bigint,
        status varchar(20) NOT NULL DEFAULT 'draft',
        metadata jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_model_artifacts_code_version ON model_artifacts(code, version);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_model_artifacts_status ON model_artifacts(status);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_model_artifacts_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_model_artifacts_code_version`);
    await queryRunner.query(`DROP TABLE IF EXISTS model_artifacts`);
  }
}
