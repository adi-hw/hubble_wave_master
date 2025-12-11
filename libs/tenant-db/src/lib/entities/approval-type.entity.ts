import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type ApprovalMode = 'sequential' | 'parallel' | 'any' | 'quorum' | 'hierarchical';
export type ApproverConfigType = 'static' | 'dynamic' | 'script' | 'role' | 'field';
export type RequireComments = 'always' | 'on_reject' | 'never';

@Entity('approval_type')
@Index(['tenantId', 'code'], { unique: true })
@Index(['targetTable', 'isActive'])
export class ApprovalType {
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

  @Column({ name: 'target_table', type: 'varchar', length: 100, nullable: true })
  targetTable?: string;

  @Column({ name: 'trigger_conditions', type: 'jsonb', nullable: true })
  triggerConditions?: Record<string, any>;

  @Column({ name: 'approval_mode', type: 'varchar', length: 30, default: 'sequential' })
  approvalMode!: ApprovalMode;

  @Column({ name: 'quorum_percentage', type: 'int', nullable: true })
  quorumPercentage?: number;

  @Column({ name: 'hierarchy_levels', type: 'int', nullable: true })
  hierarchyLevels?: number;

  @Column({ name: 'approver_config', type: 'jsonb' })
  approverConfig!: Record<string, any>;

  @Column({ name: 'response_options', type: 'jsonb', default: '[{"code":"approved","label":"Approve"},{"code":"rejected","label":"Reject"}]' })
  responseOptions!: any[];

  @Column({ name: 'require_comments', type: 'varchar', length: 20, default: 'on_reject' })
  requireComments!: RequireComments;

  @Column({ name: 'allow_delegate', type: 'boolean', default: true })
  allowDelegate!: boolean;

  @Column({ name: 'allow_recall', type: 'boolean', default: true })
  allowRecall!: boolean;

  @Column({ name: 'escalation_config', type: 'jsonb', nullable: true })
  escalationConfig?: Record<string, any>;

  @Column({ name: 'sla_hours', type: 'int', nullable: true })
  slaHours?: number;

  @Column({ name: 'sla_warning_hours', type: 'int', nullable: true })
  slaWarningHours?: number;

  @Column({ name: 'notification_config', type: 'jsonb', nullable: true })
  notificationConfig?: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'tenant' })
  source!: 'platform' | 'module' | 'tenant';

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
}
