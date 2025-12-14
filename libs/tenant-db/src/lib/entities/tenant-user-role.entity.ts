import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { TenantRole } from './tenant-role.entity';
import { TenantUser } from './tenant-user.entity';

/**
 * TenantUserRole - Direct role assignments to users
 *
 * Note: This entity supports both the legacy userId (platform-db reference)
 * and the new tenantUserId (tenant-db reference) for migration purposes.
 * New code should use tenantUserId.
 */
@Entity('tenant_user_roles')
@Unique(['tenantUserId', 'roleId'])
@Index(['userId'])
@Index(['tenantUserId'])
@Index(['roleId'])
export class TenantUserRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * @deprecated Use tenantUserId instead. This field is kept for backward compatibility.
   * References platform-db UserAccount.id
   */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  /**
   * References tenant-db TenantUser.id (preferred)
   */
  @Column({ name: 'tenant_user_id', type: 'uuid', nullable: true })
  tenantUserId?: string | null;

  @ManyToOne(() => TenantUser, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_user_id' })
  tenantUser?: TenantUser | null;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => TenantRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: TenantRole;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'assigned_by' })
  assignedByUser?: TenantUser | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
