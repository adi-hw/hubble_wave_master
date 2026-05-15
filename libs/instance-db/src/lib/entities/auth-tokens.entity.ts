import {
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

// ============================================================
// PASSWORD HISTORY ENTITY
// ============================================================

/**
 * PasswordHistory entity - tracks password history for policy enforcement
 */
@Entity({ name: 'password_history', schema: 'identity' })
@Index(['userId'])
export class PasswordHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User this password belongs to */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Password hash */
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// PASSWORD RESET TOKEN ENTITY
// ============================================================

/**
 * PasswordResetToken entity - tracks password reset requests
 */
@Entity({ name: 'password_reset_tokens', schema: 'identity' })
@Index(['userId'])
@Index(['token'], { unique: true })
@Index(['expiresAt'])
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User requesting reset */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Reset token */
  @Column({ type: 'varchar', length: 255, unique: true })
  token!: string;

  /** Token expiry */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** When token was used */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// EMAIL VERIFICATION TOKEN ENTITY
// ============================================================

/**
 * EmailVerificationToken entity - tracks email verification requests
 */
@Entity({ name: 'email_verification_tokens', schema: 'identity' })
@Index(['userId'])
@Index(['token'], { unique: true })
@Index(['expiresAt'])
export class EmailVerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User to verify */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Email to verify */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /** Verification token */
  @Column({ type: 'varchar', length: 255, unique: true })
  token!: string;

  /** Token expiry */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** When verified */
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// REFRESH TOKEN ENTITY (canon §29.5)
// ============================================================

/**
 * Allowed reasons a refresh token row may carry in `revokedReason`. Mirrors
 * the CHECK constraint on the migration so application code and the database
 * agree on the closed vocabulary.
 */
export type RefreshTokenRevokedReason =
  | 'reuse_detected'
  | 'logout'
  | 'password_change'
  | 'admin_revoke'
  | 'family_expired'
  | 'logout_all_devices';

/**
 * RefreshToken entity — canon §29.5 single-use rotation with family chains.
 *
 * Primary key is the SHA-256 hash of the opaque refresh-token string —
 * plaintext never lands in the operational row. Every token belongs to a
 * `family_id`; rotation issues a new row with the same `family_id`, links
 * the predecessor via `parent_token_id`, and marks the predecessor with
 * `last_used_at` + `replaced_by_token_id`.
 *
 * Reuse detection (canon §29.5 rule 2): if a token presents with
 * `last_used_at IS NOT NULL`, the entire family is revoked with
 * `revoked_reason = 'reuse_detected'` and an `AccessAuditPort.logSecurityEvent`
 * high-severity event is emitted. The client receives a generic 401.
 *
 * Plaintext IP / User-Agent are NOT stored on the operational row — only
 * SHA-256 hashes. Plaintext values are captured in the security audit
 * event payload on reuse cases, where retention + access controls differ
 * from the operational table.
 *
 * `device_label` is a user-facing display string ("Chrome on Mac",
 * "iPhone 14 Pro"). Defaults to a UA-parsed string if the client omits one.
 *
 * `instance_id` is NULL in single-tenant mode per canon §5 SOFTEN.
 */
@Entity({ name: 'refresh_tokens', schema: 'identity' })
@Index('idx_refresh_tokens_family_id', ['familyId'])
@Index('idx_refresh_tokens_user_session', ['userId', 'sessionId'])
export class RefreshToken {
  /** SHA-256 hash of the opaque refresh token. Plaintext never persisted. */
  @PrimaryColumn({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  /** Family chain id — rotation produces a new row with the same family_id. */
  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  /**
   * FK to the predecessor token's `token_hash`. NULL for the family root.
   * Migration uses `ON DELETE SET NULL` so eviction of an ancestor does not
   * cascade-destroy descendants — they must remain reuse-detectable.
   */
  @Column({ name: 'parent_token_id', type: 'text', nullable: true })
  parentTokenId?: string | null;

  /** User this token authenticates. ON DELETE CASCADE via FK in migration. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Instance scope per canon §5; NULL in single-tenant mode. */
  @Column({ name: 'instance_id', type: 'uuid', nullable: true })
  instanceId?: string | null;

  /**
   * Logical session id. Shared across all rotations in a family so that
   * `JwtRevocationPort.revokeSession()` can kill both access tokens (in
   * Redis) and refresh tokens (this table) on logout / reuse / etc.
   */
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  /** User-facing display label, e.g. "Chrome on Mac". */
  @Column({ name: 'device_label', type: 'text', nullable: true })
  deviceLabel?: string | null;

  /** SHA-256 hash of the User-Agent at issue time. */
  @Column({ name: 'user_agent_hash', type: 'text', nullable: true })
  userAgentHash?: string | null;

  /** SHA-256 hash of the IP address at issue time. */
  @Column({ name: 'ip_address_hash', type: 'text', nullable: true })
  ipAddressHash?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /**
   * Anchored at the family root's `created_at + TTL`. Successors do NOT
   * extend the family's lifetime — they inherit the root's `expires_at`
   * so the family is bounded by canon §29.5 rule 3 (family expiry).
   */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /**
   * Set on first rotation. NULL means "never used"; a non-NULL value on a
   * token that presents again is the reuse-detection trigger per
   * canon §29.5 rule 2.
   */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  /**
   * FK to the successor token's `token_hash`. Same `ON DELETE SET NULL`
   * posture as `parent_token_id` — descendants survive ancestor eviction.
   */
  @Column({ name: 'replaced_by_token_id', type: 'text', nullable: true })
  replacedByTokenId?: string | null;

  /**
   * Constrained by the migration CHECK to one of: 'reuse_detected',
   * 'logout', 'password_change', 'admin_revoke', 'family_expired',
   * 'logout_all_devices'.
   *
   * `logout` is the per-device sign-out (canon §29.6.1); the global
   * kill-switch invoked via `POST /auth/logout-all-devices` writes
   * `logout_all_devices` so the operational record distinguishes the
   * two surfaces. Pair with the user's `security_stamp` bump (§29.6)
   * to invalidate all in-flight access tokens on the global path.
   */
  @Column({ name: 'revoked_reason', type: 'text', nullable: true })
  revokedReason?: RefreshTokenRevokedReason | null;
}

// ============================================================
// API KEY ENTITY
// ============================================================

/**
 * ApiKey entity - API keys for programmatic access
 */
@Entity({ name: 'api_keys', schema: 'integrations' })
@Index(['userId'])
@Index(['keyHash'], { unique: true })
@Index(['isActive'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User this key belongs to */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Key name/description */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Hashed key value (actual key shown only once at creation) */
  @Column({ name: 'key_hash', type: 'varchar', length: 255, unique: true })
  keyHash!: string;

  /** Key prefix for identification (e.g., "hw_live_abc123") */
  @Column({ name: 'key_prefix', type: 'varchar', length: 20 })
  keyPrefix!: string;

  /** Permissions/scopes for this key */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  scopes!: string[];

  /** IP whitelist (null = allow all) */
  @Column({ name: 'ip_whitelist', type: 'jsonb', nullable: true })
  ipWhitelist?: string[] | null;

  /** Expiry date (null = no expiry) */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  /** Last used timestamp */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

  /** Last used IP */
  @Column({ name: 'last_used_ip', type: 'varchar', length: 45, nullable: true })
  lastUsedIp?: string | null;

  /** Is active */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// USER INVITATION ENTITY
// ============================================================

/**
 * UserInvitation entity - tracks pending user invitations
 */
@Entity({ name: 'user_invitations', schema: 'identity' })
@Index(['email'])
@Index(['token'], { unique: true })
@Index(['status'])
@Index(['expiresAt'])
export class UserInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Invited email */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /** Invitation token */
  @Column({ type: 'varchar', length: 255, unique: true })
  token!: string;

  /** Status */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: 'pending' | 'accepted' | 'expired' | 'cancelled';

  /** Roles to assign on acceptance */
  @Column({ name: 'role_ids', type: 'jsonb', default: () => `'[]'` })
  roleIds!: string[];

  /** Groups to assign on acceptance */
  @Column({ name: 'group_ids', type: 'jsonb', default: () => `'[]'` })
  groupIds!: string[];

  /** Invitation message */
  @Column({ type: 'text', nullable: true })
  message?: string | null;

  /** Token expiry */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** When accepted */
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;

  /** Created user (after acceptance) */
  @Column({ name: 'created_user_id', type: 'uuid', nullable: true })
  createdUserId?: string | null;

  /** Invited by */
  @Column({ name: 'invited_by', type: 'uuid' })
  invitedBy!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'invited_by' })
  invitedByUser?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// MFA METHOD ENTITY
// ============================================================

/**
 * MfaMethod entity - tracks user MFA methods
 */
@Entity({ name: 'mfa_methods', schema: 'identity' })
@Index(['userId'])
export class MfaMethod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User this method belongs to */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Method type (e.g., TOTP) */
  @Column({ type: 'varchar', length: 50 })
  type!: string;

  /** Encrypted secret */
  @Column({ type: 'text', nullable: true })
  secret?: string;

  /** Recovery codes (encrypted or hashed) */
  @Column({ name: 'recovery_codes', type: 'text', nullable: true })
  recoveryCodes?: string;

  /** Is enabled */
  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  /** Is verified */
  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  /** Last used timestamp */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// SAML AUTH STATE ENTITY
// ============================================================

/**
 * SAMLAuthState entity - persists SAML relay state for SSO callbacks
 *
 * Stored in database instead of memory to support multi-instance deployments
 * and survive service restarts.
 */
@Entity({ name: 'saml_auth_states', schema: 'identity' })
@Index(['relayState'], { unique: true })
@Index(['expiresAt'])
export class SAMLAuthState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** SSO Provider ID */
  @Column({ name: 'provider_id', type: 'uuid' })
  providerId!: string;

  /** Relay state token (for CSRF protection) */
  @Column({ name: 'relay_state', type: 'varchar', length: 255, unique: true })
  relayState!: string;

  /** Redirect URI after authentication */
  @Column({ name: 'redirect_uri', type: 'varchar', length: 2048 })
  redirectUri!: string;

  /** State expiry (typically 10 minutes) */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** When state was consumed */
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// LOGIN ATTEMPT ENTITY
// ============================================================

/**
 * Login attempt result
 */
export type LoginAttemptResult = 'success' | 'invalid_credentials' | 'account_locked' | 'account_disabled' | 'mfa_required' | 'mfa_failed' | 'rate_limited';

/**
 * LoginAttempt entity - tracks individual login attempts for audit and rate limiting
 *
 * Provides per-attempt audit trail with IP/device analysis capability
 * instead of just a counter on the user record.
 */
@Entity({ name: 'login_attempts', schema: 'identity' })
@Index(['userId'])
@Index(['ipAddress'])
@Index(['email'])
@Index(['createdAt'])
@Index(['result'])
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User ID (null if user not found) */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  /** Email used in attempt */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /** IP address */
  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  ipAddress!: string;

  /** User agent */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  /** Device fingerprint (if available) */
  @Column({ name: 'device_fingerprint', type: 'varchar', length: 255, nullable: true })
  deviceFingerprint?: string | null;

  /** Geographic location (derived from IP) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string | null;

  /** Country code (derived from IP) */
  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode?: string | null;

  /** Attempt result */
  @Column({ type: 'varchar', length: 30 })
  result!: LoginAttemptResult;

  /** Failure reason (for failed attempts) */
  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;

  /** Authentication method used */
  @Column({ name: 'auth_method', type: 'varchar', length: 30, default: 'password' })
  authMethod!: string;

  /** SSO provider (if SSO login) */
  @Column({ name: 'sso_provider', type: 'varchar', length: 100, nullable: true })
  ssoProvider?: string | null;

  /** Request ID for correlation */
  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  requestId?: string | null;

  /** Risk score (0-100, for anomaly detection) */
  @Column({ name: 'risk_score', type: 'integer', nullable: true })
  riskScore?: number | null;

  /** Risk factors identified */
  @Column({ name: 'risk_factors', type: 'jsonb', nullable: true })
  riskFactors?: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
