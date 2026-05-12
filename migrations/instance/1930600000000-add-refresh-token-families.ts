import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `refresh_tokens` — canon §29.5 (closes F001) refresh-token family
 * schema for single-use rotation with reuse detection.
 *
 * Greenfield rebuild — the prior pre-canon `refresh_tokens` table is
 * dropped and recreated to match the §29.5 contract exactly. Per canon
 * §1, this is a pre-pilot platform; there is no production data to
 * preserve. Any in-flight session at upgrade time forces a re-login,
 * which is the correct posture — the only way to be sure no stale
 * refresh token from the old single-row-rotation model lingers in a
 * client cookie is to drop them all.
 *
 * Schema highlights:
 *   - PK is `token_hash` (SHA-256 of opaque refresh token). Plaintext
 *     never lands in the operational row.
 *   - `family_id` chains rotations; reuse detection cascades the
 *     revocation across the whole family.
 *   - `parent_token_id` + `replaced_by_token_id` are self-FKs with
 *     `ON DELETE SET NULL` so eviction of an old token does not
 *     cascade-destroy its descendants — descendants must remain
 *     reuse-detectable via `family_id`.
 *   - `instance_id` is NULL in single-tenant mode (canon §5 SOFTEN).
 *   - `user_agent_hash` + `ip_address_hash` only. Plaintext IP/UA live
 *     in the AccessAuditPort security event payload on reuse — never
 *     in the operational table.
 *   - `device_label` is user-facing display string; defaults from the
 *     UA parser if the client omits one.
 *
 * Index posture:
 *   - `(family_id)` — primary read pattern for revokeFamily().
 *   - `(family_id) WHERE revoked_at IS NULL` — fast scan over active
 *     family members during reuse-detection cascade revocation.
 *   - `(user_id, session_id)` — supports session listing + logout.
 *   - `(expires_at) WHERE revoked_at IS NULL` — supports the cleanup
 *     sweep that revokes expired families. Partial so the index stays
 *     small.
 */
export class AddRefreshTokenFamilies1930600000000
  implements MigrationInterface
{
  name = 'AddRefreshTokenFamilies1930600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop pre-canon table. The old schema's columns (`id`, `token`,
    // `family`, `is_revoked`, `revoked_reason`, etc.) do not match the
    // §29.5 contract; a greenfield rebuild is cleaner than an
    // ALTER-table dance. Per canon §1 no production data exists yet.
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "token_hash"           text PRIMARY KEY,
        "family_id"            uuid NOT NULL,
        "parent_token_id"      text NULL REFERENCES "refresh_tokens"("token_hash") ON DELETE SET NULL,
        "user_id"              uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "instance_id"          uuid NULL,
        "session_id"           uuid NOT NULL,
        "device_label"         text NULL,
        "user_agent_hash"      text NULL,
        "ip_address_hash"      text NULL,
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "expires_at"           timestamptz NOT NULL,
        "last_used_at"         timestamptz NULL,
        "revoked_at"           timestamptz NULL,
        "replaced_by_token_id" text NULL REFERENCES "refresh_tokens"("token_hash") ON DELETE SET NULL,
        "revoked_reason"       text NULL,
        CONSTRAINT "refresh_tokens_revoked_reason_check"
          CHECK ("revoked_reason" IS NULL OR "revoked_reason" IN
            ('reuse_detected', 'logout', 'password_change', 'admin_revoke', 'family_expired'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_family_id"
        ON "refresh_tokens" ("family_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_family_not_revoked"
        ON "refresh_tokens" ("family_id")
        WHERE "revoked_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_user_session"
        ON "refresh_tokens" ("user_id", "session_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_expires_at"
        ON "refresh_tokens" ("expires_at")
        WHERE "revoked_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_refresh_tokens_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_refresh_tokens_user_session"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_refresh_tokens_family_not_revoked"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_refresh_tokens_family_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
