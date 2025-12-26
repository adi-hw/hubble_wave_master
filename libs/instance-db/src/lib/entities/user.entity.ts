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

/**
 * User status
 */
export type UserStatus = 
  | 'invited'
  | 'pending_activation'
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'locked'
  | 'deleted';

/**
 * User entity - core user table for the customer instance
 * 
 * NOTE: This is NOT "tenant_users" - we don't use tenant terminology!
 * This table exists in each customer's isolated database.
 * There is NO tenant_id column because the entire database belongs to one customer.
 */
@Entity('users')
@Index(['email'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['username'], { unique: true, where: '"username" IS NOT NULL AND "deleted_at" IS NULL' })
@Index(['employeeId'], { unique: true, where: '"employee_id" IS NOT NULL' })
@Index(['status'])
@Index(['department'])
@Index(['managerId'])
@Index(['isAdmin'])
@Index(['lastLoginAt']) // For "active users" queries
@Index(['activationToken'], { where: '"activation_token" IS NOT NULL' }) // For token lookups
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ─────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────

  /** Primary email address */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /** Username (optional, for systems that prefer usernames) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  username?: string | null;

  /** Display name (shown in UI) */
  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  /** First name */
  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName?: string | null;

  /** Last name */
  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────────────────────────────────

  /** Password hash (Argon2id) */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash?: string | null;

  /** Password algorithm used */
  @Column({ name: 'password_algo', type: 'varchar', length: 20, default: 'argon2id' })
  passwordAlgo!: string;

  /** When password was last changed */
  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt?: Date | null;

  /** Password must be changed on next login */
  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────────────

  /** User status */
  @Column({ type: 'varchar', length: 20, default: 'invited' })
  status!: UserStatus;

  // ─────────────────────────────────────────────────────────────────
  // Contact Information
  // ─────────────────────────────────────────────────────────────────

  /** Work phone */
  @Column({ name: 'work_phone', type: 'varchar', length: 50, nullable: true })
  workPhone?: string | null;

  /** Mobile phone */
  @Column({ name: 'mobile_phone', type: 'varchar', length: 50, nullable: true })
  mobilePhone?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Organization
  // ─────────────────────────────────────────────────────────────────

  /** Employee ID */
  @Column({ name: 'employee_id', type: 'varchar', length: 100, nullable: true })
  employeeId?: string | null;

  /** Job title */
  @Column({ type: 'varchar', length: 200, nullable: true })
  title?: string | null;

  /** Department */
  @Column({ type: 'varchar', length: 200, nullable: true })
  department?: string | null;

  /** Location */
  @Column({ type: 'varchar', length: 200, nullable: true })
  location?: string | null;

  /** Cost center */
  @Column({ name: 'cost_center', type: 'varchar', length: 50, nullable: true })
  costCenter?: string | null;

  /** Manager ID */
  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager?: User | null;

  // ─────────────────────────────────────────────────────────────────
  // Profile
  // ─────────────────────────────────────────────────────────────────

  /** Avatar URL */
  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null;

  /** Locale preference */
  @Column({ type: 'varchar', length: 20, default: 'en-US' })
  locale!: string;

  /** Time zone */
  @Column({ name: 'time_zone', type: 'varchar', length: 50, default: 'America/New_York' })
  timeZone!: string;

  /** Date format preference */
  @Column({ name: 'date_format', type: 'varchar', length: 20, default: 'MM/DD/YYYY' })
  dateFormat!: string;

  /** Time format preference (12h or 24h) */
  @Column({ name: 'time_format', type: 'varchar', length: 10, default: '12h' })
  timeFormat!: string;

  // ─────────────────────────────────────────────────────────────────
  // MFA
  // ─────────────────────────────────────────────────────────────────

  /** MFA enabled */
  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled!: boolean;

  /** MFA secret (encrypted) */
  @Column({ name: 'mfa_secret', type: 'varchar', length: 255, nullable: true })
  mfaSecret?: string | null;

  /** MFA backup codes (encrypted JSON) */
  @Column({ name: 'mfa_backup_codes', type: 'jsonb', nullable: true })
  mfaBackupCodes?: string[] | null;

  /** MFA recovery email */
  @Column({ name: 'mfa_recovery_email', type: 'varchar', length: 320, nullable: true })
  mfaRecoveryEmail?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Security
  // ─────────────────────────────────────────────────────────────────

  /** Failed login attempts */
  @Column({ name: 'failed_login_attempts', type: 'integer', default: 0 })
  failedLoginAttempts!: number;

  /** Account locked until */
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil?: Date | null;

  /** Last failed login attempt */
  @Column({ name: 'last_failed_login_at', type: 'timestamptz', nullable: true })
  lastFailedLoginAt?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Email Verification
  // ─────────────────────────────────────────────────────────────────

  /** Email verified */
  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  /** When email was verified */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Admin Flags
  // ─────────────────────────────────────────────────────────────────

  /** Is administrator (full access to this instance) */
  @Column({ name: 'is_admin', type: 'boolean', default: false })
  isAdmin!: boolean;

  /** Is system user (automated processes) */
  @Column({ name: 'is_system_user', type: 'boolean', default: false })
  isSystemUser!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Invitation Tracking
  // ─────────────────────────────────────────────────────────────────

  /** Invited by user ID */
  @Column({ name: 'invited_by', type: 'uuid', nullable: true })
  invitedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'invited_by' })
  invitedByUser?: User | null;

  /** When invitation was sent */
  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt?: Date | null;

  /** Activation token */
  @Column({ name: 'activation_token', type: 'varchar', length: 255, nullable: true })
  activationToken?: string | null;

  /** Activation token expiry */
  @Column({ name: 'activation_token_expires_at', type: 'timestamptz', nullable: true })
  activationTokenExpiresAt?: Date | null;

  /** When user activated their account */
  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Deactivation Tracking
  // ─────────────────────────────────────────────────────────────────

  /** When user was deactivated */
  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null;

  /** Deactivated by user ID */
  @Column({ name: 'deactivated_by', type: 'uuid', nullable: true })
  deactivatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'deactivated_by' })
  deactivatedByUser?: User | null;

  /** Deactivation reason */
  @Column({ name: 'deactivation_reason', type: 'text', nullable: true })
  deactivationReason?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Suspension Tracking
  // ─────────────────────────────────────────────────────────────────

  /** When user was suspended */
  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt?: Date | null;

  /** Suspended by user ID */
  @Column({ name: 'suspended_by', type: 'uuid', nullable: true })
  suspendedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'suspended_by' })
  suspendedByUser?: User | null;

  /** Suspension reason */
  @Column({ name: 'suspension_reason', type: 'text', nullable: true })
  suspensionReason?: string | null;

  /** Suspension expiry (for temporary suspensions) */
  @Column({ name: 'suspension_expires_at', type: 'timestamptz', nullable: true })
  suspensionExpiresAt?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Activity Tracking
  // ─────────────────────────────────────────────────────────────────

  /** Last login timestamp */
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  /** Last login IP address */
  @Column({ name: 'last_login_ip', type: 'varchar', length: 45, nullable: true })
  lastLoginIp?: string | null;

  /** Last activity timestamp */
  @Column({ name: 'last_activity_at', type: 'timestamptz', nullable: true })
  lastActivityAt?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Soft Delete
  // ─────────────────────────────────────────────────────────────────

  /** Soft delete timestamp */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  /** Deleted by user ID */
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'deleted_by' })
  deletedByUser?: User | null;

  // ─────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Additional metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Audit Fields
  // ─────────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
