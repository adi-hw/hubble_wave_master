import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

// ============================================================
// WEBAUTHN CREDENTIAL ENTITY
// ============================================================

/**
 * WebAuthnCredential entity - stores FIDO2/WebAuthn credentials (passkeys)
 */
@Entity('webauthn_credentials')
@Index(['userId'])
@Index(['credentialId'], { unique: true })
export class WebAuthnCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Credential ID (base64url encoded) */
  @Column({ name: 'credential_id', type: 'text', unique: true })
  credentialId!: string;

  /** Public key (COSE format, base64url encoded) */
  @Column({ name: 'public_key', type: 'text' })
  publicKey!: string;

  /** Sign count for replay attack detection */
  @Column({ name: 'sign_count', type: 'bigint', default: 0 })
  signCount!: number;

  /** Credential type (e.g., public-key) */
  @Column({ name: 'credential_type', type: 'varchar', length: 50, default: 'public-key' })
  credentialType!: string;

  /** Authenticator transports (usb, nfc, ble, internal, hybrid) */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  transports!: string[];

  /** User-friendly name for the credential */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** AAGUID of the authenticator */
  @Column({ type: 'varchar', length: 36, nullable: true })
  aaguid?: string | null;

  /** Whether this credential can be used for passwordless login */
  @Column({ name: 'is_discoverable', type: 'boolean', default: true })
  isDiscoverable!: boolean;

  /** Whether this is backed up (synced across devices) */
  @Column({ name: 'is_backed_up', type: 'boolean', default: false })
  isBackedUp!: boolean;

  /** Device info where credential was created */
  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo?: {
    platform?: string;
    browser?: string;
    os?: string;
  } | null;

  /** Last used timestamp */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

  /** Is active */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// WEBAUTHN CHALLENGE ENTITY
// ============================================================

/**
 * WebAuthnChallenge entity - stores temporary challenges for WebAuthn ceremonies
 */
@Entity('webauthn_challenges')
@Index(['challenge'], { unique: true })
@Index(['userId'])
@Index(['expiresAt'])
export class WebAuthnChallenge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Challenge value (base64url encoded) */
  @Column({ type: 'varchar', length: 255, unique: true })
  challenge!: string;

  /** User ID (null for registration of new users) */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Challenge type */
  @Column({ type: 'varchar', length: 20 })
  type!: 'registration' | 'authentication';

  /** Session data for verification */
  @Column({ name: 'session_data', type: 'jsonb', nullable: true })
  sessionData?: Record<string, unknown> | null;

  /** Challenge expiry */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// MAGIC LINK TOKEN ENTITY
// ============================================================

/**
 * MagicLinkToken entity - passwordless login via email
 */
@Entity('magic_link_tokens')
@Index(['token'], { unique: true })
@Index(['email'])
@Index(['expiresAt'])
export class MagicLinkToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Email address */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /** User ID (null if user doesn't exist yet) */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Token (hashed) */
  @Column({ type: 'varchar', length: 255, unique: true })
  token!: string;

  /** Token expiry (short-lived, typically 15 minutes) */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** When used */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  /** IP address of request */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  /** User agent of request */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  /** Redirect URL after login */
  @Column({ name: 'redirect_url', type: 'text', nullable: true })
  redirectUrl?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// TRUSTED DEVICE ENTITY
// ============================================================

export type DeviceTrustStatus = 'pending' | 'trusted' | 'untrusted' | 'revoked';

/**
 * TrustedDevice entity - device trust management
 */
