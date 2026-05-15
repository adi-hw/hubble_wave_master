import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * InsightsSchema1940100000000
 *
 * Plan Fix 24 / W9 Phase C — second domain after notify. Moves the
 * analytics tables out of public into a dedicated `insights` schema
 * so svc-insights' connection can scope to its own namespace.
 *
 * Insights is a leaf domain (nothing FKs into the analytics tables);
 * the move is internal and idempotent — `IF EXISTS` checks make it a
 * no-op against a fresh database where TypeORM already created the
 * tables under the new schema via the entity decorators.
 */
export class InsightsSchema1940100000000 implements MigrationInterface {
  name = 'InsightsSchema1940100000000';

  private readonly tables = [
    'analytics_events',
    'aggregated_metrics',
    'metric_definitions',
    'metric_points',
    'dashboard_definitions',
    'alert_definitions',
    'reports',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "insights"`);

    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE public."${table}" SET SCHEMA insights';
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
             WHERE table_schema = 'insights'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE insights."${table}" SET SCHEMA public';
          END IF;
        END $$;
      `);
    }
    await queryRunner.query(`DROP SCHEMA IF EXISTS "insights" CASCADE`);
  }
}
