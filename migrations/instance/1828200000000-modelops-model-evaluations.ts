import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModelopsModelEvaluations1828200000000 implements MigrationInterface {
  name = 'ModelopsModelEvaluations1828200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS model_evaluations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        model_artifact_id uuid REFERENCES model_artifacts(id) ON DELETE CASCADE,
        dataset_snapshot_id uuid REFERENCES dataset_snapshots(id) ON DELETE SET NULL,
        metrics jsonb NOT NULL DEFAULT '{}',
        confusion_matrix jsonb NOT NULL DEFAULT '{}',
        calibration_stats jsonb NOT NULL DEFAULT '{}',
        status varchar(20) NOT NULL DEFAULT 'completed',
        metadata jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_model_evaluations_artifact ON model_evaluations(model_artifact_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_model_evaluations_status ON model_evaluations(status);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_model_evaluations_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_model_evaluations_artifact`);
    await queryRunner.query(`DROP TABLE IF EXISTS model_evaluations`);
  }
}
