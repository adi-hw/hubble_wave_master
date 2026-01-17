import { MigrationInterface, QueryRunner } from 'typeorm';

export class PackInstallable1819000000000 implements MigrationInterface {
  name = 'PackInstallable1819000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pack_releases
      ADD COLUMN IF NOT EXISTS is_installable_by_client boolean NOT NULL DEFAULT false;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pack_releases_installable
      ON pack_releases (is_installable_by_client);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_releases_installable`);
    await queryRunner.query(`ALTER TABLE pack_releases DROP COLUMN IF EXISTS is_installable_by_client`);
  }
}
