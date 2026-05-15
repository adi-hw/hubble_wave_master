import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IntegrationsSchema1940400000000
 *
 * Plan Fix 24 / W9 Phase C — integrations domain. Moves OAuth, API
 * keys, webhooks, external connectors, sync config, and import/export
 * jobs out of public into a dedicated `integrations` schema.
 *
 * Currently consumed by svc-data (it hosts the integration module
 * pending the future svc-integrations extraction). svc-data's
 * search_path includes integrations after this migration.
 */
export class IntegrationsSchema1940400000000 implements MigrationInterface {
  name = 'IntegrationsSchema1940400000000';

  private readonly tables = [
    'api_keys',
    'oauth_clients',
    'oauth_authorization_codes',
    'oauth_access_tokens',
    'oauth_refresh_tokens',
    'webhook_subscriptions',
    'webhook_deliveries',
    'external_connectors',
    'connector_connections',
    'property_mappings',
    'import_jobs',
    'export_jobs',
    'sync_configurations',
    'sync_runs',
    'api_request_logs',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "integrations"`);

    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE public."${table}" SET SCHEMA integrations';
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
             WHERE table_schema = 'integrations'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE integrations."${table}" SET SCHEMA public';
          END IF;
        END $$;
      `);
    }
    await queryRunner.query(`DROP SCHEMA IF EXISTS "integrations" CASCADE`);
  }
}
