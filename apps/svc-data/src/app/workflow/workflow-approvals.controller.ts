import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser } from '@hubblewave/auth-guard';
import { WorkflowApprovalsService } from './workflow-approvals.service';

@Controller('workflows/approvals')
@UseGuards(JwtAuthGuard)
export class WorkflowApprovalsController {
  constructor(private readonly approvals: WorkflowApprovalsService) {}

  @Get('pending')
  async getPending(@CurrentUser() user: RequestUser) {
    return this.approvals.findPendingForUser(user.id);
  }

  @Get('by-instance')
  async getByInstance(
    @CurrentUser() user: RequestUser,
    @Query('processFlowInstanceId') processFlowInstanceId?: string,
  ) {
    if (!processFlowInstanceId) {
      return [];
    }
    const approvals = await this.approvals.findByInstance(processFlowInstanceId);
    // Ownership check: only show approvals where the caller is approver, delegate,
    // or responder. Admins see all.
    if (user.roles?.includes('admin')) {
      return approvals;
    }
    return approvals.filter(
      (a) =>
        a.approverId === user.id ||
        a.delegatedTo === user.id ||
        a.respondedBy === user.id,
    );
  }

  @Get(':id')
  async getById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const approval = await this.approvals.findById(id);
    // Ownership check: only the assigned approver, delegate, or responder may read.
    const isOwner =
      approval.approverId === user.id ||
      approval.delegatedTo === user.id ||
      approval.respondedBy === user.id;
    if (!isOwner && !user.roles?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
    return approval;
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
