/**
 * Migration: add ACL projection columns to search_embeddings.
 *
 * The pgvector pre-filter (Plan Fix 30 PR-3 / F136) needs to filter
 * search_embeddings rows by §28 collection access rules before the ANN
 * ranking runs. Two categories of columns are added:
 *
 *   _collection_id   — the parent collection UUID of the indexed record.
 *                      Required by every `in_collection` AST node.
 *
 *   _attribute_*     — denormalized ABAC field values for `attribute_match`
 *                      AST nodes. The initial set is kept to the common ABAC
 *                      fields that current ACL rules reference:
 *
 *                        _attribute_region        — geographic region code
 *                        _attribute_department_id — department UUID
 *                        _attribute_site_id       — facility / site UUID
 *
 *                      Additional `_attribute_*` columns can be added in
 *                      follow-up migrations as new ABAC attributes are added
 *                      to CollectionAccessRule conditions. The column set here
 *                      is derived from `extractRequiredAttributes()` over the
 *                      current ACL rule vocabulary.
 *
 * Existing rows default to NULL for all new columns. The
 * `SearchEmbeddingService.upsertRecordEmbeddings()` path is updated to write
 * these columns on every upsert from the indexer.
 *
 * Indexes are CONCURRENTLY to avoid locking the table during deployment.
 * The migration must therefore run outside a transaction (transaction: false).
 *
 * Canon refs: §9 (centralized authz), §28 (resolution model),
 * Plan Fix 30 PR-3 / F136.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SearchEmbeddingsAclColumns1931000000000 implements MigrationInterface {
  name = 'SearchEmbeddingsAclColumns1931000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add _collection_id column.
    await queryRunner.query(`
      ALTER TABLE search_embeddings
      ADD COLUMN IF NOT EXISTS _collection_id uuid NULL
    `);

    // Add denormalized ABAC attribute columns.
    await queryRunner.query(`
      ALTER TABLE search_embeddings
      ADD COLUMN IF NOT EXISTS _attribute_region text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE search_embeddings
      ADD COLUMN IF NOT EXISTS _attribute_department_id uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE search_embeddings
      ADD COLUMN IF NOT EXISTS _attribute_site_id uuid NULL
    `);

    // Index on _collection_id — the most common authz pre-filter predicate.
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_embeddings_collection_id
      ON search_embeddings (_collection_id)
    `);

    // Index on _attribute_region for ABAC region-scoped pre-filters.
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_embeddings_attr_region
      ON search_embeddings (_attribute_region)
    `);

    // Index on _attribute_department_id for ABAC department-scoped pre-filters.
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_embeddings_attr_department_id
      ON search_embeddings (_attribute_department_id)
    `);

    // Index on _attribute_site_id for ABAC site-scoped pre-filters.
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_embeddings_attr_site_id
      ON search_embeddings (_attribute_site_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_search_embeddings_attr_site_id`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_search_embeddings_attr_department_id`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_search_embeddings_attr_region`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_search_embeddings_collection_id`);

    await queryRunner.query(`
      ALTER TABLE search_embeddings
      DROP COLUMN IF EXISTS _attribute_site_id,
      DROP COLUMN IF EXISTS _attribute_department_id,
      DROP COLUMN IF EXISTS _attribute_region,
      DROP COLUMN IF EXISTS _collection_id
    `);
  }
}
