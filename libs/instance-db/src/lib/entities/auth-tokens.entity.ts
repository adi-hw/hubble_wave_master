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
