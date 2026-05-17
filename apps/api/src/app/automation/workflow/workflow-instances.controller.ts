import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  AuthenticatedOnly,
  CurrentUser,
  JwtAuthGuard,
  RequestUser,
} from '@hubblewave/auth-guard';
import { WorkflowInstanceService } from './workflow-instance.service';
import { StartWorkflowRequest } from './workflow.types';
import { WorkflowApprovalService } from './workflow-approval.service';

/**
 * Canon §28 / W2 Stream 3 Task 24 — workflow instance + task
 * operations. Users start their own workflows, list/inspect instances
 * they started, and act on tasks assigned to them. The service-layer
 * `user.roleCodes?.includes('admin')` admin-override branches preserve
 * the prior admin-can-see-everything semantics distinct from the
 * route-level authentication gate.
 */
@AuthenticatedOnly()
@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowInstancesController {
  constructor(
    private readonly instances: WorkflowInstanceService,
    private readonly approvals: WorkflowApprovalService,
  ) {}

  @Get('instances')
  async list(
    @CurrentUser() user: RequestUser,
    @Query('state') state?: string,
    @Query('processFlowId') processFlowId?: string,
    @Query('collectionId') collectionId?: string,
    @Query('recordId') recordId?: string,
  ) {
    const all = await this.instances.list({ state, processFlowId, collectionId, recordId });
    // Scope listing: non-admins only see workflow instances they started.
    if (user.roleCodes?.includes('admin')) {
      return all;
    }
    return all.filter((i) => i.startedBy === user.id);
  }

  @Get('instances/:id')
  async getById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const instance = await this.instances.getById(id);
    if (instance.startedBy !== user.id && !user.roleCodes?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
    return instance;
  }

  @Get('instances/:id/history')
  async getHistory(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const instance = await this.instances.getById(id);
    if (instance.startedBy !== user.id && !user.roleCodes?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
    return this.instances.getHistory(id);
  }

  @Get('tasks')
  async listTasks(@CurrentUser() user: RequestUser) {
    return this.approvals.findPendingForUser(user.id);
  }

  @Post('definitions/:id/start')
  async start(
    @Param('id') definitionId: string,
    @Body() body: StartWorkflowRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.instances.start(definitionId, body, user?.id);
  }

  @Post('instances/:id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.instances.cancel(id, user?.id);
  }
}
