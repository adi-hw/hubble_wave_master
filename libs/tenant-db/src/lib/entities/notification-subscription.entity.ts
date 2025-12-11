import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type SubscriptionType = 'table_changes' | 'record_changes' | 'field_changes' | 'approval' | 'mention' | 'assignment' | 'workflow';
export type DigestMode = 'immediate' | 'hourly' | 'daily' | 'weekly';

@Entity('notification_subscription')
@Index(['tenantId', 'userId', 'subscriptionType', 'targetTable', 'targetRecordId'], { unique: true })
@Index(['userId', 'isActive'])
export class NotificationSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'subscription_type', type: 'varchar', length: 50 })
  subscriptionType!: SubscriptionType;

  @Column({ name: 'target_table', type: 'varchar', length: 100, nullable: true })
  targetTable?: string;

  @Column({ name: 'target_record_id', type: 'uuid', nullable: true })
  targetRecordId?: string;

  @Column({ name: 'target_field', type: 'varchar', length: 100, nullable: true })
  targetField?: string;

  @Column({ name: 'filter_condition', type: 'jsonb', nullable: true })
  filterCondition?: Record<string, any>;

  @Column({ type: 'varchar', array: true })
  channels!: string[];

  @Column({ name: 'digest_mode', type: 'varchar', length: 20, default: 'immediate' })
  digestMode!: DigestMode;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
