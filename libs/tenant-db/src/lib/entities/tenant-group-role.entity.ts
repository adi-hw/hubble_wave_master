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
import { TenantRole } from './tenant-role.entity';

/**
 * TenantGroupRole - Assigns roles to groups
 *
 * When a role is assigned to a group, all members of that group
 * inherit the role's permissions.
 */
@Entity('tenant_group_roles')
@Unique(['groupId', 'roleId'])
@Index(['groupId'])
@Index(['roleId'])
export class TenantGroupRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => TenantGroup, (group) => group.groupRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: TenantGroup;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => TenantRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: TenantRole;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
