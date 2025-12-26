import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Control Plane user role
 */
export type ControlPlaneRole = 'super_admin' | 'admin' | 'support' | 'readonly';

/**
 * Control Plane user status
 */
export type ControlPlaneUserStatus = 'active' | 'inactive' | 'locked';

/**
 * ControlPlaneUser entity - HubbleWave internal staff users
 * Stored in Control Plane database (eam_control)
 * 
 * These are NOT customer users! These are HubbleWave employees who
 * manage customer instances, handle support, etc.
 */
@Entity('control_plane_users')
@Index(['email'], { unique: true })
@Index(['role'])
@Index(['status'])
export class ControlPlaneUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Email address (login identifier) */
  @Column({ type: 'varchar', length: 320, unique: true })
  email!: string;

  /** Display name */
  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  /** First name */
  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName?: string | null;

  /** Last name */
  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName?: string | null;

  /** Password hash (Argon2) */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash?: string | null;

  /** Role in control plane */
  @Column({ type: 'varchar', length: 50, default: 'readonly' })
  role!: ControlPlaneRole;

  /** Account status */
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: ControlPlaneUserStatus;

  // ─────────────────────────────────────────────────────────────────
  // MFA
  // ─────────────────────────────────────────────────────────────────

  /** MFA enabled */
  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled!: boolean;

  /** MFA secret (encrypted) */
  @Column({ name: 'mfa_secret', type: 'varchar', length: 255, nullable: true })
  mfaSecret?: string | null;

  /** MFA backup codes (encrypted) */
  @Column({ name: 'mfa_backup_codes', type: 'jsonb', nullable: true })
  mfaBackupCodes?: string[] | null;

  // ─────────────────────────────────────────────────────────────────
  // Security
  // ─────────────────────────────────────────────────────────────────

  /** Failed login attempts */
  @Column({ name: 'failed_login_attempts', type: 'integer', default: 0 })
  failedLoginAttempts!: number;

  /** Locked until */
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil?: Date | null;

  /** Password changed at */
  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Activity Tracking
  // ─────────────────────────────────────────────────────────────────

  /** Last login timestamp */
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  /** Last login IP */
  @Column({ name: 'last_login_ip', type: 'varchar', length: 45, nullable: true })
  lastLoginIp?: string | null;

  /** Last activity timestamp */
  @Column({ name: 'last_activity_at', type: 'timestamptz', nullable: true })
  lastActivityAt?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Avatar URL */
  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null;

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
