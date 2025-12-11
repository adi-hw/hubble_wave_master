import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('notification_template')
@Index(['tenantId', 'code'], { unique: true })
@Index(['isActive'])
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'supported_channels', type: 'varchar', array: true })
  supportedChannels!: string[];

  @Column({ name: 'email_subject', type: 'varchar', length: 500, nullable: true })
  emailSubject?: string;

  @Column({ name: 'email_body_html', type: 'text', nullable: true })
  emailBodyHtml?: string;

  @Column({ name: 'email_body_text', type: 'text', nullable: true })
  emailBodyText?: string;

  @Column({ name: 'in_app_title', type: 'varchar', length: 255, nullable: true })
  inAppTitle?: string;

  @Column({ name: 'in_app_body', type: 'text', nullable: true })
  inAppBody?: string;

  @Column({ name: 'sms_body', type: 'varchar', length: 500, nullable: true })
  smsBody?: string;

  @Column({ name: 'push_title', type: 'varchar', length: 100, nullable: true })
  pushTitle?: string;

  @Column({ name: 'push_body', type: 'varchar', length: 255, nullable: true })
  pushBody?: string;

  @Column({ name: 'available_variables', type: 'jsonb', nullable: true })
  availableVariables?: any[];

  @Column({ type: 'varchar', length: 20, default: 'tenant' })
  source!: 'platform' | 'module' | 'tenant';

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
