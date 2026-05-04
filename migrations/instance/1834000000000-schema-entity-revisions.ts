import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 0 Slice C1 — Roll ADR-5 (uniform DRAFT / PUBLISHED revisions) out
 * to the schema-engine entities CollectionDefinition and PropertyDefinition.
 *
 * Before this migration, lifecycle state was carried inside the `metadata`
 * JSONB blob (`metadata.status`). That worked for the early grid prototype
 * but couldn't be indexed, joined, or audited as a first-class column.
 * After this migration both entities have:
 *   - a real `status` column (draft | published | deprecated)
 *   - a `current_revision_id` UUID pointer
 *   - a dedicated `*_revisions` table holding append-only payload snapshots
 *
 * PropertyDefinition additionally gains an `application_id` FK so cross-
 * application reference checks don't have to traverse the parent collection
 * (ADR-6, transitive scoping is too brittle).
 *
 * Backfill strategy: every existing collection / property gets a single
 * revision (revision = 1, status = published) so runtime resolution via
 * currentRevisionId works the moment the migration completes. The status
 * column is initialised from the legacy `metadata.status` value when one
 * exists; otherwise the row is treated as `published` since pre-canon rows
 * were already in service.
 */
export class SchemaEntityRevisions1834000000000 implements MigrationInterface {
  name = 'SchemaEntityRevisions1834000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // 1. CollectionDefinition: add status / current_revision_id / published_at.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE collection_definitions
        ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS current_revision_id uuid,
        ADD COLUMN IF NOT EXISTS published_at timestamptz
    `);
    // Hydrate status from legacy metadata.status where present; otherwise
    // treat existing rows as published (they were already live).
    await queryRunner.query(`
      UPDATE collection_definitions
         SET status = COALESCE(NULLIF(metadata->>'status', ''), 'published')
       WHERE status = 'draft'
    `);
    await queryRunner.query(`
      UPDATE collection_definitions
         SET published_at = COALESCE(published_at, updated_at, created_at)
       WHERE status = 'published'
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_collection_definitions_status ON collection_definitions(status);`,
    );

    // ------------------------------------------------------------------
    // 2. collection_definition_revisions table.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS collection_definition_revisions (
        id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        collection_id   uuid NOT NULL REFERENCES collection_definitions(id) ON DELETE CASCADE,
        revision        integer NOT NULL,
        status          varchar(20) NOT NULL,
        payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by      uuid,
        published_by    uuid,
        published_at    timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_collection_definition_revisions_collection_id ON collection_definition_revisions(collection_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_collection_definition_revisions_status ON collection_definition_revisions(status);`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_definition_revisions_col_rev ON collection_definition_revisions(collection_id, revision);`,
    );

    // ------------------------------------------------------------------
    // 3. Backfill: revision 1 (matching the parent's effective status) for
    //    every existing collection. Snapshot the authoring fields into the
    //    payload column so the revision is self-contained.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO collection_definition_revisions
        (collection_id, revision, status, payload, published_by, published_at, created_by, created_at)
      SELECT
        c.id,
        1,
        c.status,
        jsonb_build_object(
          'code', c.code,
          'name', c.name,
          'pluralName', c.plural_name,
          'description', c.description,
          'category', c.category,
          'applicationId', c.application_id,
          'tableName', c.table_name,
          'labelProperty', c.label_property,
          'secondaryLabelProperty', c.secondary_label_property,
          'isExtensible', c.is_extensible,
          'isAudited', c.is_audited,
          'enableVersioning', c.enable_versioning,
          'enableAttachments', c.enable_attachments,
          'enableActivityLog', c.enable_activity_log,
          'enableSearch', c.enable_search,
          'icon', c.icon,
          'color', c.color,
          'defaultAccess', c.default_access,
          'metadata', c.metadata
        ),
        CASE WHEN c.status = 'published' THEN c.updated_by ELSE NULL END,
        CASE WHEN c.status = 'published' THEN COALESCE(c.published_at, c.updated_at) ELSE NULL END,
        c.created_by,
        c.created_at
      FROM collection_definitions c
      WHERE NOT EXISTS (
        SELECT 1 FROM collection_definition_revisions r WHERE r.collection_id = c.id
      )
    `);
    // Wire current_revision_id for every collection that doesn't have one yet.
    await queryRunner.query(`
      UPDATE collection_definitions c
         SET current_revision_id = r.id
        FROM collection_definition_revisions r
       WHERE r.collection_id = c.id
         AND r.revision = 1
         AND c.current_revision_id IS NULL
    `);

    // ------------------------------------------------------------------
    // 4. PropertyDefinition: add application_id, status, current_revision_id, published_at.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE property_definitions
        ADD COLUMN IF NOT EXISTS application_id uuid,
        ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS current_revision_id uuid,
        ADD COLUMN IF NOT EXISTS published_at timestamptz
    `);
    // Hydrate status from legacy metadata.status; default to published.
    await queryRunner.query(`
      UPDATE property_definitions
         SET status = COALESCE(NULLIF(metadata->>'status', ''), 'published')
       WHERE status = 'draft'
    `);
    // Backfill applicationId from the parent collection.
    await queryRunner.query(`
      UPDATE property_definitions p
         SET application_id = c.application_id
        FROM collection_definitions c
       WHERE p.collection_id = c.id
         AND p.application_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE property_definitions
         SET published_at = COALESCE(published_at, updated_at, created_at)
       WHERE status = 'published'
    `);
    // FK constraint on application_id (RESTRICT — same posture as
    // collection_definitions.application_id).
    await queryRunner.query(`
      ALTER TABLE property_definitions
        ADD CONSTRAINT fk_property_definitions_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `ALTER TABLE property_definitions ALTER COLUMN application_id SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_property_definitions_application_id ON property_definitions(application_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_property_definitions_status ON property_definitions(status);`,
    );

    // ------------------------------------------------------------------
    // 5. property_definition_revisions table.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS property_definition_revisions (
        id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        property_id     uuid NOT NULL REFERENCES property_definitions(id) ON DELETE CASCADE,
        revision        integer NOT NULL,
        status          varchar(20) NOT NULL,
        payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by      uuid,
        published_by    uuid,
        published_at    timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_property_definition_revisions_property_id ON property_definition_revisions(property_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_property_definition_revisions_status ON property_definition_revisions(status);`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_property_definition_revisions_prop_rev ON property_definition_revisions(property_id, revision);`,
    );

    // ------------------------------------------------------------------
    // 6. Backfill: revision 1 for every existing property.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO property_definition_revisions
        (property_id, revision, status, payload, published_by, published_at, created_by, created_at)
      SELECT
        p.id,
        1,
        p.status,
        jsonb_build_object(
          'code', p.code,
          'name', p.name,
          'description', p.description,
          'collectionId', p.collection_id,
          'applicationId', p.application_id,
          'propertyTypeId', p.property_type_id,
          'columnName', p.column_name,
          'config', p.config,
          'isRequired', p.is_required,
          'isUnique', p.is_unique,
          'isIndexed', p.is_indexed,
          'validationRules', p.validation_rules,
          'defaultValue', p.default_value,
          'defaultValueType', p.default_value_type,
          'position', p.position,
          'isVisible', p.is_visible,
          'isReadonly', p.is_readonly,
          'displayFormat', p.display_format,
          'placeholder', p.placeholder,
          'helpText', p.help_text,
          'referenceCollectionId', p.reference_collection_id,
          'referenceDisplayProperty', p.reference_display_property,
          'referenceFilter', p.reference_filter,
          'choiceListId', p.choice_list_id,
          'ownerType', p.owner_type,
          'isSystem', p.is_system,
          'isActive', p.is_active,
          'isSearchable', p.is_searchable,
          'isSortable', p.is_sortable,
          'isFilterable', p.is_filterable,
          'isPhi', p.is_phi,
          'isPii', p.is_pii,
          'isSensitive', p.is_sensitive,
          'maskingStrategy', p.masking_strategy,
          'maskValue', p.mask_value,
          'requiresBreakGlass', p.requires_break_glass,
          'metadata', p.metadata
        ),
        CASE WHEN p.status = 'published' THEN p.created_by ELSE NULL END,
        CASE WHEN p.status = 'published' THEN COALESCE(p.published_at, p.updated_at) ELSE NULL END,
        p.created_by,
        p.created_at
      FROM property_definitions p
      WHERE NOT EXISTS (
        SELECT 1 FROM property_definition_revisions r WHERE r.property_id = p.id
      )
    `);
    await queryRunner.query(`
      UPDATE property_definitions p
         SET current_revision_id = r.id
        FROM property_definition_revisions r
       WHERE r.property_id = p.id
         AND r.revision = 1
         AND p.current_revision_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PropertyDefinition revisions
    await queryRunner.query(`DROP INDEX IF EXISTS idx_property_definition_revisions_prop_rev;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_property_definition_revisions_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_property_definition_revisions_property_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS property_definition_revisions;`);

    // PropertyDefinition columns
    await queryRunner.query(`DROP INDEX IF EXISTS idx_property_definitions_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_property_definitions_application_id;`);
    await queryRunner.query(
      `ALTER TABLE property_definitions ALTER COLUMN application_id DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE property_definitions DROP CONSTRAINT IF EXISTS fk_property_definitions_application`,
    );
    await queryRunner.query(`
      ALTER TABLE property_definitions
        DROP COLUMN IF EXISTS published_at,
        DROP COLUMN IF EXISTS current_revision_id,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS application_id
    `);

    // CollectionDefinition revisions
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_definition_revisions_col_rev;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_definition_revisions_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_definition_revisions_collection_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS collection_definition_revisions;`);

    // CollectionDefinition columns
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_definitions_status;`);
    await queryRunner.query(`
      ALTER TABLE collection_definitions
        DROP COLUMN IF EXISTS published_at,
        DROP COLUMN IF EXISTS current_revision_id,
        DROP COLUMN IF EXISTS status
    `);
  }
}
