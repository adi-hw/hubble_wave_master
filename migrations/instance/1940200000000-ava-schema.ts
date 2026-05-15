import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AvaSchema1940200000000
 *
 * Plan Fix 24 / W9 Phase C — third domain migration. Moves all AVA
 * entities (conversations, intents, predictions, registry tools,
 * proposal state machine, ModelOps datasets/artifacts) from public
 * into a dedicated `ava` schema.
 *
 * AVA is a leaf domain in the FK graph (nothing in other domains FKs
 * into ava tables). The pivot tables that bridge into shared
 * (User-author, Audit-actor) keep their cross-schema references via
 * Postgres's native cross-schema FK support.
 */
export class AvaSchema1940200000000 implements MigrationInterface {
  name = 'AvaSchema1940200000000';

  private readonly tables = [
    // ava.entity.ts
    'ava_audit_trail',
    'ava_permission_configs',
    'ava_global_settings',
    'ava_conversations',
    'ava_messages',
    'ava_intents',
    'ava_contexts',
    'ava_predictions',
    'ava_anomalies',
    'ava_suggestions',
    'ava_feedback',
    'ava_knowledge_embeddings',
    'ava_usage_metrics',
    // ava-registry.entity.ts
    'ava_tools',
    'ava_topics',
    'ava_cards',
    'ava_prompt_policies',
    // ava-proposal.entity.ts
    'ava_proposal',
    // modelops.entity.ts
    'dataset_definitions',
    'dataset_snapshots',
    'model_artifacts',
    'model_evaluations',
    'model_training_jobs',
    'model_deployments',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "ava"`);

    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE public."${table}" SET SCHEMA ava';
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'ava'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE ava."${table}" SET SCHEMA public';
          END IF;
        END $$;
      `);
    }
    await queryRunner.query(`DROP SCHEMA IF EXISTS "ava" CASCADE`);
  }
}
