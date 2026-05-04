import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 Slice B6c — `dependent_review_queue` table backing ADR-17's
 * structural-publish path.
 *
 * When a Collection publish has structural or breaking property
 * changes, the impact-analyzer registry returns a list of dependent
 * artifacts (forms, views, process flows, automation rules) that
 * reference the changed properties. Per ADR-17 those dependents are
 * not silently rewritten; they are persisted here as `needs_review`
 * rows that the Studio dashboard surfaces until an admin
 * acknowledges or dismisses each entry.
 *
 * Cosmetic changes never reach the queue — there is nothing to
 * review.
 */
export class DependentReviewQueue1834400000000 implements MigrationInterface {
  name = 'DependentReviewQueue1834400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dependent_review_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id uuid NOT NULL,
        collection_code varchar(120) NOT NULL,
        property_code varchar(120) NOT NULL,
        property_id uuid NULL,
        change_kind varchar(16) NOT NULL,
        classification varchar(16) NOT NULL,
        entity_type varchar(32) NOT NULL,
        entity_id uuid NOT NULL,
        entity_label varchar(255) NOT NULL,
        href text NULL,
        reason text NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'needs_review',
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        resolved_by uuid NULL,
        resolved_at timestamptz NULL,
        resolution_note text NULL,
        CONSTRAINT fk_dependent_review_queue_collection
          FOREIGN KEY (collection_id) REFERENCES collection_definitions(id)
          ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dep_review_collection_status
        ON dependent_review_queue(collection_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dep_review_status_created_at
        ON dependent_review_queue(status, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dep_review_entity
        ON dependent_review_queue(entity_type, entity_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dep_review_entity`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dep_review_status_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dep_review_collection_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS dependent_review_queue`);
  }
}
