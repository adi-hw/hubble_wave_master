import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type TriggerType = 'record_event' | 'schedule' | 'manual' | 'api' | 'approval_response';
export type ExecutionMode = 'sync' | 'async' | 'background';
export type ErrorHandling = 'stop' | 'continue' | 'rollback' | 'notify_admin';
export type WorkflowSource = 'platform' | 'module' | 'tenant';
export type WorkflowCategory = 'approval' | 'automation' | 'notification' | 'integration';

@Entity('workflow_definitions')
@Index(['slug'], { unique: true })
@Index(['tenantId', 'code'], { unique: true })
@Index(['tenantId', 'isActive'])
export class WorkflowDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string; // NULL for platform workflows

  @Column({ type: 'varchar', length: 100, nullable: true })
  code?: string;

  @Column()
  name!: string;

  @Column()
  slug!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: WorkflowCategory;

  @Column({ name: 'trigger_type', type: 'varchar', default: 'manual' })
  triggerType!: TriggerType;

  @Column({ name: 'trigger_config', type: 'jsonb', default: {} })
  triggerConfig!: Record<string, any>;

  @Column({ name: 'canvas_layout', type: 'jsonb', nullable: true })
  canvasLayout?: Record<string, any>; // { nodes: [...], edges: [...] } for visual designer

  @Column({ type: 'jsonb', default: [] })
  steps!: any[];

  @Column({ name: 'input_schema', type: 'jsonb', nullable: true })
  inputSchema?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  variables?: Record<string, any>;

  @Column({ name: 'output_mapping', type: 'jsonb', nullable: true })
  outputMapping?: Record<string, any>;

  @Column({ name: 'execution_mode', type: 'varchar', length: 20, default: 'async' })
  executionMode!: ExecutionMode;

  @Column({ name: 'timeout_minutes', type: 'int', default: 60 })
  timeoutMinutes!: number;

  @Column({ name: 'retry_config', type: 'jsonb', nullable: true })
  retryConfig?: Record<string, any>;

  @Column({ name: 'error_handling', type: 'varchar', length: 30, default: 'stop' })
  errorHandling!: ErrorHandling;

  @Column({ type: 'varchar', length: 20, default: 'tenant' })
  source!: WorkflowSource;

  @Column({ name: 'platform_version', type: 'varchar', length: 20, nullable: true })
  platformVersion?: string;

  @Column({ type: 'varchar', default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
