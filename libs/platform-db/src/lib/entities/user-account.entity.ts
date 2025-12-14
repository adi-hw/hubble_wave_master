import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type UserAccountStatus = 'ACTIVE' | 'LOCKED' | 'INVITED' | 'DISABLED';

@Entity('user_accounts')
@Index(['isPlatformAdmin'], { where: '"is_platform_admin" = true' })
export class UserAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'primary_email', length: 320, unique: true })
  primaryEmail!: string;

  @Column({ name: 'password_hash', nullable: true, type: 'text' })
  passwordHash?: string;

  @Column({ name: 'password_algo', nullable: true })
  passwordAlgo?: string;

  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled!: boolean;

  @Column({ type: 'enum', enumName: 'user_account_status', default: 'ACTIVE' })
  status!: UserAccountStatus;

  @Column({ name: 'display_name', nullable: true })
  displayName?: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName?: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null;

  @Column({ name: 'locale', nullable: true })
  locale?: string;

  @Column({ name: 'time_zone', nullable: true })
  timeZone?: string;

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil?: Date;

  @Column({ name: 'last_failed_login_at', type: 'timestamptz', nullable: true })
  lastFailedLoginAt?: Date;

  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt?: Date;

  // Email verification
  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date | null;

  // Platform admin flag (superuser access across all tenants)
  @Column({ name: 'is_platform_admin', type: 'boolean', default: false })
  isPlatformAdmin!: boolean;

  // Last login tracking (global, not per-tenant)
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @Column({ name: 'last_login_ip', type: 'varchar', length: 45, nullable: true })
  lastLoginIp?: string | null;

  // Phone number for MFA/recovery
  @Column({ name: 'phone_number', type: 'varchar', length: 50, nullable: true })
  phoneNumber?: string | null;

  @Column({ name: 'phone_verified', type: 'boolean', default: false })
  phoneVerified!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
