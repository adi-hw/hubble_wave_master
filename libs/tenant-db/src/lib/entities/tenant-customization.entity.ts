import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

@Entity('tenant_customization')
@Index(['tenantId', 'configType', 'resourceKey', 'version'], { unique: true })
@Index(['tenantId', 'configType', 'resourceKey'])
@Index(['tenantId', 'isActive'])
export class TenantCustomization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'config_type', type: 'varchar', length: 50 })
  configType!: string; // 'table', 'field', 'acl', 'workflow', 'script', etc.

  @Column({ name: 'resource_key', type: 'varchar', length: 255 })
  resourceKey!: string; // e.g., 'asset', 'asset.status'

  @Column({ name: 'customization_type', type: 'varchar', length: 30 })
  customizationType!: 'override' | 'extend' | 'new';

  @Column({ name: 'base_platform_version', type: 'varchar', length: 20, nullable: true })
  basePlatformVersion?: string; // NULL for 'new' type

  @Column({ name: 'base_config_checksum', type: 'varchar', length: 64, nullable: true })
  baseConfigChecksum?: string; // For detecting platform changes

  @Column({ name: 'custom_config', type: 'jsonb' })
  customConfig!: Record<string, any>;

  @Column({ name: 'diff_from_base', type: 'jsonb', nullable: true })
  diffFromBase?: any[]; // JSON Patch format (RFC 6902)

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'previous_version_id', type: 'uuid', nullable: true })
  previousVersionId?: string;

  @ManyToOne(() => TenantCustomization)
  @JoinColumn({ name: 'previous_version_id' })
  previousVersion?: TenantCustomization;
}
