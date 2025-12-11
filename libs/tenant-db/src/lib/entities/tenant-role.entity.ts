import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TenantRolePermission } from './tenant-role-permission.entity';

/**
 * TenantRole - Tenant-scoped role definitions
 *
 * These roles are defined per-tenant and stored in the tenant database.
 * Unlike platform-db Role which handles cross-tenant platform roles,
 * TenantRole handles application-specific roles within a single tenant.
 *
 * Examples: "Asset Manager", "Maintenance Technician", "Viewer"
 */
@Entity('tenant_roles')
@Index(['slug'], { unique: true })
export class TenantRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'priority', type: 'int', default: 0 })
  priority!: number;

  @OneToMany(() => TenantRolePermission, (rp) => rp.role, { cascade: true })
  rolePermissions?: TenantRolePermission[];

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
