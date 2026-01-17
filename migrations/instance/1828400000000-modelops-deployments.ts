import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModelopsDeployments1828400000000 implements MigrationInterface {
  name = 'ModelopsDeployments1828400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS model_deployments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        model_artifact_id uuid REFERENCES model_artifacts(id) ON DELETE RESTRICT,
        target_type varchar(120) NOT NULL,
        target_config jsonb NOT NULL DEFAULT '{}',
        status varchar(20) NOT NULL DEFAULT 'pending_approval',
        requested_by uuid,
        approved_by uuid,
        workflow_instance_id uuid,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_model_deployments_status ON model_deployments(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_model_deployments_artifact ON model_deployments(model_artifact_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_model_deployments_artifact`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_model_deployments_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS model_deployments`);
  }
}
