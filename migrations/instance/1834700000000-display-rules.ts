import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 §7.3 — DisplayRule + DisplayRuleRevision tables. ADR-5
 * lifecycle pattern (parent + append-only revision history). The
 * priority column drives ordering when multiple rules apply to the
 * same property; lower numbers run first and higher-priority rules
 * override.
 */
export class DisplayRules1834700000000 implements MigrationInterface {
  name = 'DisplayRules1834700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS display_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        description text NULL,
        collection_id uuid NOT NULL,
        application_id uuid NOT NULL,
        condition jsonb NOT NULL DEFAULT '{}'::jsonb,
        actions jsonb NOT NULL DEFAULT '[]'::jsonb,
        priority integer NOT NULL DEFAULT 100,
        is_active boolean NOT NULL DEFAULT true,
        status varchar(20) NOT NULL DEFAULT 'draft',
        current_revision_id uuid NULL,
        published_at timestamptz NULL,
        created_by uuid NULL,
        updated_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_display_rules_collection
          FOREIGN KEY (collection_id) REFERENCES collection_definitions(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_display_rules_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_display_rules_collection_active ON display_rules(collection_id, is_active)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_display_rules_application ON display_rules(application_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_display_rules_status ON display_rules(status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS display_rule_revisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        display_rule_id uuid NOT NULL,
        revision integer NOT NULL,
        status varchar(20) NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by uuid NULL,
        published_by uuid NULL,
        published_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_display_rule_revisions_rule
          FOREIGN KEY (display_rule_id) REFERENCES display_rules(id)
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_display_rule_revisions_rule ON display_rule_revisions(display_rule_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_display_rule_revisions_status ON display_rule_revisions(status)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_display_rule_revisions_rule_revision ON display_rule_revisions(display_rule_id, revision)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS display_rule_revisions`);
    await queryRunner.query(`DROP TABLE IF EXISTS display_rules`);
  }
}
