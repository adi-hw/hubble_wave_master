import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { ApprovalAssignment } from './approval-assignment.entity';

export type ApprovalHistoryAction =
  | 'created' | 'assigned' | 'notified' | 'viewed' | 'responded'
  | 'delegated' | 'escalated' | 'reminded' | 'cancelled' | 'expired' | 'completed';

@Entity('approval_history')
@Index(['approvalRequestId'])
@Index(['actionAt'])
export class ApprovalHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'approval_request_id', type: 'uuid' })
  approvalRequestId!: string;

  @ManyToOne(() => ApprovalRequest)
  @JoinColumn({ name: 'approval_request_id' })
  approvalRequest?: ApprovalRequest;

  @Column({ name: 'assignment_id', type: 'uuid', nullable: true })
  assignmentId?: string;

  @ManyToOne(() => ApprovalAssignment)
  @JoinColumn({ name: 'assignment_id' })
  assignment?: ApprovalAssignment;

  @Column({ type: 'varchar', length: 50 })
  action!: ApprovalHistoryAction;

  @Column({ name: 'action_by', type: 'uuid', nullable: true })
  actionBy?: string;

  @Column({ name: 'action_data', type: 'jsonb', nullable: true })
  actionData?: Record<string, any>;

  @CreateDateColumn({ name: 'action_at', type: 'timestamptz' })
  actionAt!: Date;
}
