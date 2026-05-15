import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NotifySchema1940000000000
 *
 * Plan Fix 24 / W9 Phase C — pilot domain. Moves the notification
 * tables out of the public schema into a dedicated `notify` schema so
 * svc-notify's TypeORM connection can scope to its own namespace.
 *
 * Notify is a leaf domain (nothing FKs into notification tables) so
 * the move is internal — every existing reference is already inside
 * the notify table cluster. Cross-schema reads (the templates table
 * has a CollectionDefinition reference) work natively in Postgres
 * once both schemas are on the search_path.
 *
 * If running against a fresh database, the entities' `{ schema: 'notify' }`
 * decorator already creates them in the right place; this migration's
 * `IF EXISTS` checks make it a no-op there. On an upgraded database, it
 * relocates the prior tables.
 */
export class NotifySchema1940000000000 implements MigrationInterface {
  name = 'NotifySchema1940000000000';

  private readonly tables = [
    'notification_templates',
    'notification_queue',
    'notification_history',
    'in_app_notifications',
    'user_notification_preferences',
    'device_tokens',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "notify"`);

    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE public."${table}" SET SCHEMA notify';
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
             WHERE table_schema = 'notify'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE notify."${table}" SET SCHEMA public';
          END IF;
        END $$;
      `);
    }
    await queryRunner.query(`DROP SCHEMA IF EXISTS "notify" CASCADE`);
  }
}
