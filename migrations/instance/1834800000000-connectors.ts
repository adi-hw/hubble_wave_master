import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 §8.1.10 — Connector starter framework. Three seeded kinds
 * (http, smtp, ldap) are available out of the box; additional
 * connectors register the same shape post-install.
 */
export class Connectors1834800000000 implements MigrationInterface {
  name = 'Connectors1834800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS connectors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(120) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text NULL,
        kind varchar(20) NOT NULL,
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        credential_ref varchar(255) NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_by uuid NULL,
        updated_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_connectors_kind_status ON connectors(kind, status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS connectors`);
  }
}
