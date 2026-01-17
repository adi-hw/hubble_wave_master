import { MigrationInterface, QueryRunner } from 'typeorm';

export class PackRegistry1817000000000 implements MigrationInterface {
  name = 'PackRegistry1817000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pack_registry (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(200) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        publisher varchar(120) NOT NULL,
        license varchar(120),
        metadata jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_pack_registry_code UNIQUE (code)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pack_releases (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        pack_id uuid NOT NULL REFERENCES pack_registry(id) ON DELETE CASCADE,
        release_id varchar(50) NOT NULL,
        manifest_revision int NOT NULL DEFAULT 1,
        manifest jsonb NOT NULL,
        dependencies jsonb,
        compatibility jsonb,
        assets jsonb NOT NULL,
        artifact_bucket varchar(255) NOT NULL,
        artifact_key varchar(500) NOT NULL,
        artifact_sha256 varchar(64) NOT NULL,
        signature text NOT NULL,
        signature_key_id varchar(200) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_pack_releases_pack_release UNIQUE (pack_id, release_id),
        CONSTRAINT chk_pack_release_id_format CHECK (release_id ~ '^[0-9]{8}\\.[0-9]{3,}$'),
        CONSTRAINT chk_pack_release_sha256 CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$')
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_registry_publisher ON pack_registry(publisher);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_releases_pack_id ON pack_releases(pack_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_releases_release_id ON pack_releases(release_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_releases_active ON pack_releases(is_active);`);

    await queryRunner.query(`
      ALTER TABLE pack_registry
      ADD CONSTRAINT fk_pack_registry_created_by
      FOREIGN KEY (created_by) REFERENCES control_plane_users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE pack_registry
      ADD CONSTRAINT fk_pack_registry_updated_by
      FOREIGN KEY (updated_by) REFERENCES control_plane_users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE pack_releases
      ADD CONSTRAINT fk_pack_releases_created_by
      FOREIGN KEY (created_by) REFERENCES control_plane_users(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE pack_releases DROP CONSTRAINT IF EXISTS fk_pack_releases_created_by`);
    await queryRunner.query(`ALTER TABLE pack_registry DROP CONSTRAINT IF EXISTS fk_pack_registry_updated_by`);
    await queryRunner.query(`ALTER TABLE pack_registry DROP CONSTRAINT IF EXISTS fk_pack_registry_created_by`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_releases_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_releases_release_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_releases_pack_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_registry_publisher`);

    await queryRunner.query(`DROP TABLE IF EXISTS pack_releases`);
    await queryRunner.query(`DROP TABLE IF EXISTS pack_registry`);
  }
}
