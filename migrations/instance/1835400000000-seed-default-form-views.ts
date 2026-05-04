import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed a published instance-scope form view for every active Collection
 * that does not already have one. App Studio's Forms tab and the runtime
 * record pages both resolve form layouts through `view_definitions`; when
 * no form view exists the builder has no canvas to open and runtime
 * resolution falls back to ad hoc field ordering.
 *
 * Idempotent: collections with any active form view are skipped, and rows
 * created here carry a metadata marker for down migrations.
 */
export class SeedDefaultFormViews1835400000000 implements MigrationInterface {
  name = 'SeedDefaultFormViews1835400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH eligible_collections AS (
        SELECT c.id, c.code, c.name, c.application_id
          FROM collection_definitions c
         WHERE c.is_active = true
           AND c.application_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
               FROM view_definitions v
              WHERE v.kind = 'form'
                AND v.target_collection_code = c.code
                AND v.is_active = true
           )
      ),
      property_payload AS (
        SELECT
          p.collection_id,
          COALESCE(
            jsonb_agg(p.code ORDER BY p.position, p.created_at)
              FILTER (WHERE p.code IS NOT NULL),
            '[]'::jsonb
          ) AS field_codes,
          COALESCE(
            jsonb_agg(
              jsonb_build_object('code', p.code, 'span', 1)
              ORDER BY p.position, p.created_at
            ) FILTER (WHERE p.code IS NOT NULL),
            '[]'::jsonb
          ) AS field_details,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'type', 'property',
                'id', 'field_' || p.code,
                'propertyCode', p.code,
                'span', 1
              )
              ORDER BY p.position, p.created_at
            ) FILTER (WHERE p.code IS NOT NULL),
            '[]'::jsonb
          ) AS designer_items
          FROM property_definitions p
          JOIN eligible_collections c ON c.id = p.collection_id
         WHERE p.is_active = true
           AND COALESCE(p.status, 'published') = 'published'
         GROUP BY p.collection_id
      ),
      inserted_views AS (
        INSERT INTO view_definitions (
          id,
          code,
          name,
          description,
          kind,
          target_collection_code,
          application_id,
          metadata,
          is_active,
          source,
          created_at,
          updated_at
        )
        SELECT
          uuid_generate_v4(),
          LEFT(
            regexp_replace('form_' || c.code || '_default', '[^a-z0-9]+', '_', 'g'),
            120
          ),
          'Default Form',
          'Default form view for ' || c.name,
          'form',
          c.code,
          c.application_id,
          jsonb_build_object('status', 'published', 'seededBy', '1835400000000'),
          true,
          'custom',
          NOW(),
          NOW()
          FROM eligible_collections c
        ON CONFLICT (code) DO NOTHING
        RETURNING id, target_collection_code
      )
      INSERT INTO view_definition_revisions (
        id,
        view_definition_id,
        revision,
        status,
        layout,
        widget_bindings,
        actions,
        published_at,
        created_at
      )
      SELECT
        uuid_generate_v4(),
        v.id,
        1,
        'published',
        jsonb_build_object(
          'layout',
          jsonb_build_object(
            'inlineDisplayRules', '[]'::jsonb,
            'tabs',
            jsonb_build_array(
              jsonb_build_object(
                'id', 'tab_default',
                'label', 'Details',
                'icon', 'file-text',
                'sections',
                jsonb_build_array(
                  jsonb_build_object(
                    'id', 'section_general',
                    'label', 'General Information',
                    'columns', 2,
                    'collapsible', false,
                    'defaultCollapsed', false,
                    'fields', COALESCE(p.field_codes, '[]'::jsonb),
                    'fieldDetails', COALESCE(p.field_details, '[]'::jsonb)
                  )
                )
              )
            )
          ),
          'designer',
          jsonb_build_object(
            'version', 2,
            'tabs',
            jsonb_build_array(
              jsonb_build_object(
                'id', 'tab_default',
                'label', 'Details',
                'icon', 'file-text',
                'sections',
                jsonb_build_array(
                  jsonb_build_object(
                    'id', 'section_general',
                    'label', 'General Information',
                    'columns', 2,
                    'items', COALESCE(p.designer_items, '[]'::jsonb)
                  )
                )
              )
            )
          )
        ),
        '{}'::jsonb,
        '{}'::jsonb,
        NOW(),
        NOW()
        FROM inserted_views v
        JOIN collection_definitions c ON c.code = v.target_collection_code
        LEFT JOIN property_payload p ON p.collection_id = c.id
    `);

    await queryRunner.query(`
      INSERT INTO view_variants (
        id,
        view_definition_id,
        scope,
        scope_key,
        priority,
        is_active,
        created_at,
        updated_at
      )
      SELECT
        uuid_generate_v4(),
        v.id,
        'instance',
        NULL,
        100,
        true,
        NOW(),
        NOW()
        FROM view_definitions v
       WHERE v.kind = 'form'
         AND v.metadata->>'seededBy' = '1835400000000'
         AND NOT EXISTS (
           SELECT 1
             FROM view_variants existing
            WHERE existing.view_definition_id = v.id
              AND existing.scope = 'instance'
              AND existing.scope_key IS NULL
              AND existing.is_active = true
         )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM view_definitions
       WHERE kind = 'form'
         AND metadata->>'seededBy' = '1835400000000'
    `);
  }
}
