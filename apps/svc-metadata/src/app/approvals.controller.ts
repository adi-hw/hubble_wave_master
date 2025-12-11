import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RequestContext, RolesGuard, Roles } from '@eam-platform/auth-guard';
import {
  TenantDbService,
  ApprovalType,
  ApprovalRequest,
  ApprovalAssignment,
  ApprovalHistory,
} from '@eam-platform/tenant-db';
import type {
  ApprovalMode,
  RequireComments,
  ApprovalRequestStatus,
  ApprovalAssignmentStatus,
  ApprovalHistoryAction,
} from '@eam-platform/tenant-db';

interface CreateApprovalTypeDto {
  code: string;
  name: string;
  description?: string;
  targetTable?: string;
  triggerConditions?: Record<string, any>;
  approvalMode: ApprovalMode;
  quorumPercentage?: number;
  hierarchyLevels?: number;
  approverConfig: Record<string, any>;
  responseOptions?: any[];
  requireComments?: RequireComments;
  allowDelegate?: boolean;
  allowRecall?: boolean;
  escalationConfig?: Record<string, any>;
  slaHours?: number;
  slaWarningHours?: number;
  notificationConfig?: Record<string, any>;
  isActive?: boolean;
}

interface ApprovalDecisionDto {
  response: string;
  responseComments?: string;
  delegateTo?: string;
}

