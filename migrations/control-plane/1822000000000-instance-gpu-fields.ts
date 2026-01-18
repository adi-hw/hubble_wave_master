import { MigrationInterface, QueryRunner } from 'typeorm';

export class InstanceGpuFields1822000000000 implements MigrationInterface {
  name = 'InstanceGpuFields1822000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add GPU-related columns to instances table
    await queryRunner.query(`
      ALTER TABLE instances
      ADD COLUMN IF NOT EXISTS gpu_enabled BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await queryRunner.query(`
      ALTER TABLE instances
      ADD COLUMN IF NOT EXISTS gpu_instance_type VARCHAR(50)
    `);

    await queryRunner.query(`
      ALTER TABLE instances
      ADD COLUMN IF NOT EXISTS huggingface_token VARCHAR(500)
    `);

    await queryRunner.query(`
      ALTER TABLE instances
      ADD COLUMN IF NOT EXISTS vllm_model VARCHAR(200)
    `);

    // Update resource_tier constraint to include enterprise_gpu
    await queryRunner.query(`
      ALTER TABLE instances
      DROP CONSTRAINT IF EXISTS instances_resource_tier_check
    `);

    await queryRunner.query(`
      ALTER TABLE instances
      ADD CONSTRAINT instances_resource_tier_check
      CHECK (resource_tier IN ('standard', 'professional', 'enterprise', 'enterprise_gpu'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert resource_tier constraint
    await queryRunner.query(`
      ALTER TABLE instances
      DROP CONSTRAINT IF EXISTS instances_resource_tier_check
    `);

    await queryRunner.query(`
      ALTER TABLE instances
      ADD CONSTRAINT instances_resource_tier_check
      CHECK (resource_tier IN ('standard', 'professional', 'enterprise'))
    `);

    // Remove GPU columns
    await queryRunner.query(`ALTER TABLE instances DROP COLUMN IF EXISTS vllm_model`);
    await queryRunner.query(`ALTER TABLE instances DROP COLUMN IF EXISTS huggingface_token`);
    await queryRunner.query(`ALTER TABLE instances DROP COLUMN IF EXISTS gpu_instance_type`);
    await queryRunner.query(`ALTER TABLE instances DROP COLUMN IF EXISTS gpu_enabled`);
  }
}
