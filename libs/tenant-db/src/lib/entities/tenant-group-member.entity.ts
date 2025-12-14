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
import { TenantGroup } from './tenant-group.entity';
import { TenantUser } from './tenant-user.entity';

/**
 * TenantGroupMember - Maps users to tenant groups
 *
 * Note: This entity supports both the legacy userId (platform-db reference)
 * and the new tenantUserId (tenant-db reference) for migration purposes.
 * New code should use tenantUserId.
 */
@Entity('tenant_group_members')
@Unique(['groupId', 'tenantUserId'])
@Index(['groupId'])
@Index(['userId'])
@Index(['tenantUserId'])
export class TenantGroupMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => TenantGroup, (group) => group.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: TenantGroup;

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

  @Column({ name: 'is_manager', type: 'boolean', default: false })
  isManager!: boolean;

  @Column({ name: 'added_by', type: 'uuid', nullable: true })
  addedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'added_by' })
  addedByUser?: TenantUser | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
