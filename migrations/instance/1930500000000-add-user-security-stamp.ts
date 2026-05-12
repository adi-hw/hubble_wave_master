import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `users.security_stamp` — per-user cross-cutting kill-switch per canon §29.6.
 *
 * Every JWT carries the user's `security_stamp` value at issuance time in the
 * `token_version` claim. `JwtAuthGuard` and `JwtStrategy` compare it to the
 * current DB value on every authenticated request; mismatch rejects the
 * token with `Token version stale`.
 *
 * Bumping the stamp invalidates ALL tokens for the user globally — independent
 * of `JwtRevocationPort` (per-session) and refresh-token family revocation
 * (per-family). Triggers per canon §29.6:
 *   - Password change → bump
 *   - MFA disable → bump
 *   - Admin force-logout → bump
 *   - Account suspend → bump
 *
 * Existing rows receive a fresh random uuid via the DEFAULT clause, which
 * intentionally invalidates every in-flight access token on rollout. This is
 * acceptable per canon §1 (greenfield discipline — no pre-pilot legacy compat).
 * Operators must communicate the forced re-login before the migration runs.
 *
 * The supplementary index speeds up the verify-time lookup (we already have
 * the user_id from the JWT sub; this lets PG hit a covering index for the
 * mismatch comparison instead of fetching the full row).
 */
export class AddUserSecurityStamp1930500000000 implements MigrationInterface {
  name = 'AddUserSecurityStamp1930500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // pgcrypto provides gen_random_uuid(). The InitialSchema migration
    // typically loads it, but defensive CREATE EXTENSION IF NOT EXISTS
    // makes this migration idempotent on bare databases.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "security_stamp" uuid NOT NULL DEFAULT gen_random_uuid()
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_security_stamp"
        ON "users" ("id", "security_stamp")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_security_stamp"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "security_stamp"`,
    );
  }
}
