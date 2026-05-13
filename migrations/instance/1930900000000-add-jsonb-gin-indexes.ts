import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * F048 — JSONB GIN coverage for confirmed query patterns.
 *
 * Audit criterion: only columns with demonstrated JSONB operator usage in
 * `apps/api/src/app/` service code are indexed. No speculative coverage.
 *
 * Columns confirmed as actively queried (with ->> text-extraction operators):
 *   - collection_definitions.metadata   (collection-data.service: metadata->>'status')
 *   - property_definitions.metadata     (collection-data.service: metadata->>'status')
 *   - property_definitions.config       (computed-property-dispatcher: config->>'sourceCollection',
 *                                        config->>'relationProperty'; reference-scanner:
 *                                        config->>'formula')
 *   - property_definitions.behavioral_attributes (behavioral-attributes.service: dynamic key)
 *   - automation_rules.metadata         (packs.service: metadata->>'code')
 *
 * Operator class rationale:
 *   - jsonb_ops    supports ?, ?|, ?&, @>, <@. Chosen for columns queried
 *                  with dynamic-key access (behavioral_attributes, config)
 *                  because the query plans can use ? key-existence narrowing.
 *   - jsonb_path_ops  supports @> only; 3× smaller, faster for containment.
 *                  Chosen for columns queried with a predictable single-key
 *                  pattern that the planner can rewrite as containment
 *                  (metadata with status/code keys).
 *
 * Note on ->> vs @>: GIN does NOT accelerate ->> equality directly. These
 * indexes enable future @> / ? queries (AVA reasoning, admin audit search)
 * and reduce row-visibility costs on low-write, high-cardinality tables.
 * High-write tables (instance_event_outbox, metric snapshots) are excluded
 * because GIN write amplification would exceed the query benefit.
 *
 * CONCURRENTLY cannot run inside a transaction.
 */
export class AddJsonbGinIndexes1930900000000 implements MigrationInterface {
  public transaction = false;

  name = 'AddJsonbGinIndexes1930900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // collection_definitions.metadata: queried with ->>'status' by collection-data.service;
    // jsonb_path_ops chosen because all access patterns are single-key containment equivalents.
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_collection_definitions_metadata_gin"
       ON "collection_definitions" USING gin ("metadata" jsonb_path_ops)`,
    );

    // property_definitions.metadata: queried with ->>'status' by collection-data.service
    // on the same read path as collection metadata. Same single-key containment pattern.
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_property_definitions_metadata_gin"
       ON "property_definitions" USING gin ("metadata" jsonb_path_ops)`,
    );

    // property_definitions.config: queried with ->>'sourceCollection', ->>'relationProperty',
    // ->>'formula' by computed-property-dispatcher and reference-scanner services.
    // Multiple keys accessed → jsonb_ops for key-existence (?) narrowing.
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_property_definitions_config_gin"
       ON "property_definitions" USING gin ("config" jsonb_ops)`,
    );

    // property_definitions.behavioral_attributes: queried with a dynamic key parameter
    // (->> :key = 'true') by behavioral-attributes.service. jsonb_ops chosen because
    // the key name is dynamic — key-existence (?) narrowing is the relevant GIN operation.
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_property_definitions_behavioral_attributes_gin"
       ON "property_definitions" USING gin ("behavioral_attributes" jsonb_ops)`,
    );

    // automation_rules.metadata: queried with ->>'code' by packs.service pack-install
    // and pack-uninstall paths. Single-key containment pattern → jsonb_path_ops.
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_automation_rules_metadata_gin"
       ON "automation_rules" USING gin ("metadata" jsonb_path_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "idx_automation_rules_metadata_gin"`,
    );

    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "idx_property_definitions_behavioral_attributes_gin"`,
    );

    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "idx_property_definitions_config_gin"`,
    );

    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "idx_property_definitions_metadata_gin"`,
    );

    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "idx_collection_definitions_metadata_gin"`,
    );
  }
}
