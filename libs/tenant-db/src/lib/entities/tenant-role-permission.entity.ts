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
import { TenantPermission } from './tenant-permission.entity';

/**
 * TenantRolePermission - Maps tenant roles to tenant permissions
 *
 * This is the join table between TenantRole and TenantPermission.
 */
@Entity('tenant_role_permissions')
@Unique(['roleId', 'permissionId'])
@Index(['roleId'])
@Index(['permissionId'])
export class TenantRolePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => TenantRole, (role) => role.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: TenantRole;

  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @ManyToOne(() => TenantPermission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission!: TenantPermission;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
