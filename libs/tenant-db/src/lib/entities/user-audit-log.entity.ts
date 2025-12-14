import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantUser } from './tenant-user.entity';

export type UserAuditAction =
  | 'created'
  | 'invited'
  | 'invitation_resent'
  | 'activated'
  | 'deactivated'
  | 'reactivated'
  | 'suspended'
  | 'unsuspended'
  | 'deleted'
  | 'restored'
  | 'profile_updated'
  | 'role_assigned'
  | 'role_removed'
  | 'group_joined'
  | 'group_left'
  | 'password_changed'
  | 'password_reset_requested'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'delegate_added'
  | 'delegate_removed'
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'session_expired'
  | 'preferences_updated'
  | 'admin_granted'
  | 'admin_revoked';

export type ActorType = 'user' | 'system' | 'api' | 'sync' | 'admin';

@Entity('user_audit_log')
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
@Index(['actorId'])
@Index(['correlationId'])
export class UserAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => TenantUser)
  @JoinColumn({ name: 'user_id' })
  user!: TenantUser;

  @Column({ type: 'varchar', length: 50 })
  action!: UserAuditAction;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: TenantUser | null;

  @Column({ name: 'actor_type', type: 'varchar', length: 20, default: 'user' })
  actorType!: ActorType;

  // Target details (for role/group/permission changes)
  @Column({ name: 'target_type', type: 'varchar', length: 50, nullable: true })
  targetType?: string | null;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId?: string | null;

  @Column({ name: 'target_name', type: 'varchar', length: 255, nullable: true })
  targetName?: string | null;

  // Change details
  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue?: Record<string, unknown> | null;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue?: Record<string, unknown> | null;

  // Request context
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ name: 'correlation_id', type: 'uuid', nullable: true })
  correlationId?: string | null;

  // Additional metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
