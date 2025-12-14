import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { UserAccount } from './user-account.entity';

export type InvitationType = 'email' | 'ldap_sync' | 'sso_jit' | 'admin_create';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

@Entity('user_invitations')
@Index(['token'])
@Index(['email'])
@Index(['tenantId'])
@Index(['status'])
@Unique(['email', 'tenantId', 'status'])
export class UserInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 255, unique: true })
  token!: string;

  @Column({ name: 'token_expires_at', type: 'timestamptz' })
  tokenExpiresAt!: Date;

  @Column({ name: 'invited_by', type: 'uuid', nullable: true })
  invitedBy?: string | null;

  @ManyToOne(() => UserAccount, { nullable: true })
  @JoinColumn({ name: 'invited_by' })
  invitedByUser?: UserAccount | null;

  @Column({ name: 'invitation_type', type: 'varchar', length: 50, default: 'email' })
  invitationType!: InvitationType;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: InvitationStatus;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;

  // Data to pre-populate the user profile when they accept
  @Column({ name: 'display_name', type: 'varchar', length: 255, nullable: true })
  displayName?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  department?: string | null;

  @Column({ name: 'employee_id', type: 'varchar', length: 100, nullable: true })
  employeeId?: string | null;

  // Roles and groups to assign upon acceptance
  @Column({ name: 'initial_role_ids', type: 'jsonb', default: () => `'[]'` })
  initialRoleIds!: string[];

  @Column({ name: 'initial_group_ids', type: 'jsonb', default: () => `'[]'` })
  initialGroupIds!: string[];

  // Personal message from inviter
  @Column({ name: 'personal_message', type: 'text', nullable: true })
  personalMessage?: string | null;

  // Resend tracking
  @Column({ name: 'resend_count', type: 'int', default: 0 })
  resendCount!: number;

  @Column({ name: 'last_resent_at', type: 'timestamptz', nullable: true })
  lastResentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
