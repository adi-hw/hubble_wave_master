import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type EventCategory = 'record' | 'workflow' | 'approval' | 'user' | 'system' | 'integration';
export type EventSourceType = 'table' | 'workflow' | 'approval' | 'system' | 'custom';

@Entity('event_definition')
@Index(['tenantId', 'code'], { unique: true })
@Index(['category', 'isActive'])
export class EventDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string; // NULL for platform events

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: EventCategory;

  @Column({ name: 'payload_schema', type: 'jsonb', nullable: true })
  payloadSchema?: Record<string, any>;

  @Column({ name: 'source_type', type: 'varchar', length: 30 })
  sourceType!: EventSourceType;

  @Column({ name: 'source_config', type: 'jsonb', nullable: true })
  sourceConfig?: Record<string, any>;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished!: boolean;

  @Column({ name: 'retention_days', type: 'int', default: 30 })
  retentionDays!: number;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
