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

export type TenantUserStatus =
  | 'invited'
  | 'pending_activation'
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'deleted';

@Entity('tenant_users')
@Index(['userAccountId'], { unique: true })
@Index(['status'])
@Index(['employeeId'], { unique: true, where: '"employee_id" IS NOT NULL' })
@Index(['workEmail'])
@Index(['department'])
export class TenantUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Link to platform.user_accounts (cross-db reference) */
  @Column({ name: 'user_account_id', type: 'uuid', nullable: true })
  userAccountId?: string | null;

  /** User status in this tenant */
  @Column({ type: 'varchar', length: 20, default: 'invited' })
  status!: TenantUserStatus;

  // Employment/Organization data
  @Column({ name: 'employee_id', type: 'varchar', length: 100, nullable: true })
  employeeId?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  department?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location?: string | null;

  @Column({ name: 'cost_center', type: 'varchar', length: 50, nullable: true })
  costCenter?: string | null;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager?: TenantUser | null;

  // Contact info (can override platform defaults)
  @Column({ name: 'work_email', type: 'varchar', length: 320, nullable: true })
  workEmail?: string | null;

  @Column({ name: 'work_phone', type: 'varchar', length: 50, nullable: true })
  workPhone?: string | null;

  @Column({ name: 'mobile_phone', type: 'varchar', length: 50, nullable: true })
  mobilePhone?: string | null;

  // Display preferences
  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  locale?: string | null;

  @Column({ name: 'time_zone', type: 'varchar', length: 50, nullable: true })
  timeZone?: string | null;

  // Admin flags
  @Column({ name: 'is_tenant_admin', type: 'boolean', default: false })
  isTenantAdmin!: boolean;

  // Lifecycle tracking - Invitation
  @Column({ name: 'invited_by', type: 'uuid', nullable: true })
  invitedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'invited_by' })
  invitedByUser?: TenantUser | null;

  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt?: Date | null;

  @Column({ name: 'activation_token', type: 'varchar', length: 255, nullable: true })
  activationToken?: string | null;

  @Column({ name: 'activation_token_expires_at', type: 'timestamptz', nullable: true })
  activationTokenExpiresAt?: Date | null;

  // Lifecycle tracking - Activation
  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt?: Date | null;

  @Column({ name: 'activated_by', type: 'uuid', nullable: true })
  activatedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'activated_by' })
  activatedByUser?: TenantUser | null;

  // Lifecycle tracking - Deactivation
  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null;

  @Column({ name: 'deactivated_by', type: 'uuid', nullable: true })
  deactivatedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'deactivated_by' })
  deactivatedByUser?: TenantUser | null;

  @Column({ name: 'deactivation_reason', type: 'text', nullable: true })
  deactivationReason?: string | null;

  // Lifecycle tracking - Suspension
  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt?: Date | null;

  @Column({ name: 'suspended_by', type: 'uuid', nullable: true })
  suspendedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'suspended_by' })
  suspendedByUser?: TenantUser | null;

  @Column({ name: 'suspension_reason', type: 'text', nullable: true })
  suspensionReason?: string | null;

  @Column({ name: 'suspension_expires_at', type: 'timestamptz', nullable: true })
  suspensionExpiresAt?: Date | null;

  // Activity tracking
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  // Soft delete
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'deleted_by' })
  deletedByUser?: TenantUser | null;

  // Metadata
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  // Audit timestamps
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
