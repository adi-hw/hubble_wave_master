import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { NotificationTemplate } from './notification-template.entity';
import { NotificationChannel } from './notification-channel.entity';

export type DeliveryTriggerType = 'workflow' | 'approval' | 'subscription' | 'direct';
export type DeliveryStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'read';

@Entity('notification_delivery')
@Index(['status', 'scheduledAt'])
@Index(['recipientId'])
@Index(['tenantId', 'createdAt'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'trigger_type', type: 'varchar', length: 50 })
  triggerType!: DeliveryTriggerType;

  @Column({ name: 'trigger_reference_id', type: 'uuid', nullable: true })
  triggerReferenceId?: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId?: string;

  @ManyToOne(() => NotificationTemplate)
  @JoinColumn({ name: 'template_id' })
  template?: NotificationTemplate;

  @Column({ name: 'template_code', type: 'varchar', length: 100, nullable: true })
  templateCode?: string;

  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId?: string;

  @Column({ name: 'recipient_email', type: 'varchar', length: 255, nullable: true })
  recipientEmail?: string;

  @Column({ name: 'recipient_phone', type: 'varchar', length: 50, nullable: true })
  recipientPhone?: string;

  @Column({ type: 'varchar', length: 30 })
  channel!: string;

  @Column({ name: 'channel_config_id', type: 'uuid', nullable: true })
  channelConfigId?: string;

  @ManyToOne(() => NotificationChannel)
  @JoinColumn({ name: 'channel_config_id' })
  channelConfig?: NotificationChannel;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject?: string;

  @Column({ type: 'text', nullable: true })
  body?: string;

  @Column({ name: 'html_body', type: 'text', nullable: true })
  htmlBody?: string;

  @Column({ name: 'context_data', type: 'jsonb', nullable: true })
  contextData?: Record<string, any>;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: DeliveryStatus;

  @Column({ name: 'scheduled_at', type: 'timestamptz', default: () => 'NOW()' })
  scheduledAt!: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt?: Date;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'external_message_id', type: 'varchar', length: 255, nullable: true })
  externalMessageId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
