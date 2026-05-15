import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ServiceTokenTables1941000000000
 *
 * ADR D1c — service-to-service authentication.
 *
 * Creates two tables in the `identity` schema:
 *
 *   - `service_accounts`: workload identities that exchange OAuth
 *     client credentials for short-lived service tokens.
 *   - `service_token_signing_keys`: metadata + audit trail for the
 *     ES256 signing keys (canon §29.9: RS256 is forbidden). Private key material lives in the pluggable
 *     `KeyStorageBackend` (AWS Secrets Manager in production,
 *     gitignored local file in development); the public-key PEM is
 *     duplicated here so the JWKS endpoint and forensic tooling do
 *     not need to read the backend on the hot path.
 *
 * Idempotent: every CREATE uses `IF NOT EXISTS` so re-running the
 * migration in environments where a partial bootstrap created the
 * tables (the local-dev seeder calls `synchronize:false`, so the
 * canonical path is migrations-only) is safe.
 */
export class ServiceTokenTables1941000000000 implements MigrationInterface {
  name = 'ServiceTokenTables1941000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Schema already created by IdentitySchema1940500000000; the
    // CREATE SCHEMA IF NOT EXISTS here is defence-in-depth for clean
    // databases that haven't run the parent migration first.
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "identity"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "identity"."service_accounts" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "name" VARCHAR(80) NOT NULL,
        "client_secret_hash" VARCHAR(255) NOT NULL,
        "allowed_scopes" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "description" TEXT,
        "owner_team" VARCHAR(80),
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "secret_rotated_at" TIMESTAMPTZ,
        "last_used_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by" UUID,
        "updated_by" UUID,
        CONSTRAINT "PK_service_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_service_accounts_status" CHECK ("status" IN ('active','suspended','revoked'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_service_accounts_name"
        ON "identity"."service_accounts" ("name")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_accounts_status"
        ON "identity"."service_accounts" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "identity"."service_token_signing_keys" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "key_id" VARCHAR(80) NOT NULL,
        "algorithm" VARCHAR(20) NOT NULL DEFAULT 'ES256',
        "public_key_pem" TEXT NOT NULL,
        "backend_ref" VARCHAR(255),
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "retired_at" TIMESTAMPTZ,
        "archived_at" TIMESTAMPTZ,
        "created_by" UUID,
        CONSTRAINT "PK_service_token_signing_keys" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_service_token_signing_keys_status"
          CHECK ("status" IN ('active','retired','archived'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_service_token_signing_keys_key_id"
        ON "identity"."service_token_signing_keys" ("key_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_token_signing_keys_status"
        ON "identity"."service_token_signing_keys" ("status")
    `);

    // ADR D1c §F encourages exactly one `active` key at a time. The
    // partial unique index enforces it without preventing multiple
    // retired/archived rows from coexisting during rotation overlap.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_service_token_signing_keys_one_active"
        ON "identity"."service_token_signing_keys" ("status")
        WHERE "status" = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "identity"."UQ_service_token_signing_keys_one_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "identity"."IDX_service_token_signing_keys_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "identity"."UQ_service_token_signing_keys_key_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "identity"."service_token_signing_keys"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "identity"."IDX_service_accounts_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "identity"."UQ_service_accounts_name"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "identity"."service_accounts"`);
  }
}
