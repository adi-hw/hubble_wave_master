/**
 * Process Flow Entities
 * HubbleWave Platform - Phase 4
 *
 * Entities for process flow definitions, instances, and execution history.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';

// ═══════════════════════════════════════════════════════════════════
// PROCESS FLOW DEFINITION
// ═══════════════════════════════════════════════════════════════════

export type TriggerType = 'record_created' | 'record_updated' | 'property_changed' | 'scheduled' | 'manual';
export type ProcessFlowRunAs = 'system' | 'triggering_user' | 'specified_user';

export interface ProcessFlowNode {
  id: string;
  type: 'start' | 'action' | 'approval' | 'condition' | 'wait' | 'end' | 'subflow';
  position: { x: number; y: number };
  name?: string;
  config: Record<string, unknown>;
}

export interface ProcessFlowConnection {
  id: string;
  fromNode: string;
  toNode: string;
  fromPort?: string;
  label?: string;
}

export interface ProcessFlowCanvas {
  nodes: ProcessFlowNode[];
  connections: ProcessFlowConnection[];
}

@Entity('process_flow_definitions')
@Index(['collectionId'], { where: '"is_active" = true' })
export class ProcessFlowDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', name: 'collection_id', nullable: true })
  collectionId?: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ type: 'boolean', name: 'is_active', default: false })
  isActive!: boolean;

  @Column({ type: 'jsonb', default: { nodes: [], connections: [] } })
  canvas!: ProcessFlowCanvas;

  @Column({ type: 'varchar', length: 50, name: 'trigger_type', default: 'record_created' })
  triggerType!: TriggerType;

  @Column({ type: 'jsonb', name: 'trigger_conditions', nullable: true })
  triggerConditions?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 100, name: 'trigger_schedule', nullable: true })
  triggerSchedule?: string;

  @Column({ type: 'jsonb', name: 'trigger_filter', nullable: true })
  triggerFilter?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, name: 'run_as', default: 'system' })
  runAs!: ProcessFlowRunAs;

  @Column({ type: 'integer', name: 'timeout_minutes', default: 60 })
  timeoutMinutes!: number;

  @Column({ type: 'integer', name: 'max_retries', default: 3 })
  maxRetries!: number;

  @Column({ type: 'integer', name: 'execution_count', default: 0 })
  executionCount!: number;

  @Column({ type: 'integer', name: 'success_count', default: 0 })
  successCount!: number;

  @Column({ type: 'integer', name: 'failure_count', default: 0 })
  failureCount!: number;

  @Column({ type: 'timestamptz', name: 'last_executed_at', nullable: true })
  lastExecutedAt?: Date;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => ProcessFlowInstance, (instance) => instance.processFlow)
  instances?: ProcessFlowInstance[];
}

// ═══════════════════════════════════════════════════════════════════
// PROCESS FLOW INSTANCE
// ═══════════════════════════════════════════════════════════════════

export type ProcessFlowInstanceState =
  | 'running'
  | 'waiting_approval'
  | 'waiting_condition'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

@Entity('process_flow_instances')
@Index(['processFlowId'])
@Index(['collectionId', 'recordId'])
@Index(['state'], { where: '"state" IN (\'running\', \'waiting_approval\')' })
export class ProcessFlowInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'process_flow_id' })
  processFlowId!: string;

  @ManyToOne(() => ProcessFlowDefinition, (processFlow) => processFlow.instances)
  @JoinColumn({ name: 'process_flow_id' })
  processFlow?: ProcessFlowDefinition;

  @Column({ type: 'uuid', name: 'record_id' })
  recordId!: string;

  @Column({ type: 'uuid', name: 'collection_id', nullable: true })
  collectionId?: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ type: 'varchar', length: 50, default: 'running' })
  state!: ProcessFlowInstanceState;

  @Column({ type: 'varchar', length: 100, name: 'current_node_id', nullable: true })
  currentNodeId?: string;

  @Column({ type: 'jsonb', default: {} })
  context!: Record<string, unknown>;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', name: 'error_stack', nullable: true })
  errorStack?: string;

  @Column({ type: 'integer', name: 'retry_count', default: 0 })
  retryCount!: number;

  @Column({ type: 'uuid', name: 'started_by', nullable: true })
  startedBy?: string;

  @Column({ type: 'timestamptz', name: 'started_at', default: () => 'NOW()' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ type: 'integer', name: 'duration_ms', nullable: true })
  durationMs?: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => ProcessFlowExecutionHistory, (history) => history.instance)
  history?: ProcessFlowExecutionHistory[];

  @OneToMany(() => Approval, (approval) => approval.processFlowInstance)
  approvals?: Approval[];
}

// ═══════════════════════════════════════════════════════════════════
// PROCESS FLOW EXECUTION HISTORY
// ═══════════════════════════════════════════════════════════════════

export type ExecutionHistoryStatus = 'started' | 'completed' | 'failed' | 'skipped' | 'waiting';

@Entity('process_flow_execution_history')
@Index(['instanceId', 'createdAt'])
export class ProcessFlowExecutionHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'instance_id' })
  instanceId!: string;

  @ManyToOne(() => ProcessFlowInstance, (instance) => instance.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instance_id' })
  instance?: ProcessFlowInstance;

  @Column({ type: 'varchar', length: 100, name: 'node_id' })
  nodeId!: string;

  @Column({ type: 'varchar', length: 50, name: 'node_type' })
  nodeType!: string;

  @Column({ type: 'varchar', length: 255, name: 'node_name', nullable: true })
  nodeName?: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 50 })
  status!: ExecutionHistoryStatus;

  @Column({ type: 'jsonb', name: 'input_data', nullable: true })
  inputData?: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'output_data', nullable: true })
  outputData?: Record<string, unknown>;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', name: 'error_stack', nullable: true })
  errorStack?: string;

  @Column({ type: 'integer', name: 'execution_time_ms', nullable: true })
  executionTimeMs?: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

// ═══════════════════════════════════════════════════════════════════
// APPROVALS
// ═══════════════════════════════════════════════════════════════════

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated' | 'expired' | 'cancelled';
export type ApproverType = 'user' | 'group' | 'role';
export type ApprovalType = 'sequential' | 'parallel_any' | 'parallel_all';

@Entity('approvals')
@Index(['approverId', 'status'])
@Index(['processFlowInstanceId'])
@Index(['dueDate'], { where: '"status" = \'pending\'' })
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'process_flow_instance_id' })
  processFlowInstanceId!: string;

  @ManyToOne(() => ProcessFlowInstance, (instance) => instance.approvals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'process_flow_instance_id' })
  processFlowInstance?: ProcessFlowInstance;

  @Column({ type: 'varchar', length: 100, name: 'node_id' })
  nodeId!: string;

  @Column({ type: 'uuid', name: 'approver_id' })
  approverId!: string;

  @Column({ type: 'varchar', length: 50, name: 'approver_type', default: 'user' })
  approverType!: ApproverType;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ type: 'timestamptz', name: 'due_date', nullable: true })
  dueDate?: Date;

  @Column({ type: 'timestamptz', name: 'responded_at', nullable: true })
  respondedAt?: Date;

  @Column({ type: 'uuid', name: 'responded_by', nullable: true })
  respondedBy?: string;

  @Column({ type: 'uuid', name: 'delegated_to', nullable: true })
  delegatedTo?: string;

  @Column({ type: 'timestamptz', name: 'delegated_at', nullable: true })
  delegatedAt?: Date;

  @Column({ type: 'text', name: 'delegation_reason', nullable: true })
  delegationReason?: string;

  @Column({ type: 'integer', name: 'sequence_number', default: 1 })
  sequenceNumber!: number;

  @Column({ type: 'varchar', length: 50, name: 'approval_type', default: 'sequential' })
  approvalType!: ApprovalType;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
