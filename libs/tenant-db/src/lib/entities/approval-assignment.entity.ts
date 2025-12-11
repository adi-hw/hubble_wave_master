import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';

export type ApprovalAssignmentStatus = 'pending' | 'notified' | 'viewed' | 'responded' | 'delegated' | 'skipped' | 'expired';

@Entity('approval_assignment')
@Index(['approverId', 'status'])
@Index(['approvalRequestId'])
export class ApprovalAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'approval_request_id', type: 'uuid' })
  approvalRequestId!: string;

  @ManyToOne(() => ApprovalRequest)
  @JoinColumn({ name: 'approval_request_id' })
  approvalRequest?: ApprovalRequest;

  @Column({ name: 'approver_id', type: 'uuid' })
  approverId!: string;

  @Column({ name: 'approver_role', type: 'varchar', length: 100, nullable: true })
  approverRole?: string;

  @Column({ name: 'sequence_order', type: 'int', default: 0 })
  sequenceOrder!: number;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: ApprovalAssignmentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  response?: string;

  @Column({ name: 'response_comments', type: 'text', nullable: true })
  responseComments?: string;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt?: Date;

  @Column({ name: 'delegated_to', type: 'uuid', nullable: true })
  delegatedTo?: string;

  @Column({ name: 'delegated_at', type: 'timestamptz', nullable: true })
  delegatedAt?: Date;

  @Column({ name: 'delegation_reason', type: 'text', nullable: true })
  delegationReason?: string;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt?: Date;

  @Column({ name: 'first_viewed_at', type: 'timestamptz', nullable: true })
  firstViewedAt?: Date;

  @Column({ name: 'reminder_count', type: 'int', default: 0 })
  reminderCount!: number;

  @Column({ name: 'last_reminder_at', type: 'timestamptz', nullable: true })
  lastReminderAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
