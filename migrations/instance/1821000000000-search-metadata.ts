import { MigrationInterface, QueryRunner } from 'typeorm';

export class SearchMetadata1821000000000 implements MigrationInterface {
  name = 'SearchMetadata1821000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS search_experiences (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(120) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        scope varchar(20) NOT NULL,
        scope_key varchar(120),
        config jsonb NOT NULL DEFAULT '{}',
        metadata jsonb NOT NULL DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_search_experiences_code UNIQUE (code)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS search_sources (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(120) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        collection_code varchar(120) NOT NULL,
        config jsonb NOT NULL DEFAULT '{}',
        metadata jsonb NOT NULL DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_search_sources_code UNIQUE (code)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS search_dictionaries (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(120) NOT NULL,
        name varchar(255) NOT NULL,
        locale varchar(20) NOT NULL DEFAULT 'en',
        entries jsonb NOT NULL DEFAULT '[]',
        metadata jsonb NOT NULL DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_search_dictionaries_code UNIQUE (code)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS search_index_state (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        collection_code varchar(120) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'idle',
        last_indexed_at timestamptz,
        last_cursor varchar(200),
        stats jsonb NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_search_index_state_collection UNIQUE (collection_code)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_search_experiences_scope ON search_experiences(scope);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_search_experiences_scope_key ON search_experiences(scope_key);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_search_sources_collection ON search_sources(collection_code);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_search_dictionaries_locale ON search_dictionaries(locale);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_search_dictionaries_locale`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_search_sources_collection`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_search_experiences_scope_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_search_experiences_scope`);

    await queryRunner.query(`DROP TABLE IF EXISTS search_index_state`);
    await queryRunner.query(`DROP TABLE IF EXISTS search_dictionaries`);
    await queryRunner.query(`DROP TABLE IF EXISTS search_sources`);
    await queryRunner.query(`DROP TABLE IF EXISTS search_experiences`);
  }
}
