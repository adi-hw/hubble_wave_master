import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TenantGroupMember } from './tenant-group-member.entity';
import { TenantGroupRole } from './tenant-group-role.entity';

export enum TenantGroupType {
  CUSTOM = 'CUSTOM',
  DEPARTMENT = 'DEPARTMENT',
  TEAM = 'TEAM',
  PROJECT = 'PROJECT',
  LOCATION = 'LOCATION',
}

/**
 * TenantGroup - Tenant-scoped group definitions
 *
 * Groups are collections of users within a tenant. They can be used for:
 * - Organizational structure (departments, teams)
 * - Project-based grouping
 * - Location-based grouping
 * - Custom groupings for access control
 *
 * Groups can have roles assigned, which are inherited by all members.
 */
@Entity('tenant_groups')
@Index(['slug'], { unique: true })
@Index(['type'])
export class TenantGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: TenantGroupType,
    enumName: 'tenant_group_type',
    default: TenantGroupType.CUSTOM,
  })
  type!: TenantGroupType;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(() => TenantGroupMember, (member) => member.group, { cascade: true })
  members?: TenantGroupMember[];

  @OneToMany(() => TenantGroupRole, (groupRole) => groupRole.group, { cascade: true })
  groupRoles?: TenantGroupRole[];

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
