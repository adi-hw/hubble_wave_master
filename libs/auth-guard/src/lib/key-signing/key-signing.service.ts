/**
 * `KeySigningService` — the canonical interface for ES256 JWT signing per
 * canon §29.1 and §29.9.
 *
 * One interface, two implementations:
 *   - `AwsKmsEs256KeySigningService` — REQUIRED in production. Private key
 *     custody: AWS KMS HSM. The private key never leaves the HSM; every
 *     `sign()` is a `KmsClient.Sign` call (direct KMS signing per token,
 *     no data-key envelope shortcut).
 *   - `LocalEs256KeySigningService` — non-production only. Private key
 *     custody: `.dev/keys/{kid}.pem` on disk (mode 0600).
 *
 * Both implementations produce ES256 signatures over the same JWT format,
 * use the same `kid` namespace (§29.2), expose the same JWKS surface, and
 * follow the same `pending → active → retiring → retired` lifecycle.
 * Application code calls `KeySigningService` and is environment-agnostic;
 * the only difference between environments is the custodian of the private
 * key.
 *
 * HS256 is forbidden everywhere — see canon §29.9. No symmetric-key dev
 * path. The codebase must never carry HS256 signing code "for dev".
 *
 * This is the foundation for canon §29 PR-A. PR-B (token claims +
 * `security_stamp`) and PR-C (refresh family schema) build on this
 * interface — the auth service migrates to `sign()` in PR-B, and the
 * legacy HS256 path is removed in the same wave.
 */
export interface KeySigningService {
  /**
   * Sign a JWT payload with the currently-active key. Returns the compact
   * JWS string (3 base64url segments separated by `.`).
   *
   * The signing key is selected automatically — callers do not specify
   * `kid`. The implementation looks up the lone `active` key (canon §29.2
   * partial unique index guarantees at most one) and embeds its `kid` in
   * the JWT header. If no `active` key exists, `sign()` throws — this is
   * an operational invariant violation, not a recoverable error.
   *
   * Header `alg` is always `ES256`. Header `typ` defaults to `'JWT'`; the
   * `header.typ` override exists for non-JWT JOSE use cases (none today).
   */
  sign(
    payload: Record<string, unknown>,
    header?: { typ?: string },
  ): Promise<string>;

  /**
   * Get the public JWK for a given `kid`. Returns a JWK ready for inclusion
   * in `/.well-known/jwks.json`: `{ kty: 'EC', crv: 'P-256', x, y, kid,
   * use: 'sig', alg: 'ES256' }`.
   *
   * Throws if the `kid` is unknown OR is in a non-publishable state
   * (`pending`, `retired`, `compromised`). Only `active` and `retiring`
   * keys are JWKS-eligible per canon §29.2.
   */
  getPublicJwk(kid: string): Promise<PublicJwk>;

  /**
   * Mint a new key, activate it, demote the previous active key to
   * `retiring`. Atomic with respect to the `active` state — the partial
   * unique index in `key_metadata` enforces "exactly one active per
   * instance scope" so the transition is serialized at the DB level.
   *
   * Returns the newly-activated key's metadata.
   */
  rotateKey(): Promise<KeyMetadataView>;

  /**
   * Get the currently-active key. Used by JWT issuers to discover which
   * `kid` will be embedded in the next token. Most callers should prefer
   * `sign()` directly — this exists for callers (e.g. observability) that
   * need to inspect the key without producing a signature.
   *
   * Throws if no active key exists.
   */
  getActiveKey(): Promise<KeyMetadataView>;

  /**
   * Get all keys eligible for JWKS publication (`active` + `retiring`).
   * Used by the `/.well-known/jwks.json` endpoint to enumerate publishable
   * keys; the endpoint then calls `getPublicJwk(kid)` for each.
   */
  getVerifyingKeys(): Promise<KeyMetadataView[]>;
}

/** Injection token for the canonical signing service. */
export const KEY_SIGNING_SERVICE = 'KEY_SIGNING_SERVICE';

/** Public JWK structure emitted by `getPublicJwk()`. */
export interface PublicJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  kid: string;
  use: 'sig';
  alg: 'ES256';
}

/**
 * Read-only projection of a `key_metadata` row. Mirrors the entity but is
 * defined here (in `libs/auth-guard`) to avoid forcing the auth-guard lib
 * to depend on `@hubblewave/instance-db` for the type.
 */
export interface KeyMetadataView {
  kid: string;
  provider: 'aws-kms' | 'local-es256';
  kmsAlias?: string | null;
  kmsArn?: string | null;
  algorithm: 'ES256';
  state: 'pending' | 'active' | 'retiring' | 'retired' | 'compromised';
  publicKeyPem: string;
  instanceId?: string | null;
  createdAt: Date;
  activatedAt?: Date | null;
  retiringAt?: Date | null;
  retiredAt?: Date | null;
  compromisedAt?: Date | null;
}
