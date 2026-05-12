import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `key_metadata` — JWT signing key registry per canon §29.2.
 *
 * Stores the lifecycle metadata for every ES256 signing key the platform
 * has ever minted. `kid` is the only public identifier (in JWT headers and
 * JWKS); KMS-specific identifiers (`kms_alias`, `kms_arn`) live alongside
 * but are never exposed in tokens.
 *
 * State machine: `pending` → `active` → `retiring` → `retired` (terminal),
 * or `compromised` (terminal). JWKS exposes only `active` and `retiring`
 * keys. Exactly one key may be in `active` state per instance scope at a
 * time — enforced by a partial unique index keyed on
 * COALESCE(instance_id::text, 'platform') so single-tenant deployments
 * (where `instance_id IS NULL` per canon §5) still get the constraint.
 *
 * `public_key_pem` is the SPKI-encoded public key cached at key-creation
 * time for fast JWKS reads — verification keys never have to round-trip
 * to AWS KMS.
 *
 * This migration is foundational for canon §29 PR-A (KeySigningService +
 * JWKS publication). Subsequent PRs (B token claims + security_stamp,
 * C refresh family) build on this without re-touching the schema.
 */
export class AddKeyMetadata1930400000000 implements MigrationInterface {
  name = 'AddKeyMetadata1930400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "key_metadata" (
        "kid"              text PRIMARY KEY,
        "provider"         text NOT NULL,
        "kms_alias"        text NULL,
        "kms_arn"          text NULL,
        "algorithm"        text NOT NULL DEFAULT 'ES256',
        "state"            text NOT NULL,
        "public_key_pem"   text NOT NULL,
        "instance_id"      uuid NULL,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "activated_at"     timestamptz NULL,
        "retiring_at"      timestamptz NULL,
        "retired_at"       timestamptz NULL,
        "compromised_at"   timestamptz NULL,
        CONSTRAINT "key_metadata_provider_check"
          CHECK ("provider" IN ('aws-kms', 'local-es256')),
        CONSTRAINT "key_metadata_state_check"
          CHECK ("state" IN ('pending', 'active', 'retiring', 'retired', 'compromised')),
        CONSTRAINT "key_metadata_algorithm_check"
          CHECK ("algorithm" = 'ES256')
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_key_metadata_state"
        ON "key_metadata" ("state")
        WHERE "state" IN ('active', 'retiring')
    `);

    // Exactly one 'active' key per instance scope. COALESCE preserves the
    // constraint for single-tenant (instance_id IS NULL) deployments.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_key_metadata_one_active"
        ON "key_metadata" (COALESCE("instance_id"::text, 'platform'))
        WHERE "state" = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_key_metadata_one_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_key_metadata_state"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "key_metadata"`);
  }
}
