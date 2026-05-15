import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AppBuilderSchema1940600000000
 *
 * Plan Fix 24 / W9 Phase C — App-Builder (App Studio) domain. Moves
 * sprint recordings, AVA stories, customization registry, predictive
 * insights, digital twins, AI reports, NL queries, zero-code apps,
 * voice control, predictive UI, etc. into a dedicated `app_builder`
 * schema.
 *
 * App-Builder is a leaf domain. The future `svc-app-builder` will own
 * it directly; until then, no service consumes these tables, so the
 * isolation has zero cross-domain blast radius.
 *
 * Schema name uses underscore (`app_builder`) rather than hyphen
 * because Postgres identifiers without quoting can't carry hyphens.
 */
export class AppBuilderSchema1940600000000 implements MigrationInterface {
  name = 'AppBuilderSchema1940600000000';

  private readonly tables = [
    'sprint_recordings',
    'ava_stories',
    'story_implementations',
    'customization_registry',
    'upgrade_impact_analyses',
    'upgrade_fixes',
    'generated_documentation',
    'documentation_versions',
    'predictive_insights',
    'insight_analysis_jobs',
    'digital_twins',
    'sensor_readings',
    'self_healing_events',
    'service_health_status',
    'recovery_actions',
    'ai_reports',
    'ai_report_templates',
    'nl_queries',
    'saved_nl_queries',
    'zero_code_apps',
    'zero_code_app_versions',
    'app_builder_components',
    'voice_commands',
    'voice_command_patterns',
    'user_behaviors',
    'predictive_suggestions',
    'user_patterns',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "app_builder"`);

    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE public."${table}" SET SCHEMA app_builder';
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
             WHERE table_schema = 'app_builder'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE app_builder."${table}" SET SCHEMA public';
          END IF;
        END $$;
      `);
    }
    await queryRunner.query(`DROP SCHEMA IF EXISTS "app_builder" CASCADE`);
  }
}
