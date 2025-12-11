import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, TenantId } from '@eam-platform/auth-guard';
import { WorkflowService } from './workflow.service';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.workflowService.listWorkflows(tenantId);
  }

  @Get(':id')
  get(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.workflowService.getWorkflow(id, tenantId);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body() body: { name: string; slug: string; description?: string; triggerType?: any; triggerConfig?: any; steps?: any[] }
  ) {
    return this.workflowService.createWorkflow(tenantId, body);
  }

  @Post(':id/trigger')
  trigger(@Param('id') id: string, @TenantId() tenantId: string, @Body() body: { payload?: any }) {
    return this.workflowService.trigger(tenantId, id, body?.payload ?? {});
  }
}
