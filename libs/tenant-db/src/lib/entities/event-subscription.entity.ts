import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type EventHandlerType = 'workflow' | 'script' | 'webhook' | 'notification';
export type EventExecutionMode = 'sync' | 'async' | 'batch';

@Entity('event_subscription')
@Index(['tenantId', 'isActive'])
@Index(['eventCodes'])
export class EventSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'event_codes', type: 'varchar', array: true })
  eventCodes!: string[];

  @Column({ name: 'source_filter', type: 'jsonb', nullable: true })
  sourceFilter?: Record<string, any>;

  @Column({ name: 'handler_type', type: 'varchar', length: 30 })
  handlerType!: EventHandlerType;

  @Column({ name: 'handler_config', type: 'jsonb' })
  handlerConfig!: Record<string, any>;

  @Column({ name: 'execution_mode', type: 'varchar', length: 20, default: 'async' })
  executionMode!: EventExecutionMode;

  @Column({ name: 'batch_config', type: 'jsonb', nullable: true })
  batchConfig?: Record<string, any>;

  @Column({ name: 'retry_config', type: 'jsonb', nullable: true })
  retryConfig?: Record<string, any>;

  @Column({ name: 'condition_expression', type: 'jsonb', nullable: true })
  conditionExpression?: Record<string, any>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true })
  lastTriggeredAt?: Date;

  @Column({ name: 'trigger_count', type: 'bigint', default: 0 })
  triggerCount!: number;

  @Column({ name: 'error_count', type: 'bigint', default: 0 })
  errorCount!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
