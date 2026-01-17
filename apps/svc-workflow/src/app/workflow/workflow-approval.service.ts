import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Approval, ApprovalStatus, ApprovalType } from '@hubblewave/instance-db';
import { WorkflowAuditService } from './workflow-audit.service';

const DEFAULT_APPROVAL_TYPE: ApprovalType = 'sequential';

@Injectable()
export class WorkflowApprovalService {
  constructor(
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: WorkflowAuditService,
  ) {}

  async findPendingForUser(userId: string) {
    return this.approvalRepo.find({
      where: { approverId: userId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
  }

  async findByInstance(processFlowInstanceId: string) {
    return this.approvalRepo.find({
      where: { processFlowInstanceId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string) {
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) {
      throw new NotFoundException('Approval not found');
    }
    return approval;
  }

  async approve(id: string, actorId: string, comments?: string) {
    return this.updateStatus(id, actorId, 'approved', comments);
  }

  async reject(id: string, actorId: string, comments?: string) {
    return this.updateStatus(id, actorId, 'rejected', comments);
  }

  async delegate(id: string, delegatedTo: string, actorId: string, reason?: string) {
    const approval = await this.findById(id);
    const previous = this.auditValues(approval);
    approval.status = 'delegated';
    approval.delegatedTo = delegatedTo;
    approval.delegatedAt = new Date();
    approval.delegationReason = reason || undefined;
    approval.respondedBy = actorId;
    approval.respondedAt = new Date();
    await this.approvalRepo.save(approval);

    await this.auditService.record({
      actorId,
      action: 'approval.delegate',
      recordId: approval.id,
      oldValues: previous,
      newValues: this.auditValues(approval),
    });

    this.eventEmitter.emit('approval.completed', {
      approvalId: approval.id,
      status: approval.status,
    });

    return approval;
  }

  @OnEvent('approval.create')
  async handleApprovalCreate(payload: {
    processFlowInstanceId: string;
    nodeId: string;
    approvers: string[];
    approvalType?: ApprovalType;
    timeoutMinutes?: number;
    context?: Record<string, unknown>;
  }) {
    const approvalType = payload.approvalType || DEFAULT_APPROVAL_TYPE;
    const now = new Date();
    const dueDate = payload.timeoutMinutes
      ? new Date(now.getTime() + payload.timeoutMinutes * 60 * 1000)
      : undefined;

    const approvals = payload.approvers.map((approverId, index) =>
      this.approvalRepo.create({
        processFlowInstanceId: payload.processFlowInstanceId,
        nodeId: payload.nodeId,
        approverId,
        approverType: 'user',
        status: 'pending',
        approvalType,
        sequenceNumber: index + 1,
        dueDate: dueDate || undefined,
      } as Partial<Approval>)
    );

    const saved = await this.approvalRepo.save(approvals);

    this.eventEmitter.emit('approval.pending', {
      processFlowInstanceId: payload.processFlowInstanceId,
      nodeId: payload.nodeId,
      approvals: saved.map((a) => ({ id: a.id, approverId: a.approverId })),
    });
  }

  private async updateStatus(
    id: string,
    actorId: string,
    status: ApprovalStatus,
    comments?: string,
  ) {
    const approval = await this.findById(id);
    const previous = this.auditValues(approval);

    approval.status = status;
    approval.comments = comments || undefined;
    approval.respondedBy = actorId;
    approval.respondedAt = new Date();
    await this.approvalRepo.save(approval);

    await this.auditService.record({
      actorId,
      action: `approval.${status}`,
      recordId: approval.id,
      oldValues: previous,
      newValues: this.auditValues(approval),
    });

    this.eventEmitter.emit('approval.response', {
      processFlowInstanceId: approval.processFlowInstanceId,
      nodeId: approval.nodeId,
      approved: status === 'approved',
      approver: actorId,
      comments,
    });

    this.eventEmitter.emit('approval.completed', {
      approvalId: approval.id,
      status: approval.status,
    });

    return approval;
  }

  private auditValues(approval: Approval) {
    return {
      id: approval.id,
      processFlowInstanceId: approval.processFlowInstanceId,
      nodeId: approval.nodeId,
      approverId: approval.approverId,
      status: approval.status,
      approvalType: approval.approvalType,
      respondedAt: approval.respondedAt,
      delegatedTo: approval.delegatedTo,
    };
  }
}
