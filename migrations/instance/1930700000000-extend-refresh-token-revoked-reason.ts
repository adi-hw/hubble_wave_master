import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extend the `refresh_tokens_revoked_reason_check` CHECK constraint
 * vocabulary to include `'logout_all_devices'` per canon §29.5 + §29.6.1.
 *
 * Canon §29.6.1 distinguishes two logout endpoints — per-device
 * (`POST /auth/logout`, writes `revoked_reason = 'logout'`) and global
 * kill-switch (`POST /auth/logout-all-devices`, writes
 * `revoked_reason = 'logout_all_devices'`). The latter also bumps the
 * user's `security_stamp` so every in-flight access token across every
 * device fails verification on its next request.
 *
 * Keeping the two reasons separate in the operational record is
 * load-bearing: forensic queries that filter "show me every refresh
 * family the user explicitly revoked everywhere" must not surface the
 * far more common per-device sign-out. Existing tooling that filters on
 * `revoked_reason = 'logout'` continues to mean "per-device sign-out".
 */
export class ExtendRefreshTokenRevokedReason1930700000000
  implements MigrationInterface
{
  name = 'ExtendRefreshTokenRevokedReason1930700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens"
        DROP CONSTRAINT IF EXISTS "refresh_tokens_revoked_reason_check"`,
    );
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
        ADD CONSTRAINT "refresh_tokens_revoked_reason_check"
        CHECK ("revoked_reason" IS NULL OR "revoked_reason" IN
          ('reuse_detected', 'logout', 'password_change', 'admin_revoke',
           'family_expired', 'logout_all_devices'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens"
        DROP CONSTRAINT IF EXISTS "refresh_tokens_revoked_reason_check"`,
    );
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
        ADD CONSTRAINT "refresh_tokens_revoked_reason_check"
        CHECK ("revoked_reason" IS NULL OR "revoked_reason" IN
          ('reuse_detected', 'logout', 'password_change', 'admin_revoke',
           'family_expired'))
    `);
  }
}
