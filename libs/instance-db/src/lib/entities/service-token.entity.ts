import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Service-to-service authentication entities (ADR D1c).
 *
 * `ServiceAccount` rows represent the workload identities that
 * exchange OAuth client credentials for service tokens.
 * `ServiceTokenSigningKey` rows are the metadata + audit trail for
 * the signing keys; the actual private material lives in the
 * pluggable `KeyStorageBackend` (AWS Secrets Manager in production,
 * gitignored local file in dev).
 *
 * Both tables are owned by svc-identity and live in the `identity`
 * Postgres schema (Plan Fix 24 / W9 Phase C).
 */

/**
 * Lifecycle status for a service account.
 */
export type ServiceAccountStatus = 'active' | 'suspended' | 'revoked';

/**
 * Lifecycle status for a signing key. Mirrors the values used by the
 * `KeyStorageBackend` interface in `@hubblewave/service-auth`.
 *
 * - `active`: currently signing new tokens.
 * - `retired`: previous active key still in JWKS for the 24h overlap
 *   window so tokens issued before rotation continue to validate.
 * - `archived`: removed from JWKS; kept for audit/forensic use only.
 */
export type ServiceTokenSigningKeyStatus = 'active' | 'retired' | 'archived';

@Entity({ name: 'service_accounts', schema: 'identity' })
@Index(['name'], { unique: true })
@Index(['status'])
export class ServiceAccount {
  /**
   * Stable UUID. Doubles as the OAuth `client_id` returned in tokens
   * — operators don't need to memorize a separate ID.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Human-readable name; matches the deployed service identifier
   * (e.g., `svc-automation`). Becomes the `service-account:<name>`
   * subject claim on issued tokens.
   */
  @Column({ type: 'varchar', length: 80 })
  name!: string;

  /**
   * Argon2id hash of the OAuth client secret. The plain secret is
   * shown ONCE at creation/rotation and never persisted. Compared
   * during the OAuth client_credentials grant via constant-time
   * verification (argon2.verify).
   */
  @Column({ name: 'client_secret_hash', type: 'varchar', length: 255 })
  clientSecretHash!: string;

  /**
   * OAuth scopes this account is permitted to request. Tokens are
   * issued with the intersection of (allowed, requested) — see
   * `intersectRequestedScopes` in @hubblewave/service-auth.
   */
  @Column({ name: 'allowed_scopes', type: 'jsonb', default: () => "'[]'::jsonb" })
  allowedScopes!: string[];

  /**
   * Operator-facing description; surfaced in admin UIs and audit logs.
   */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * Optional metadata: which engineering team or upstream service
   * owns this account. Useful for incident response.
   */
  @Column({ name: 'owner_team', type: 'varchar', length: 80, nullable: true })
  ownerTeam!: string | null;

  /**
   * Lifecycle state. `revoked` accounts are kept for audit purposes
   * but cannot exchange credentials for tokens.
   */
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: ServiceAccountStatus;

  /**
   * Timestamp of the most recent successful client-secret rotation.
   * Surfaced in operator dashboards so quarterly rotation discipline
   * can be measured at a glance.
   */
  @Column({ name: 'secret_rotated_at', type: 'timestamptz', nullable: true })
  secretRotatedAt!: Date | null;

  /**
   * Best-effort timestamp of the last successful token issuance.
   * Updated on the OAuth grant path; lossy under high concurrency
   * but adequate for "is this account still in use?" queries.
   */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;
}

@Entity({ name: 'service_token_signing_keys', schema: 'identity' })
@Index(['keyId'], { unique: true })
@Index(['status'])
export class ServiceTokenSigningKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * The `kid` (Key ID) value embedded in JWT headers. Matches the
   * key id used in the `KeyStorageBackend` for the corresponding
   * private material.
   */
  @Column({ name: 'key_id', type: 'varchar', length: 80 })
  keyId!: string;

  /**
   * Signing algorithm. Always `ES256` per canon §29.9 — HS256 is
   * forbidden; ES256 (ECDSA P-256) is the single signing algorithm
   * for all HubbleWave tokens. Column kept stringly-typed so
   * future asymmetric algorithms can land without a schema change.
   */
  @Column({ type: 'varchar', length: 20, default: 'ES256' })
  algorithm!: string;

  /**
   * Public key, PEM-encoded SPKI. Stored here — in addition to the
   * pluggable backend — so the JWKS endpoint and forensic/audit
   * tooling can produce signature-verification material even if the
   * private-key backend is unreachable. Public key is not sensitive.
   */
  @Column({ name: 'public_key_pem', type: 'text' })
  publicKeyPem!: string;

  /**
   * Identifier for the backend that holds the private key material.
   * Examples: `aws-secrets-manager:hubblewave/acme/service-tokens/key-...`,
   * `local-file:/path/to/.local-secrets/service-token-keys.json`.
   * Free-form string for diagnostic use; never trusted as input.
   */
  @Column({ name: 'backend_ref', type: 'varchar', length: 255, nullable: true })
  backendRef!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: ServiceTokenSigningKeyStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt!: Date | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;
}
