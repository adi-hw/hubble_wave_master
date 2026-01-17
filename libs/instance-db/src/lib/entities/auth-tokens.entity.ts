import {
  Entity,
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
@Entity('password_history')
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
@Entity('password_reset_tokens')
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
@Entity('email_verification_tokens')
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
// REFRESH TOKEN ENTITY
// ============================================================

/**
 * RefreshToken entity - tracks JWT refresh tokens
 */
@Entity('refresh_tokens')
@Index(['userId'])
@Index(['token'], { unique: true })
@Index(['expiresAt'])
@Index(['isRevoked'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User this token belongs to */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Token value (hashed) */
  @Column({ type: 'varchar', length: 500, unique: true })
  token!: string;

  /** Token family (for rotation detection) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  family?: string | null;

  /** Device ID */
  @Column({ name: 'device_id', type: 'varchar', length: 255, nullable: true })
  deviceId?: string | null;

  /** IP address */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  /** User agent */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  /** Token expiry */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** Is revoked */
  @Column({ name: 'is_revoked', type: 'boolean', default: false })
  isRevoked!: boolean;

  /** When revoked */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  /** Revocation reason */
  @Column({ name: 'revoked_reason', type: 'varchar', length: 100, nullable: true })
  revokedReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// API KEY ENTITY
// ============================================================

/**
 * ApiKey entity - API keys for programmatic access
 */
@Entity('api_keys')
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
@Entity('user_invitations')
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
@Entity('mfa_methods')
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
@Entity('saml_auth_states')
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
@Entity('login_attempts')
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
