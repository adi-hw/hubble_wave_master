import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brings the legacy connector tables (`external_connectors`,
 * `connector_connections`) up to the entity definitions in
 * `libs/instance-db/src/lib/entities/integration.entity.ts`.
 * Pre-existing drift: the original create migrations omitted
 * created_by / updated_by / code / credential_ref columns the
 * entities have always declared.
 *
 * Without these columns, every TypeORM SELECT against these tables
 * 500s with "column does not exist" — the same root cause as the
 * earlier `metadata` gap fixed by 1835500000000-add-connector-metadata-columns.
 *
 * Idempotent.
 */
export class FinishConnectorTablesSchema1835600000000
  implements MigrationInterface
{
  name = 'FinishConnectorTablesSchema1835600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── external_connectors ─────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE IF EXISTS external_connectors ADD COLUMN IF NOT EXISTS created_by uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS external_connectors ADD COLUMN IF NOT EXISTS updated_by uuid NULL`,
    );

    // ── connector_connections ───────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE IF EXISTS connector_connections ADD COLUMN IF NOT EXISTS code varchar(120) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS connector_connections ADD COLUMN IF NOT EXISTS credential_ref text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS connector_connections ADD COLUMN IF NOT EXISTS updated_by uuid NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS connector_connections DROP COLUMN IF EXISTS updated_by`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS connector_connections DROP COLUMN IF EXISTS credential_ref`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS connector_connections DROP COLUMN IF EXISTS code`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS external_connectors DROP COLUMN IF EXISTS updated_by`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS external_connectors DROP COLUMN IF EXISTS created_by`,
    );
  }
}
