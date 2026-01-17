import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Instance } from './instance.entity';

/**
 * Terraform job status
 */
export type TerraformJobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Terraform operation type
 */
export type TerraformOperation =
  | 'plan'
  | 'apply'
  | 'destroy'
  | 'refresh'
  | 'validate';

/**
 * Terraform output line type
 */
export interface TerraformOutputLine {
  time: string;
  timestamp?: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

/**
 * Terraform plan type
 */
export interface TerraformPlan {
  add?: number;
  change?: number;
  destroy?: number;
  resources?: TerraformResourceChange[];
  rawOutput?: string;
}

/**
 * Terraform resource change
 */
export interface TerraformResourceChange {
  address: string;
  action: 'create' | 'update' | 'delete' | 'replace' | 'no-op';
  type: string;
  name: string;
}

/**
 * Terraform Job Entity
 *
 * Tracks Terraform operations for instance provisioning
 */
@Entity('terraform_jobs')
@Index(['instanceId', 'createdAt'])
@Index(['customerCode', 'createdAt'])
@Index(['status'])
export class TerraformJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'instance_id' })
  @Index()
  instanceId!: string;

  @Column({ type: 'varchar', length: 50, name: 'customer_code' })
  @Index()
  customerCode!: string;

  @Column({ type: 'varchar', length: 50 })
  environment!: string;

  @Column({ type: 'varchar', length: 50 })
  operation!: TerraformOperation;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: TerraformJobStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  workspace?: string;

  @Column({ type: 'text', nullable: true, name: 'plan_output' })
  planOutput?: string;

  @Column({ type: 'jsonb', nullable: true })
  plan?: TerraformPlan;

  @Column({ type: 'jsonb', nullable: true, name: 'output_lines' })
  outputLines?: TerraformOutputLine[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  output!: TerraformOutputLine[];

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'int', nullable: true, name: 'exit_code' })
  exitCode?: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'started_at' })
  startedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'cancelled_at' })
  cancelledAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'triggered_by' })
  triggeredBy?: string;

  @Column({ type: 'uuid', nullable: true, name: 'cancelled_by' })
  cancelledBy?: string;

  @Column({ type: 'int', nullable: true })
  duration?: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Instance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instance_id' })
  instance?: Instance;
}
