import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MetadataSchema1940700000000
 *
 * Plan Fix 24 / W9 Phase C — metadata domain. The largest and
 * most-read schema; moves applications, collections, properties,
 * forms, views, navigation, packs, themes, search, localization,
 * workspaces, change packages, and display rules out of public into
 * a dedicated `metadata` schema.
 *
 * Cross-schema reads from svc-data, svc-automation, svc-view-engine,
 * and svc-workflow are handled via TypeORM's qualified-name emission
 * (entity decorators carry `schema: 'metadata'`) and per-service
 * `searchPath` config — both already in place.
 *
 * Notification templates' FK to collection_definitions becomes a
 * cross-schema FK (`notify.notification_templates` →
 * `metadata.collection_definitions`), which Postgres handles natively.
 */
export class MetadataSchema1940700000000 implements MigrationInterface {
  name = 'MetadataSchema1940700000000';

  private readonly tables = [
    // application.entity.ts
    'applications',
    'application_revisions',
    // collection-definition.entity.ts
    'collection_definitions',
    'collection_definition_revisions',
    // property-definition.entity.ts
    'property_definitions',
    'property_definition_revisions',
    // property-type.entity.ts
    'property_types',
    'choice_lists',
    'choice_items',
    // collection-index.entity.ts
    'collection_indexes',
    'collection_constraints',
    // schema-change-log + schema-sync-state
    'schema_change_log',
    'schema_sync_state',
    // form.entity.ts
    'form_definitions',
    'form_versions',
    // view.entity.ts
    'view_definitions',
    'view_definition_revisions',
    'view_variants',
    'widget_catalog',
    // navigation-module.entity.ts
    'navigation_modules',
    'navigation_module_revisions',
    'navigation_variants',
    // navigation.entity.ts
    'nav_nodes',
    'nav_patches',
    // theme.entity.ts
    'theme_definitions',
    'user_theme_preferences',
    'instance_branding',
    // module.entity.ts
    'modules',
    'module_security',
    // search.entity.ts
    'search_experiences',
    'search_sources',
    'search_dictionaries',
    'search_index_state',
    // localization.entity.ts
    'locales',
    'translation_keys',
    'translation_values',
    'localization_bundles',
    'translation_requests',
    // pack.entity.ts
    'pack_release_records',
    'pack_object_revisions',
    'pack_object_states',
    'pack_install_locks',
    // change-package.entity.ts
    'change_packages',
    // workspace.entity.ts
    'workspace_definitions',
    'workspace_pages',
    'workspace_variants',
    // display-rule.entity.ts
    'display_rules',
    'display_rule_revisions',
    // dependent-review-queue.entity.ts
    'dependent_review_queue',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "metadata"`);

    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE public."${table}" SET SCHEMA metadata';
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
             WHERE table_schema = 'metadata'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE metadata."${table}" SET SCHEMA public';
          END IF;
        END $$;
      `);
    }
    await queryRunner.query(`DROP SCHEMA IF EXISTS "metadata" CASCADE`);
  }
}
