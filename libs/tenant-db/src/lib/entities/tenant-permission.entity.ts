import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * TenantPermission - Tenant-scoped permission definitions
 *
 * These permissions are defined per-tenant and stored in the tenant database.
 * They represent fine-grained access controls for tenant-specific features.
 *
 * Categories:
 * - table: Table-level permissions (read, write, delete on specific tables)
 * - workflow: Workflow permissions (execute, approve, design)
 * - report: Report permissions (view, export, schedule)
 * - admin: Administrative permissions within the tenant (manage_users, manage_roles)
 */
@Entity('tenant_permissions')
@Index(['slug'], { unique: true })
@Index(['category'])
export class TenantPermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50 })
  category!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 50, nullable: true })
  resourceType?: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 255, nullable: true })
  resourceId?: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

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
