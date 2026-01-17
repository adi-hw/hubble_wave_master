import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser } from '@hubblewave/auth-guard';
import { WorkflowApprovalService } from './workflow-approval.service';

@Controller('workflows/approvals')
@UseGuards(JwtAuthGuard)
export class WorkflowApprovalsController {
  constructor(private readonly approvals: WorkflowApprovalService) {}

  @Get('pending')
  async getPending(@CurrentUser() user: RequestUser) {
    return this.approvals.findPendingForUser(user.id);
  }

  @Get('by-instance')
  async getByInstance(@Query('processFlowInstanceId') processFlowInstanceId?: string) {
    if (!processFlowInstanceId) {
      return [];
    }
    return this.approvals.findByInstance(processFlowInstanceId);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.approvals.findById(id);
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: { comments?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.approvals.approve(id, user.id, body.comments);
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: { comments?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.approvals.reject(id, user.id, body.comments);
  }

  @Post(':id/delegate')
  async delegate(
    @Param('id') id: string,
    @Body() body: { delegatedTo: string; reason?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.approvals.delegate(id, body.delegatedTo, user.id, body.reason);
  }
}
