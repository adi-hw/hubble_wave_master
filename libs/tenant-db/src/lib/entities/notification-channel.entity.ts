import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type ChannelType = 'email' | 'in_app' | 'sms' | 'push' | 'webhook' | 'teams' | 'slack';

@Entity('notification_channel')
@Index(['tenantId', 'code'], { unique: true })
@Index(['channelType', 'isActive'])
export class NotificationChannel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'channel_type', type: 'varchar', length: 30 })
  channelType!: ChannelType;

  @Column({ type: 'jsonb' })
  config!: Record<string, any>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'last_test_at', type: 'timestamptz', nullable: true })
  lastTestAt?: Date;

  @Column({ name: 'last_test_status', type: 'varchar', length: 30, nullable: true })
  lastTestStatus?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
