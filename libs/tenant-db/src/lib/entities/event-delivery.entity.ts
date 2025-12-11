import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { EventLog } from './event-log.entity';
import { EventSubscription } from './event-subscription.entity';

export type EventDeliveryStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'retrying';

@Entity('event_delivery')
@Index(['status'])
@Index(['eventLogId'])
@Index(['subscriptionId'])
export class EventDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_log_id', type: 'uuid' })
  eventLogId!: string;

  @ManyToOne(() => EventLog)
  @JoinColumn({ name: 'event_log_id' })
  eventLog?: EventLog;

  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId!: string;

  @ManyToOne(() => EventSubscription)
  @JoinColumn({ name: 'subscription_id' })
  subscription?: EventSubscription;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: EventDeliveryStatus;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt?: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails?: Record<string, any>;

  @Column({ name: 'handler_response', type: 'jsonb', nullable: true })
  handlerResponse?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
