import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { EventDefinition, EventSourceType } from './event-definition.entity';

@Entity('event_log')
@Index(['tenantId', 'eventCode', 'occurredAt'])
@Index(['sourceTable', 'sourceRecordId'])
@Index(['correlationId'])
export class EventLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'event_definition_id', type: 'uuid', nullable: true })
  eventDefinitionId?: string;

  @ManyToOne(() => EventDefinition)
  @JoinColumn({ name: 'event_definition_id' })
  eventDefinition?: EventDefinition;

  @Column({ name: 'event_code', type: 'varchar', length: 100 })
  eventCode!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 30 })
  sourceType!: EventSourceType;

  @Column({ name: 'source_table', type: 'varchar', length: 100, nullable: true })
  sourceTable?: string;

  @Column({ name: 'source_record_id', type: 'uuid', nullable: true })
  sourceRecordId?: string;

  @Column({ name: 'source_user_id', type: 'uuid', nullable: true })
  sourceUserId?: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100, nullable: true })
  correlationId?: string;

  @Column({ name: 'causation_id', type: 'uuid', nullable: true })
  causationId?: string;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'NOW()' })
  occurredAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ name: 'partition_key', type: 'varchar', length: 50, nullable: true })
  partitionKey?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
