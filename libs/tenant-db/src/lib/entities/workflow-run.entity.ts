import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { WorkflowDefinition, TriggerType } from './workflow-definition.entity';

export type WorkflowRunStatus = 'pending' | 'queued' | 'running' | 'waiting' | 'paused' | 'completed' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';

@Entity('workflow_runs')
@Index(['tenantId', 'status'])
@Index(['workflowId'])
@Index(['correlationId'])
export class WorkflowRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workflow_id', type: 'uuid' })
  workflowId!: string;

  @ManyToOne(() => WorkflowDefinition)
  @JoinColumn({ name: 'workflow_id' })
  workflow!: WorkflowDefinition;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ name: 'trigger_type', type: 'varchar', length: 30, nullable: true })
  triggerType?: TriggerType;

  @Column({ name: 'trigger_source', type: 'jsonb', nullable: true })
  triggerSource?: Record<string, any>; // { table: 'work_order', recordId: '...', event: 'update' }

  @Column({ name: 'triggered_by', type: 'uuid', nullable: true })
  triggeredBy?: string;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: WorkflowRunStatus;

  @Column({ name: 'current_step_id', type: 'varchar', length: 100, nullable: true })
  currentStepId?: string;

  @Column({ name: 'execution_path', type: 'jsonb', nullable: true })
  executionPath?: any[]; // Array of executed step IDs with timestamps

  @Column({ name: 'input_data', type: 'jsonb', nullable: true })
  inputData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  input?: any; // Legacy field

  @Column({ name: 'context_data', type: 'jsonb', nullable: true })
  contextData?: Record<string, any>; // Accumulated workflow variables

  @Column({ name: 'output_data', type: 'jsonb', nullable: true })
  outputData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  output?: any; // Legacy field

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  error?: string; // Legacy field

  @Column({ name: 'error_step_id', type: 'varchar', length: 100, nullable: true })
  errorStepId?: string;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails?: Record<string, any>;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100, nullable: true })
  correlationId?: string;

  @Column({ name: 'parent_run_id', type: 'uuid', nullable: true })
  parentRunId?: string;

  @ManyToOne(() => WorkflowRun)
  @JoinColumn({ name: 'parent_run_id' })
  parentRun?: WorkflowRun;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt?: Date; // Legacy field

  @Column({ name: 'estimated_completion_at', type: 'timestamptz', nullable: true })
  estimatedCompletionAt?: Date;
}
