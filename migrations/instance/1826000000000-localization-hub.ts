import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocalizationHub1826000000000 implements MigrationInterface {
  name = 'LocalizationHub1826000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS locales (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(20) NOT NULL,
        name varchar(255) NOT NULL,
        direction varchar(5) NOT NULL DEFAULT 'ltr',
        metadata jsonb NOT NULL DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_locales_code UNIQUE (code)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS translation_keys (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        namespace varchar(120) NOT NULL,
        key varchar(200) NOT NULL,
        default_text text NOT NULL,
        description text,
        metadata jsonb NOT NULL DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_translation_keys_namespace_key UNIQUE (namespace, key)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS translation_values (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        translation_key_id uuid REFERENCES translation_keys(id) ON DELETE CASCADE,
        locale_id uuid REFERENCES locales(id) ON DELETE CASCADE,
        text text NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'draft',
        metadata jsonb NOT NULL DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_translation_values_key_locale UNIQUE (translation_key_id, locale_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS localization_bundles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        locale_id uuid REFERENCES locales(id) ON DELETE CASCADE,
        locale_code varchar(20) NOT NULL,
        entries jsonb NOT NULL DEFAULT '{}',
        checksum varchar(64) NOT NULL,
        published_by uuid,
        published_at timestamptz,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_localization_bundles_locale UNIQUE (locale_code)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_locales_code ON locales(code);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_translation_keys_namespace ON translation_keys(namespace);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_translation_values_locale ON translation_values(locale_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_translation_values_key ON translation_values(translation_key_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_localization_bundles_locale_id ON localization_bundles(locale_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_localization_bundles_locale_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_translation_values_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_translation_values_locale`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_translation_keys_namespace`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_locales_code`);

    await queryRunner.query(`DROP TABLE IF EXISTS localization_bundles`);
    await queryRunner.query(`DROP TABLE IF EXISTS translation_values`);
    await queryRunner.query(`DROP TABLE IF EXISTS translation_keys`);
    await queryRunner.query(`DROP TABLE IF EXISTS locales`);
  }
}
