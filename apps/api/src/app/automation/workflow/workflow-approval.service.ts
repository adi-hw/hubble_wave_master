import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Approval, ApprovalStatus, ApprovalType, AuditLog, User } from '@hubblewave/instance-db';
import { WorkflowAuditService } from './workflow-audit.service';

const DEFAULT_APPROVAL_TYPE: ApprovalType = 'sequential';
// Delegation forms a chain: A delegates to B, B delegates to C, ...
// Capping the depth prevents runaway chains and the cycle check prevents
// approvers from delegating back to a prior link in the same chain.
const MAX_DELEGATION_DEPTH = 3;

@Injectable()
export class WorkflowApprovalService {
  constructor(
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
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

  async approve(id: string, actorId: string, comments?: string, isAdmin = false) {
    return this.updateStatus(id, actorId, 'approved', comments, isAdmin);
  }

  async reject(id: string, actorId: string, comments?: string, isAdmin = false) {
    return this.updateStatus(id, actorId, 'rejected', comments, isAdmin);
  }

  async delegate(id: string, delegatedTo: string, actorId: string, reason?: string, isAdmin = false) {
    const approval = await this.findById(id);
    this.assertActorAuthorized(approval, actorId, isAdmin);

    if (!delegatedTo) {
      throw new BadRequestException('delegatedTo is required');
    }
    if (delegatedTo === actorId) {
      throw new BadRequestException('Cannot delegate an approval to yourself');
    }

    const delegate = await this.userRepo.findOne({ where: { id: delegatedTo } });
    if (!delegate || delegate.status !== 'active' || delegate.deletedAt) {
      throw new BadRequestException(`Unknown or inactive delegate: ${delegatedTo}`);
    }

    // Walk the existing chain on this approval and reject if appending would
    // exceed the depth budget or revisit a participant (cycle). The chain is
    // reconstructed from immutable audit log entries — every prior delegate
    // action on this approval contributes one link.
    const chain = await this.readDelegationChain(approval.id);
    if (chain.length >= MAX_DELEGATION_DEPTH) {
      throw new BadRequestException(
        `Delegation depth limit reached (max ${MAX_DELEGATION_DEPTH})`,
      );
    }
    if (chain.includes(delegatedTo) || delegatedTo === approval.approverId) {
      throw new BadRequestException('Delegation would create a cycle');
    }

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

  private async readDelegationChain(approvalId: string): Promise<string[]> {
    // Each delegation on the same approval row produces one audit row with
    // action='approval.delegate'. The actor of each entry is the link in the
    // chain; we order by createdAt ascending so the returned array reads
    // earliest-first.
    const entries = await this.auditRepo.find({
      where: { recordId: approvalId, action: 'approval.delegate' },
      order: { createdAt: 'ASC' },
      select: ['userId', 'createdAt'],
    });
    return entries
      .map((e) => e.userId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
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

    // Dedupe — duplicate approverIds would create redundant Approval rows
    // with conflicting sequence numbers.
    const uniqueApprovers = Array.from(new Set((payload.approvers || []).filter(Boolean)));
    if (uniqueApprovers.length === 0) {
      throw new BadRequestException('Approval node has no approvers');
    }

    // Validate every approver resolves to an active user before persisting.
    const users = await this.userRepo.find({
      where: uniqueApprovers.map((id) => ({ id })),
      select: ['id', 'status', 'deletedAt'],
    });
    const activeIds = new Set(
      users.filter((u) => u.status === 'active' && !u.deletedAt).map((u) => u.id),
    );
    for (const approverId of uniqueApprovers) {
      if (!activeIds.has(approverId)) {
        throw new BadRequestException(`Unknown approver: ${approverId}`);
      }
    }

    const approvals = uniqueApprovers.map((approverId, index) =>
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
    isAdmin = false,
  ) {
    const approval = await this.findById(id);
    this.assertActorAuthorized(approval, actorId, isAdmin);
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

  private assertActorAuthorized(approval: Approval, actorId: string, isAdmin: boolean) {
    // Only the assigned approver, the delegate, or an admin may act on an approval.
    const isAuthorized =
      isAdmin ||
      approval.approverId === actorId ||
      approval.delegatedTo === actorId;
    if (!isAuthorized) {
      throw new ForbiddenException('Not the owner');
    }
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
