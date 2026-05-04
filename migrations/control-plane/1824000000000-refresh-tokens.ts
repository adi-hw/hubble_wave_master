import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokens1824000000000 implements MigrationInterface {
  name = 'RefreshTokens1824000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        token_hash varchar(128) NOT NULL,
        family uuid NOT NULL,
        user_id uuid NOT NULL,
        issued_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        revoke_reason varchar(64),
        replaced_by uuid,
        ip_address varchar(45),
        user_agent text
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_expires_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_family;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_token_hash;`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens;`);
  }
}
