import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApprovalType } from './approval-type.entity';
import { WorkflowRun } from './workflow-run.entity';

export type ApprovalRequestStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'escalated';
export type RequestedAction = 'create' | 'update' | 'delete' | 'submit' | 'custom';

@Entity('approval_request')
@Index(['tenantId', 'status'])
@Index(['targetTable', 'targetRecordId'])
@Index(['requestedBy'])
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'approval_type_id', type: 'uuid' })
  approvalTypeId!: string;

  @ManyToOne(() => ApprovalType)
  @JoinColumn({ name: 'approval_type_id' })
  approvalType?: ApprovalType;

  @Column({ name: 'target_table', type: 'varchar', length: 100 })
  targetTable!: string;

  @Column({ name: 'target_record_id', type: 'uuid' })
  targetRecordId!: string;

  @Column({ name: 'target_record_snapshot', type: 'jsonb', nullable: true })
  targetRecordSnapshot?: Record<string, any>;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'requested_action', type: 'varchar', length: 100, nullable: true })
  requestedAction?: RequestedAction;

  @Column({ name: 'changes_summary', type: 'jsonb', nullable: true })
  changesSummary?: Record<string, any>;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: ApprovalRequestStatus;

  @Column({ name: 'final_response', type: 'varchar', length: 50, nullable: true })
  finalResponse?: string;

  @Column({ name: 'final_response_at', type: 'timestamptz', nullable: true })
  finalResponseAt?: Date;

  @Column({ name: 'final_responder_id', type: 'uuid', nullable: true })
  finalResponderId?: string;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy!: string;

  @Column({ name: 'requested_at', type: 'timestamptz', default: () => 'NOW()' })
  requestedAt!: Date;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt?: Date;

  @Column({ name: 'escalated_at', type: 'timestamptz', nullable: true })
  escalatedAt?: Date;

  @Column({ name: 'escalation_level', type: 'int', default: 0 })
  escalationLevel!: number;

  @Column({ name: 'workflow_run_id', type: 'uuid', nullable: true })
  workflowRunId?: string;

  @ManyToOne(() => WorkflowRun)
  @JoinColumn({ name: 'workflow_run_id' })
  workflowRun?: WorkflowRun;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100, nullable: true })
  correlationId?: string;

  @Column({ name: 'requestor_comments', type: 'text', nullable: true })
  requestorComments?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
