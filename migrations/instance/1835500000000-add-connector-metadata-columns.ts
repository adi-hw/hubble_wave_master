import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forward-roll migration adding the `metadata jsonb` column the
 * `ExternalConnector`, `ConnectorConnection`, and
 * `SyncConfiguration` entities have always declared but the original
 * connector tables omitted. Without these columns the GET endpoints
 * that select the column (every read on these tables) error out with
 * `column "metadata" does not exist`.
 *
 * Idempotent — safe to run on databases that already have the column
 * (e.g. fresh builds where the entity's `synchronize:true` already
 * created it, or a future migration that supersedes this one).
 */
export class AddConnectorMetadataColumns1835500000000
  implements MigrationInterface
{
  name = 'AddConnectorMetadataColumns1835500000000';

  private readonly tables: ReadonlyArray<string> = [
    'external_connectors',
    'connector_connections',
    'sync_configurations',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS ${table} ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS ${table} DROP COLUMN IF EXISTS metadata`,
      );
    }
  }
}
