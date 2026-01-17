import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser } from '@hubblewave/auth-guard';
import { WorkflowInstanceService } from './workflow-instance.service';
import { StartWorkflowRequest } from './workflow.types';
import { WorkflowApprovalService } from './workflow-approval.service';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowInstancesController {
  constructor(
    private readonly instances: WorkflowInstanceService,
    private readonly approvals: WorkflowApprovalService,
  ) {}

  @Get('instances')
  async list(
    @Query('state') state?: string,
    @Query('processFlowId') processFlowId?: string,
    @Query('collectionId') collectionId?: string,
    @Query('recordId') recordId?: string,
  ) {
    return this.instances.list({ state, processFlowId, collectionId, recordId });
  }

  @Get('instances/:id')
  async getById(@Param('id') id: string) {
    return this.instances.getById(id);
  }

  @Get('instances/:id/history')
  async getHistory(@Param('id') id: string) {
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
