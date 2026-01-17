import { MigrationInterface, QueryRunner } from 'typeorm';

export class PackReleaseTables1817000000000 implements MigrationInterface {
  name = 'PackReleaseTables1817000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pack_release_records (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        pack_code varchar(200) NOT NULL,
        pack_release_id varchar(50) NOT NULL,
        status varchar(30) NOT NULL,
        manifest jsonb NOT NULL,
        artifact_sha256 varchar(64),
        install_summary jsonb NOT NULL DEFAULT '{}',
        warnings jsonb NOT NULL DEFAULT '[]',
        applied_by uuid,
        applied_by_type varchar(20) NOT NULL DEFAULT 'system',
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        rollback_of_release_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_pack_release_status CHECK (status IN ('applying', 'applied', 'failed', 'rolled_back', 'skipped')),
        CONSTRAINT chk_pack_release_actor CHECK (applied_by_type IN ('user', 'system')),
        CONSTRAINT chk_pack_release_id_format CHECK (pack_release_id ~ '^[0-9]{8}\\.[0-9]{3,}$'),
        CONSTRAINT chk_pack_release_sha256 CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[a-f0-9]{64}$')
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pack_object_revisions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        release_record_id uuid NOT NULL REFERENCES pack_release_records(id) ON DELETE CASCADE,
        object_type varchar(30) NOT NULL,
        object_key varchar(255) NOT NULL,
        object_hash varchar(64) NOT NULL,
        object_id uuid,
        content jsonb NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_pack_object_type CHECK (object_type IN ('metadata','access','views','automation','workflows','insights','ava','seed')),
        CONSTRAINT chk_pack_object_hash CHECK (object_hash ~ '^[a-f0-9]{64}$')
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pack_object_states (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        object_type varchar(30) NOT NULL,
        object_key varchar(255) NOT NULL,
        pack_code varchar(200) NOT NULL,
        current_revision_id uuid NOT NULL REFERENCES pack_object_revisions(id),
        current_hash varchar(64) NOT NULL,
        object_id uuid,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_pack_object_state UNIQUE (object_type, object_key),
        CONSTRAINT chk_pack_object_state_type CHECK (object_type IN ('metadata','access','views','automation','workflows','insights','ava','seed')),
        CONSTRAINT chk_pack_object_state_hash CHECK (current_hash ~ '^[a-f0-9]{64}$')
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pack_install_locks (
        lock_key varchar(100) PRIMARY KEY,
        lock_holder varchar(100),
        lock_acquired_at timestamptz,
        lock_expires_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_release_records_pack ON pack_release_records(pack_code, pack_release_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_release_records_status ON pack_release_records(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_release_records_started_at ON pack_release_records(started_at);`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_object_revisions_release ON pack_object_revisions(release_record_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_object_revisions_object ON pack_object_revisions(object_type, object_key);`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_object_states_pack ON pack_object_states(pack_code);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pack_object_states_object_id ON pack_object_states(object_id);`);

    await queryRunner.query(`
      ALTER TABLE pack_release_records
      ADD CONSTRAINT fk_pack_release_applied_by
      FOREIGN KEY (applied_by) REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE pack_release_records
      ADD CONSTRAINT fk_pack_release_rollback
      FOREIGN KEY (rollback_of_release_id) REFERENCES pack_release_records(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      INSERT INTO pack_install_locks (lock_key)
      VALUES ('packs.install')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE pack_release_records DROP CONSTRAINT IF EXISTS fk_pack_release_rollback`);
    await queryRunner.query(`ALTER TABLE pack_release_records DROP CONSTRAINT IF EXISTS fk_pack_release_applied_by`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_object_states_object_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_object_states_pack`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_object_revisions_object`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_object_revisions_release`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_release_records_started_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_release_records_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pack_release_records_pack`);

    await queryRunner.query(`DROP TABLE IF EXISTS pack_install_locks`);
    await queryRunner.query(`DROP TABLE IF EXISTS pack_object_states`);
    await queryRunner.query(`DROP TABLE IF EXISTS pack_object_revisions`);
    await queryRunner.query(`DROP TABLE IF EXISTS pack_release_records`);
  }
}
