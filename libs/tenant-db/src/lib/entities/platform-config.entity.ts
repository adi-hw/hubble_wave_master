import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('platform_config')
@Index(['configType', 'resourceKey', 'platformVersion'], { unique: true })
@Index(['configType', 'resourceKey'])
@Index(['platformVersion'])
export class PlatformConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'config_type', type: 'varchar', length: 50 })
  configType!: string; // 'table', 'field', 'acl', 'workflow', 'script', 'approval', 'notification', 'event', 'business_rule'

  @Column({ name: 'resource_key', type: 'varchar', length: 255 })
  resourceKey!: string; // e.g., 'asset', 'asset.status', 'asset_read_acl'

  @Column({ name: 'config_data', type: 'jsonb' })
  configData!: Record<string, any>;

  @Column({ name: 'platform_version', type: 'varchar', length: 20 })
  platformVersion!: string; // e.g., '2.5.0'

  @Column({ name: 'schema_version', type: 'int', default: 1 })
  schemaVersion!: number;

  @Column({ type: 'varchar', length: 64 })
  checksum!: string; // SHA-256 for change detection

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