@Controller('admin/approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class ApprovalsController {
  constructor(private readonly tenantDb: TenantDbService) {}

  // ========== Approval Types ==========

  @Get('types')
  async listApprovalTypes(
    @Query('targetTable') targetTable: string,
    @Query('active') active: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ApprovalType>(ctx.tenantId, ApprovalType);

    const where: any = {};
    if (targetTable) where.targetTable = targetTable;
    if (active !== undefined) where.isActive = active === 'true';

    const types = await repo.find({
      where,
      order: { code: 'ASC' },
    });

    return { items: types };
  }

  @Get('types/:id')
  async getApprovalType(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ApprovalType>(ctx.tenantId, ApprovalType);
    const type = await repo.findOne({ where: { id } });

    if (!type) {
      throw new NotFoundException('Approval type not found');
    }

    return type;
  }

  @Post('types')
  async createApprovalType(@Body() body: CreateApprovalTypeDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ApprovalType>(ctx.tenantId, ApprovalType);

    // Check for duplicate code
    const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
    if (existing) {
      throw new ForbiddenException(`Approval type with code "${body.code}" already exists`);
    }

    const type = repo.create({
      tenantId: ctx.tenantId,
      code: body.code,
      name: body.name,
      description: body.description,
      targetTable: body.targetTable,
      triggerConditions: body.triggerConditions,
      approvalMode: body.approvalMode || 'sequential',
      quorumPercentage: body.quorumPercentage,
      hierarchyLevels: body.hierarchyLevels,
      approverConfig: body.approverConfig,
      responseOptions: body.responseOptions || [
        { code: 'approved', label: 'Approve' },
        { code: 'rejected', label: 'Reject' },
      ],
      requireComments: body.requireComments || 'on_reject',
      allowDelegate: body.allowDelegate !== false,
      allowRecall: body.allowRecall !== false,
      escalationConfig: body.escalationConfig,
      slaHours: body.slaHours,
      slaWarningHours: body.slaWarningHours,
      notificationConfig: body.notificationConfig || {
        onRequest: true,
        onApprove: true,
        onReject: true,
        onEscalate: true,
      },
      source: 'tenant' as const,
      isActive: body.isActive !== false,
      createdBy: ctx.userId,
    });

    return repo.save(type);
  }

  @Patch('types/:id')
  async updateApprovalType(
    @Param('id') id: string,
    @Body() body: Partial<CreateApprovalTypeDto>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ApprovalType>(ctx.tenantId, ApprovalType);
    const type = await repo.findOne({ where: { id } });

    if (!type) {
      throw new NotFoundException('Approval type not found');
    }

    // Check for duplicate code if changing
    if (body.code && body.code !== type.code) {
      const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
      if (existing) {
        throw new ForbiddenException(`Approval type with code "${body.code}" already exists`);
      }
    }

    const updated = repo.merge(type, {
      ...body,
      updatedBy: ctx.userId,
    });
    return repo.save(updated);
  }

  @Delete('types/:id')
  async deleteApprovalType(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ApprovalType>(ctx.tenantId, ApprovalType);
    const type = await repo.findOne({ where: { id } });

    if (!type) {
      throw new NotFoundException('Approval type not found');
    }

    await repo.remove(type);
    return { success: true };
  }

  // ========== Approval Requests ==========

  @Get('requests')
  async listApprovalRequests(
    @Query('typeId') typeId: string,
    @Query('status') status: string,
    @Query('requestedBy') requestedBy: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ApprovalRequest>(ctx.tenantId, ApprovalRequest);

    const where: any = { tenantId: ctx.tenantId };
    if (typeId) where.approvalTypeId = typeId;
    if (status) where.status = status;
    if (requestedBy) where.requestedBy = requestedBy;

    const requests = await repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: parseInt(limit, 10) || 50,
      skip: parseInt(offset, 10) || 0,
    });

    return { items: requests };
  }

  @Get('requests/:id')
  async getApprovalRequest(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ApprovalRequest>(ctx.tenantId, ApprovalRequest);
    const request = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    // Get assignments
    const assignmentRepo = await this.tenantDb.getRepository<ApprovalAssignment>(
      ctx.tenantId,
      ApprovalAssignment,
    );
    const assignments = await assignmentRepo.find({
      where: { approvalRequestId: id },
      order: { sequenceOrder: 'ASC', createdAt: 'ASC' },
    });

    // Get history
    const historyRepo = await this.tenantDb.getRepository<ApprovalHistory>(
      ctx.tenantId,
      ApprovalHistory,
    );
    const history = await historyRepo.find({
      where: { approvalRequestId: id },
      order: { actionAt: 'ASC' },
    });

    return {
      ...request,
      assignments,
      history,
    };
  }

  @Post('requests')
  async createApprovalRequest(
    @Body()
    body: {
      approvalTypeId: string;
      targetTable: string;
      targetRecordId: string;
      title: string;
      description?: string;
      requestedAction?: string;
      targetRecordSnapshot?: Record<string, any>;
      changesSummary?: Record<string, any>;
      requestorComments?: string;
    },
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;

    // Get approval type
    const typeRepo = await this.tenantDb.getRepository<ApprovalType>(ctx.tenantId, ApprovalType);
    const type = await typeRepo.findOne({ where: { id: body.approvalTypeId } });

    if (!type) {
      throw new NotFoundException('Approval type not found');
    }

    if (!type.isActive) {
      throw new ForbiddenException('Approval type is not active');
    }

    // Create request
    const requestRepo = await this.tenantDb.getRepository<ApprovalRequest>(
      ctx.tenantId,
      ApprovalRequest,
    );

    const request = requestRepo.create({
      tenantId: ctx.tenantId,
      approvalTypeId: body.approvalTypeId,
      targetTable: body.targetTable,
      targetRecordId: body.targetRecordId,
      title: body.title,
      description: body.description,
      requestedAction: body.requestedAction as any,
      targetRecordSnapshot: body.targetRecordSnapshot,
      changesSummary: body.changesSummary,
      requestorComments: body.requestorComments,
      status: 'pending' as ApprovalRequestStatus,
      requestedBy: ctx.userId,
    });

    const savedRequest = await requestRepo.save(request);

    // Create initial assignments based on approver config
    const assignmentRepo = await this.tenantDb.getRepository<ApprovalAssignment>(
      ctx.tenantId,
      ApprovalAssignment,
    );

    // Get approvers from config - simplified for now
    const approverConfig = type.approverConfig || {};
    const approvers = approverConfig.approvers || [];

    for (let i = 0; i < approvers.length; i++) {
      const approver = approvers[i];
      const assignment = assignmentRepo.create({
        approvalRequestId: savedRequest.id,
        approverId: approver.userId || approver.id,
        approverRole: approver.role,
        sequenceOrder: i,
        status: 'pending' as ApprovalAssignmentStatus,
      });
      await assignmentRepo.save(assignment);
    }

    // Log creation in history
    const historyRepo = await this.tenantDb.getRepository<ApprovalHistory>(
      ctx.tenantId,
      ApprovalHistory,
    );
    const history = historyRepo.create({
      approvalRequestId: savedRequest.id,
      action: 'created' as ApprovalHistoryAction,
      actionBy: ctx.userId,
      actionData: { title: body.title },
    });
    await historyRepo.save(history);

    return savedRequest;
  }

  @Post('requests/:id/respond')
  async respondToApprovalRequest(
    @Param('id') id: string,
    @Body() body: ApprovalDecisionDto,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;

    const requestRepo = await this.tenantDb.getRepository<ApprovalRequest>(
      ctx.tenantId,
      ApprovalRequest,
    );
    const request = await requestRepo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    if (request.status !== 'pending' && request.status !== 'in_progress') {
      throw new ForbiddenException('Approval request is no longer pending');
    }

    // Get user's assignment
    const assignmentRepo = await this.tenantDb.getRepository<ApprovalAssignment>(
      ctx.tenantId,
      ApprovalAssignment,
    );
    const assignment = await assignmentRepo.findOne({
      where: {
        approvalRequestId: id,
        approverId: ctx.userId,
        status: 'pending' as ApprovalAssignmentStatus,
      },
    });

    if (!assignment) {
      throw new ForbiddenException('You are not assigned to approve this request');
    }

    // Handle delegation
    if (body.delegateTo) {
      assignment.status = 'delegated';
      assignment.delegatedTo = body.delegateTo;
      assignment.delegatedAt = new Date();
      assignment.delegationReason = body.responseComments;
      await assignmentRepo.save(assignment);

      // Create new assignment for delegate
      const newAssignment = assignmentRepo.create({
        approvalRequestId: id,
        approverId: body.delegateTo,
        sequenceOrder: assignment.sequenceOrder,
        status: 'pending' as ApprovalAssignmentStatus,
      });
      await assignmentRepo.save(newAssignment);

      // Log delegation
      const historyRepo = await this.tenantDb.getRepository<ApprovalHistory>(
        ctx.tenantId,
        ApprovalHistory,
      );
      await historyRepo.save(
        historyRepo.create({
          approvalRequestId: id,
          assignmentId: assignment.id,
          action: 'delegated' as ApprovalHistoryAction,
          actionBy: ctx.userId,
          actionData: { delegatedTo: body.delegateTo, reason: body.responseComments },
        }),
      );

      return { requestId: id, action: 'delegated', delegatedTo: body.delegateTo };
    }

    // Update assignment with response
    assignment.status = 'responded';
    assignment.response = body.response;
    assignment.responseComments = body.responseComments;
    assignment.respondedAt = new Date();
    await assignmentRepo.save(assignment);

    // Record history
    const historyRepo = await this.tenantDb.getRepository<ApprovalHistory>(
      ctx.tenantId,
      ApprovalHistory,
    );
    await historyRepo.save(
      historyRepo.create({
        approvalRequestId: id,
        assignmentId: assignment.id,
        action: 'responded' as ApprovalHistoryAction,
        actionBy: ctx.userId,
        actionData: { response: body.response, comments: body.responseComments },
      }),
    );

    // Check if all assignments are complete
    const allAssignments = await assignmentRepo.find({
      where: { approvalRequestId: id },
    });

    const pendingCount = allAssignments.filter(
      (a) => a.status === 'pending' || a.status === 'notified',
    ).length;
    const approvedCount = allAssignments.filter(
      (a) => a.status === 'responded' && a.response === 'approved',
    ).length;
    const rejectedCount = allAssignments.filter(
      (a) => a.status === 'responded' && a.response === 'rejected',
    ).length;

    // Determine final status
    if (rejectedCount > 0) {
      request.status = 'rejected';
      request.finalResponse = 'rejected';
      request.finalResponseAt = new Date();
      request.finalResponderId = ctx.userId;
    } else if (pendingCount === 0 && approvedCount > 0) {
      request.status = 'approved';
      request.finalResponse = 'approved';
      request.finalResponseAt = new Date();
      request.finalResponderId = ctx.userId;
    } else if (pendingCount > 0) {
      request.status = 'in_progress';
    }

    await requestRepo.save(request);

    return {
      requestId: id,
      response: body.response,
      newStatus: request.status,
    };
  }

  @Post('requests/:id/cancel')
  async cancelApprovalRequest(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;

    const repo = await this.tenantDb.getRepository<ApprovalRequest>(ctx.tenantId, ApprovalRequest);
    const request = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    if (request.status !== 'pending' && request.status !== 'in_progress') {
      throw new ForbiddenException('Approval request cannot be cancelled');
    }

    // Only requester or admin can cancel
    if (request.requestedBy !== ctx.userId && !ctx.isTenantAdmin && !ctx.isPlatformAdmin) {
      throw new ForbiddenException('Only the requester or an admin can cancel this request');
    }

    request.status = 'cancelled';
    request.finalResponse = 'cancelled';
    request.finalResponseAt = new Date();
    request.finalResponderId = ctx.userId;

    // Record history
    const historyRepo = await this.tenantDb.getRepository<ApprovalHistory>(
      ctx.tenantId,
      ApprovalHistory,
    );
    await historyRepo.save(
      historyRepo.create({
        approvalRequestId: id,
        action: 'cancelled' as ApprovalHistoryAction,
        actionBy: ctx.userId,
        actionData: { reason: body.reason },
      }),
    );

    await repo.save(request);

    return { success: true, status: 'cancelled' };
  }

  // ========== My Approvals (for current user) ==========

  @Get('my-pending')
  async getMyPendingApprovals(@Query('limit') limit: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;

    const assignmentRepo = await this.tenantDb.getRepository<ApprovalAssignment>(
      ctx.tenantId,
      ApprovalAssignment,
    );

    const assignments = await assignmentRepo.find({
      where: {
        approverId: ctx.userId,
        status: 'pending' as ApprovalAssignmentStatus,
      },
      order: { createdAt: 'ASC' },
      take: parseInt(limit, 10) || 50,
    });

    // Fetch associated requests
    const requestIds = assignments.map((a) => a.approvalRequestId);
    if (requestIds.length === 0) {
      return { items: [] };
    }

    const requestRepo = await this.tenantDb.getRepository<ApprovalRequest>(
      ctx.tenantId,
      ApprovalRequest,
    );

    const requests = await requestRepo
      .createQueryBuilder('request')
      .where('request.id IN (:...ids)', { ids: requestIds })
      .getMany();

    const requestMap = new Map(requests.map((r) => [r.id, r]));

    return {
      items: assignments.map((a) => ({
        assignment: a,
        request: requestMap.get(a.approvalRequestId),
      })),
    };
  }
}
