import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { WorkflowRun } from './workflow-run.entity';

export type StepExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';

@Entity('workflow_step_execution')
@Index(['runId'])
@Index(['status'])
export class WorkflowStepExecution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @ManyToOne(() => WorkflowRun)
  @JoinColumn({ name: 'run_id' })
  run?: WorkflowRun;

  @Column({ name: 'step_id', type: 'varchar', length: 100 })
  stepId!: string;

  @Column({ name: 'step_type', type: 'varchar', length: 50 })
  stepType!: string;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: StepExecutionStatus;

  @Column({ name: 'input_data', type: 'jsonb', nullable: true })
  inputData?: Record<string, any>;

  @Column({ name: 'output_data', type: 'jsonb', nullable: true })
  outputData?: Record<string, any>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number;

  @Column({ name: 'external_reference', type: 'varchar', length: 255, nullable: true })
  externalReference?: string; // e.g., approval ID, HTTP request ID

  @Column({ name: 'waiting_for', type: 'jsonb', nullable: true })
  waitingFor?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
