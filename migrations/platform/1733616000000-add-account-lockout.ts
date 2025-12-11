import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountLockout1733616000000 implements MigrationInterface {
  name = 'AddAccountLockout1733616000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add account lockout fields to user_accounts table
    await queryRunner.query(`
      ALTER TABLE user_accounts
        ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
    `);

    // Create index for efficient lockout queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_accounts_locked_until
        ON user_accounts(locked_until)
        WHERE locked_until IS NOT NULL;
    `);

    // Add comment for documentation
    await queryRunner.query(`
      COMMENT ON COLUMN user_accounts.failed_login_attempts IS 'Counter for failed login attempts, resets on successful login';
      COMMENT ON COLUMN user_accounts.locked_until IS 'Timestamp until which account is locked due to failed attempts';
      COMMENT ON COLUMN user_accounts.last_failed_login_at IS 'Timestamp of most recent failed login attempt';
      COMMENT ON COLUMN user_accounts.password_changed_at IS 'Timestamp of last password change for expiry checks';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_user_accounts_locked_until;
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE user_accounts
        DROP COLUMN IF EXISTS failed_login_attempts,
        DROP COLUMN IF EXISTS locked_until,
        DROP COLUMN IF EXISTS last_failed_login_at,
        DROP COLUMN IF EXISTS password_changed_at;
    `);
  }
}
