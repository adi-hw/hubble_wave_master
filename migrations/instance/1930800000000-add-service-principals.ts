import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `service_principals` — registry of services authorized to mint
 * HubbleWave service-to-service JWTs per canon §29.7.
 *
 * One row per registered service identity (e.g. `svc-worker`,
 * `svc-api`). Each row carries:
 *   - `service_id`           stable identifier embedded in `sub`
 *                            claim as `service:<service_id>` per
 *                            canon §29.3 + §29.7.
 *   - `allowed_audiences`    services this principal is allowed to
 *                            call. The mint endpoint refuses any
 *                            `aud` not in this list.
 *   - `allowed_scopes`       `<collection>:<action>` permissions
 *                            granted to the principal. Embedded
 *                            verbatim in every minted service token.
 *   - `k8s_service_account`  Kubernetes SA the principal binds to
 *                            in production (canon §29.7 bootstrap).
 *                            Optional because dev environments
 *                            authenticate via `JWT_BOOTSTRAP_SECRET`
 *                            and identify the principal by header.
 *   - `active`               toggleable kill-switch; inactive rows
 *                            cannot mint a token even when the
 *                            bootstrap mechanism otherwise succeeds.
 *
 * Closes audit finding F022 — replaces the shared "internal secret"
 * pattern with explicit, audience-bound, scope-limited service
 * identities backed by either K8s TokenReview attestation
 * (production) or `JWT_BOOTSTRAP_SECRET` header (dev only).
 *
 * The partial index over `k8s_service_account` only covers ACTIVE
 * rows that actually bind a K8s SA — the TokenReview lookup
 * (`SELECT ... WHERE k8s_service_account = $1 AND active = true`)
 * hits the partial index for an index-only scan.
 */
export class AddServicePrincipals1930800000000 implements MigrationInterface {
  name = 'AddServicePrincipals1930800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_principals" (
        "service_id"          text PRIMARY KEY,
        "display_name"        text NOT NULL,
        "allowed_audiences"   text[] NOT NULL,
        "allowed_scopes"      text[] NOT NULL,
        "k8s_service_account" text NULL,
        "active"              boolean NOT NULL DEFAULT true,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_service_principals_k8s_sa"
        ON "service_principals" ("k8s_service_account")
        WHERE "active" = true AND "k8s_service_account" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_service_principals_k8s_sa"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "service_principals"`);
  }
}