@Entity('trusted_devices')
@Index(['userId'])
@Index(['deviceFingerprint'])
@Index(['status'])
export class TrustedDevice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Device fingerprint (hash of device characteristics) */
  @Column({ name: 'device_fingerprint', type: 'varchar', length: 255 })
  deviceFingerprint!: string;

  /** Device name (user-friendly) */
  @Column({ name: 'device_name', type: 'varchar', length: 255 })
  deviceName!: string;

  /** Device type */
  @Column({ name: 'device_type', type: 'varchar', length: 50 })
  deviceType!: 'desktop' | 'mobile' | 'tablet' | 'unknown';

  /** Browser info */
  @Column({ type: 'varchar', length: 100, nullable: true })
  browser?: string | null;

  /** Operating system */
  @Column({ type: 'varchar', length: 100, nullable: true })
  os?: string | null;

  /** Trust status */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: DeviceTrustStatus;

  /** Trust score (0-100) */
  @Column({ name: 'trust_score', type: 'int', default: 50 })
  trustScore!: number;

  /** Last known IP addresses */
  @Column({ name: 'known_ips', type: 'jsonb', default: () => `'[]'` })
  knownIps!: string[];

  /** Last known locations */
  @Column({ name: 'known_locations', type: 'jsonb', default: () => `'[]'` })
  knownLocations!: Array<{ city?: string; country?: string; lat?: number; lon?: number }>;

  /** Verification method used to trust */
  @Column({ name: 'verification_method', type: 'varchar', length: 50, nullable: true })
  verificationMethod?: 'email' | 'sms' | 'mfa' | 'admin' | null;

  /** Trusted until (null = indefinite) */
  @Column({ name: 'trusted_until', type: 'timestamptz', nullable: true })
  trustedUntil?: Date | null;

  /** First seen */
  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt!: Date;

  /** Last seen */
  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;

  /** Login count from this device */
  @Column({ name: 'login_count', type: 'int', default: 0 })
  loginCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// IMPERSONATION SESSION ENTITY
// ============================================================

/**
 * ImpersonationSession entity - tracks admin impersonation of users
 */
@Entity('impersonation_sessions')
@Index(['impersonatorId'])
@Index(['targetUserId'])
@Index(['isActive'])
export class ImpersonationSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Admin user performing impersonation */
  @Column({ name: 'impersonator_id', type: 'uuid' })
  impersonatorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'impersonator_id' })
  impersonator?: User;

  /** User being impersonated */
  @Column({ name: 'target_user_id', type: 'uuid' })
  targetUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_user_id' })
  targetUser?: User;

  /** Reason for impersonation */
  @Column({ type: 'text' })
  reason!: string;

  /** Is session active */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Session start */
  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  /** Session end */
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt?: Date | null;

  /** Maximum duration (session auto-expires) */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** IP address of impersonator */
  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  ipAddress!: string;

  /** User agent of impersonator */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  /** Actions performed during impersonation */
  @Column({ name: 'actions_log', type: 'jsonb', default: () => `'[]'` })
  actionsLog!: Array<{
    action: string;
    resource: string;
    timestamp: string;
    details?: Record<string, unknown>;
  }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// DELEGATION ENTITY
// ============================================================

export type DelegationStatus = 'pending' | 'active' | 'expired' | 'revoked';

/**
 * Delegation entity - temporary authority delegation between users
 */
@Entity('delegations')
@Index(['delegatorId'])
@Index(['delegateId'])
@Index(['status'])
@Index(['startsAt', 'endsAt'])
export class Delegation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User delegating authority */
  @Column({ name: 'delegator_id', type: 'uuid' })
  delegatorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delegator_id' })
  delegator?: User;

  /** User receiving delegated authority */
  @Column({ name: 'delegate_id', type: 'uuid' })
  delegateId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delegate_id' })
  delegate?: User;

  /** Delegation name/title */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Reason for delegation */
  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  /** Status */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: DelegationStatus;

  /** Delegated permissions (specific permission codes) */
  @Column({ name: 'delegated_permissions', type: 'jsonb', default: () => `'[]'` })
  delegatedPermissions!: string[];

  /** Delegated roles (role IDs to temporarily grant) */
  @Column({ name: 'delegated_roles', type: 'jsonb', default: () => `'[]'` })
  delegatedRoles!: string[];

  /** Scope restrictions (e.g., specific collections, records) */
  @Column({ name: 'scope_restrictions', type: 'jsonb', nullable: true })
  scopeRestrictions?: {
    collections?: string[];
    recordFilters?: Record<string, unknown>;
  } | null;

  /** When delegation starts */
  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  /** When delegation ends */
  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  /** Requires approval */
  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval!: boolean;

  /** Approved by (if requires approval) */
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver?: User;

  /** Approved at */
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date | null;

  /** Revoked by */
  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy?: string | null;

  /** Revoked at */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  /** Revocation reason */
  @Column({ name: 'revocation_reason', type: 'text', nullable: true })
  revocationReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// BEHAVIORAL PROFILE ENTITY
