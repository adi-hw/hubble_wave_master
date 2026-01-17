import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Approval, ApprovalStatus } from '@hubblewave/instance-db';

@Injectable()
export class WorkflowApprovalsService {
  constructor(
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
  ) {}

  async findPendingForUser(userId: string): Promise<Approval[]> {
    return this.approvalRepo.find({
      where: [
        { approverId: userId, status: 'pending' },
        { delegatedTo: userId, status: 'delegated' },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findByInstance(processFlowInstanceId: string): Promise<Approval[]> {
    return this.approvalRepo.find({
      where: { processFlowInstanceId },
      order: { sequenceNumber: 'ASC', createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<Approval> {
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) {
      throw new NotFoundException(`Approval ${id} not found`);
    }
    return approval;
  }

  async approve(id: string, userId: string, comments?: string): Promise<Approval> {
    const approval = await this.findById(id);
    this.validateApprovalAction(approval, userId);

    approval.status = 'approved' as ApprovalStatus;
    approval.comments = comments;
    approval.respondedAt = new Date();
    approval.respondedBy = userId;

    return this.approvalRepo.save(approval);
  }

  async reject(id: string, userId: string, comments?: string): Promise<Approval> {
    const approval = await this.findById(id);
    this.validateApprovalAction(approval, userId);

    approval.status = 'rejected' as ApprovalStatus;
    approval.comments = comments;
    approval.respondedAt = new Date();
    approval.respondedBy = userId;

    return this.approvalRepo.save(approval);
  }

  async delegate(
    id: string,
    delegatedTo: string,
    delegatedBy: string,
    reason?: string,
  ): Promise<Approval> {
    const approval = await this.findById(id);
    this.validateApprovalAction(approval, delegatedBy);

    approval.status = 'delegated' as ApprovalStatus;
    approval.delegatedTo = delegatedTo;
    approval.delegatedAt = new Date();
    approval.delegationReason = reason;

    return this.approvalRepo.save(approval);
  }

  private validateApprovalAction(approval: Approval, userId: string): void {
    const canAct =
      approval.approverId === userId ||
      (approval.status === 'delegated' && approval.delegatedTo === userId);

    if (!canAct) {
      throw new ForbiddenException('User is not authorized to act on this approval');
    }

    if (!['pending', 'delegated'].includes(approval.status)) {
      throw new ForbiddenException(`Approval is not in an actionable state: ${approval.status}`);
    }
  }
}
