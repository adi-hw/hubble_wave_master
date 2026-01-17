import { MigrationInterface, QueryRunner } from 'typeorm';

export class TranslationRequests1827000000000 implements MigrationInterface {
  name = 'TranslationRequests1827000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS translation_requests (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        locale_id uuid REFERENCES locales(id) ON DELETE CASCADE,
        translation_key_id uuid REFERENCES translation_keys(id) ON DELETE CASCADE,
        status varchar(20) NOT NULL DEFAULT 'pending',
        requested_by uuid,
        reviewer_ids jsonb NOT NULL DEFAULT '[]',
        due_at timestamptz,
        workflow_instance_id uuid,
        metadata jsonb NOT NULL DEFAULT '{}',
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_translation_requests_status ON translation_requests(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_translation_requests_locale ON translation_requests(locale_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_translation_requests_key ON translation_requests(translation_key_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_translation_requests_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_translation_requests_locale`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_translation_requests_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS translation_requests`);
  }
}
