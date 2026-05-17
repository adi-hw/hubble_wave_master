import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Control-plane `key_metadata` table — JWT signing key registry per canon §29.2.
 *
 * Mirrors the instance-plane schema (see `migrations/instance/1000000000000-
 * baseline.ts` for the canonical structure). One row per ES256 signing key
 * the control-plane has ever minted. `kid` is the stable public identifier
 * embedded in every JWT header and exposed via `/.well-known/jwks.json`.
 *
 * The control-plane runs single-tenant by design (canon §18) and stores
 * everything in the `public` schema — there is no `identity` schema on the
 * control-plane database. `instance_id` exists on the table for schema
 * parity with the instance-plane (one entity class shape, two DBs) but is
 * always NULL in control-plane rows.
 *
 * The partial unique index `idx_key_metadata_one_active` enforces "exactly
 * one active key" — the same lifecycle invariant the instance plane carries.
 * COALESCE on `instance_id` is included so the index expression matches the
 * instance-plane index byte-for-byte; on the control plane the COALESCE
 * always reduces to the literal 'platform' since `instance_id` is NULL.
 */
export class AddKeyMetadata1000000000010 implements MigrationInterface {
  name = 'AddKeyMetadata1000000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE public.key_metadata (
    kid text NOT NULL,
    provider text NOT NULL,
    kms_alias text,
    kms_arn text,
    algorithm text DEFAULT 'ES256'::text NOT NULL,
    state text NOT NULL,
    public_key_pem text NOT NULL,
    instance_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_at timestamp with time zone,
    retiring_at timestamp with time zone,
    retired_at timestamp with time zone,
    compromised_at timestamp with time zone,
    CONSTRAINT key_metadata_algorithm_check CHECK ((algorithm = 'ES256'::text)),
    CONSTRAINT key_metadata_provider_check CHECK ((provider = ANY (ARRAY['aws-kms'::text, 'local-es256'::text]))),
    CONSTRAINT key_metadata_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'active'::text, 'retiring'::text, 'retired'::text, 'compromised'::text])))
);`);

    await queryRunner.query(`ALTER TABLE ONLY public.key_metadata
    ADD CONSTRAINT key_metadata_pkey PRIMARY KEY (kid);`);

    await queryRunner.query(`CREATE UNIQUE INDEX idx_key_metadata_one_active ON public.key_metadata USING btree (COALESCE((instance_id)::text, 'platform'::text)) WHERE (state = 'active'::text);`);
    await queryRunner.query(`CREATE INDEX idx_key_metadata_state ON public.key_metadata USING btree (state) WHERE (state = ANY (ARRAY['active'::text, 'retiring'::text]));`);
  }

  public async down(): Promise<void> {
    throw new Error('Forward-only migration; key_metadata cannot be safely dropped while signed tokens remain in circulation');
  }
}