// ============================================================

/**
 * BehavioralProfile entity - learned user behavior patterns for anomaly detection
 */
@Entity('behavioral_profiles')
@Index(['userId'], { unique: true })
export class BehavioralProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Typical login times (hour of day distribution) */
  @Column({ name: 'login_hours', type: 'jsonb', default: () => `'{}'` })
  loginHours!: Record<string, number>; // { "0": 5, "9": 100, "10": 95, ... }

  /** Typical login days (day of week distribution) */
  @Column({ name: 'login_days', type: 'jsonb', default: () => `'{}'` })
  loginDays!: Record<string, number>; // { "Monday": 20, "Tuesday": 18, ... }

  /** Known locations */
  @Column({ name: 'known_locations', type: 'jsonb', default: () => `'[]'` })
  knownLocations!: Array<{
    city?: string;
    region?: string;
    country: string;
    countryCode: string;
    frequency: number;
    lastSeen: string;
  }>;

  /** Known IP ranges */
  @Column({ name: 'known_ip_ranges', type: 'jsonb', default: () => `'[]'` })
  knownIpRanges!: Array<{
    cidr: string;
    frequency: number;
    lastSeen: string;
    isp?: string;
  }>;

  /** Known devices */
  @Column({ name: 'known_devices', type: 'jsonb', default: () => `'[]'` })
  knownDevices!: Array<{
    fingerprint: string;
    name: string;
    frequency: number;
    lastSeen: string;
  }>;

  /** Typical session duration (minutes) */
  @Column({ name: 'avg_session_duration', type: 'int', default: 30 })
  avgSessionDuration!: number;

  /** Average actions per session */
  @Column({ name: 'avg_actions_per_session', type: 'int', default: 10 })
  avgActionsPerSession!: number;

  /** Last profile update */
  @Column({ name: 'last_updated_at', type: 'timestamptz' })
  lastUpdatedAt!: Date;

  /** Number of data points used for profile */
  @Column({ name: 'data_points', type: 'int', default: 0 })
  dataPoints!: number;

  /** Profile confidence score (0-100) */
  @Column({ name: 'confidence_score', type: 'int', default: 0 })
  confidenceScore!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// SECURITY ALERT ENTITY
// ============================================================

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';

/**
 * SecurityAlert entity - tracks security anomalies and alerts
 */
@Entity('security_alerts')
@Index(['userId'])
@Index(['severity'])
@Index(['status'])
@Index(['createdAt'])
export class SecurityAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Alert type */
  @Column({ name: 'alert_type', type: 'varchar', length: 100 })
  alertType!: string;

  /** Alert title */
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  /** Alert description */
  @Column({ type: 'text' })
  description!: string;

  /** Severity */
  @Column({ type: 'varchar', length: 20 })
  severity!: AlertSeverity;

  /** Status */
  @Column({ type: 'varchar', length: 20, default: 'new' })
  status!: AlertStatus;

  /** Risk score (0-100) */
  @Column({ name: 'risk_score', type: 'int', default: 50 })
  riskScore!: number;

  /** Event details */
  @Column({ type: 'jsonb', nullable: true })
  details?: {
    ipAddress?: string;
    userAgent?: string;
    location?: { city?: string; country?: string };
    deviceFingerprint?: string;
    expectedPattern?: Record<string, unknown>;
    actualPattern?: Record<string, unknown>;
    triggerReason?: string;
  } | null;

  /** Recommended actions */
  @Column({ name: 'recommended_actions', type: 'jsonb', default: () => `'[]'` })
  recommendedActions!: string[];

  /** Acknowledged by */
  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy?: string | null;

  /** Acknowledged at */
  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt?: Date | null;

  /** Resolution notes */
  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes?: string | null;

  /** Resolved by */
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string | null;

  /** Resolved at */
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
