import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModelopsTrainingJobs1828300000000 implements MigrationInterface {
  name = 'ModelopsTrainingJobs1828300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS model_training_jobs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        dataset_snapshot_id uuid REFERENCES dataset_snapshots(id) ON DELETE RESTRICT,
        model_code varchar(120) NOT NULL,
        model_name varchar(255) NOT NULL,
        model_version varchar(50) NOT NULL,
        algorithm varchar(120) NOT NULL,
        hyperparameters jsonb NOT NULL DEFAULT '{}',
        training_config jsonb NOT NULL DEFAULT '{}',
        metrics jsonb NOT NULL DEFAULT '{}',
        status varchar(20) NOT NULL DEFAULT 'pending',
        model_artifact_id uuid REFERENCES model_artifacts(id) ON DELETE SET NULL,
        requested_by uuid,
        started_at timestamptz,
        completed_at timestamptz,
        error_message text,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_model_training_jobs_status ON model_training_jobs(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_model_training_jobs_code ON model_training_jobs(model_code, model_version);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_model_training_jobs_code`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_model_training_jobs_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS model_training_jobs`);
  }
}
