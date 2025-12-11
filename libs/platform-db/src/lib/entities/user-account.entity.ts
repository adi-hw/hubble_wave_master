import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_accounts')
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
  status!: string;

  @Column({ name: 'display_name', nullable: true })
  displayName?: string;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
