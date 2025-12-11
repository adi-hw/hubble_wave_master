import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('password_policies')
@Unique(['tenantId'])
export class PasswordPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'min_length', type: 'int', default: 12 })
  minLength!: number;

  @Column({ name: 'require_uppercase', default: true })
  requireUppercase!: boolean;

  @Column({ name: 'require_lowercase', default: true })
  requireLowercase!: boolean;

  @Column({ name: 'require_numbers', default: true })
  requireNumbers!: boolean;

  @Column({ name: 'require_symbols', default: false })
  requireSymbols!: boolean;

  @Column({ name: 'password_expiry_days', type: 'int', default: 0 })
  passwordExpiryDays!: number;

  @Column({ name: 'password_history_depth', type: 'int', default: 5 })
  passwordHistoryDepth!: number;

  @Column({ name: 'max_failed_attempts', type: 'int', default: 5 })
  maxFailedAttempts!: number;

  @Column({ name: 'lockout_duration_minutes', type: 'int', default: 15 })
  lockoutDurationMinutes!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
