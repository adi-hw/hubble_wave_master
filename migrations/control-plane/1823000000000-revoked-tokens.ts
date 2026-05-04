import { MigrationInterface, QueryRunner } from 'typeorm';

export class RevokedTokens1823000000000 implements MigrationInterface {
  name = 'RevokedTokens1823000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        jti varchar(64) NOT NULL,
        user_id uuid NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NOT NULL DEFAULT now(),
        ip_address varchar(45),
        user_agent text
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_revoked_tokens_expires_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_revoked_tokens_jti;`);
    await queryRunner.query(`DROP TABLE IF EXISTS revoked_tokens;`);
  }
}
