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
  WorkflowDefinition,
  WorkflowStepType,
  WorkflowRun,
  WorkflowStepExecution,
} from '@eam-platform/tenant-db';
import type {
  TriggerType,
  ExecutionMode,
  WorkflowCategory,
  WorkflowRunStatus,
} from '@eam-platform/tenant-db';

interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface CreateWorkflowDto {
  code: string;
  name: string;
  description?: string;
  category?: WorkflowCategory;
  triggerType: TriggerType;
  triggerConfig: Record<string, any>;
  steps: WorkflowStep[];
  canvasLayout?: Record<string, any>;
  inputSchema?: Record<string, any>;
  variables?: Record<string, any>;
  executionMode?: ExecutionMode;
  timeoutMinutes?: number;
  isActive?: boolean;
}

@Controller('admin/workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class WorkflowsController {
  constructor(private readonly tenantDb: TenantDbService) {}

  // ========== Workflow Step Types ==========

  @Get('step-types')
  async listStepTypes(@Query('category') category: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowStepType>(
      ctx.tenantId,
      WorkflowStepType,
    );

    const where: any = {};
    if (category) where.category = category;

    const types = await repo.find({
      where,
      order: { category: 'ASC', name: 'ASC' },
    });

    return { items: types };
  }

  // ========== Workflows ==========

  @Get()
  async listWorkflows(
    @Query('category') category: string,
    @Query('triggerType') triggerType: string,
    @Query('active') active: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);

    const where: any = {};
    if (category) where.category = category;
    if (triggerType) where.triggerType = triggerType;
    if (active !== undefined) where.isActive = active === 'true';

    const workflows = await repo.find({
      where,
      order: { category: 'ASC', name: 'ASC' },
    });

    // Get execution counts for each workflow
    const runRepo = await this.tenantDb.getRepository<WorkflowRun>(
      ctx.tenantId,
      WorkflowRun,
    );

    const workflowsWithStats = await Promise.all(
      workflows.map(async (wf) => {
        const totalRuns = await runRepo.count({
          where: { workflowId: wf.id, tenantId: ctx.tenantId },
        });
        const failedRuns = await runRepo.count({
          where: { workflowId: wf.id, tenantId: ctx.tenantId, status: 'failed' as WorkflowRunStatus },
        });
        return {
          ...wf,
          stats: {
            totalRuns,
            failedRuns,
          },
        };
      }),
    );

    return { items: workflowsWithStats };
  }

  @Get(':id')
  async getWorkflow(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);
    const workflow = await repo.findOne({ where: { id } });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  @Post()
  async createWorkflow(@Body() body: CreateWorkflowDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);

    // Check for duplicate code
    const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
    if (existing) {
      throw new ForbiddenException(`Workflow with code "${body.code}" already exists`);
    }

    // Validate workflow structure
    this.validateWorkflow(body.steps);

    // Generate slug from name
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const workflow = repo.create({
      tenantId: ctx.tenantId,
      code: body.code,
      name: body.name,
      slug: `${slug}-${Date.now()}`,
      description: body.description,
      category: body.category,
      triggerType: body.triggerType,
      triggerConfig: body.triggerConfig,
      steps: body.steps,
      canvasLayout: body.canvasLayout,
      inputSchema: body.inputSchema,
      variables: body.variables,
      executionMode: body.executionMode || 'async',
      timeoutMinutes: body.timeoutMinutes || 60,
      errorHandling: 'stop',
      source: 'tenant' as const,
      status: 'active',
      isActive: body.isActive !== false,
      isSystem: false,
      createdBy: ctx.userId,
    });

    return repo.save(workflow);
  }

  @Patch(':id')
  async updateWorkflow(
    @Param('id') id: string,
    @Body() body: Partial<CreateWorkflowDto>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);
    const workflow = await repo.findOne({ where: { id } });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (workflow.isSystem) {
      throw new ForbiddenException('Cannot modify system workflows');
    }

    // Check for duplicate code if changing
    if (body.code && body.code !== workflow.code) {
      const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
      if (existing) {
        throw new ForbiddenException(`Workflow with code "${body.code}" already exists`);
      }
    }

    // Validate if steps are being updated
    if (body.steps) {
      this.validateWorkflow(body.steps);
    }

    // Build update object with proper typing
    const updateData: Partial<WorkflowDefinition> = {
      updatedBy: ctx.userId,
    };

    if (body.code !== undefined) updateData.code = body.code;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.triggerType !== undefined) updateData.triggerType = body.triggerType;
    if (body.triggerConfig !== undefined) updateData.triggerConfig = body.triggerConfig;
    if (body.steps !== undefined) updateData.steps = body.steps;
    if (body.canvasLayout !== undefined) updateData.canvasLayout = body.canvasLayout;
    if (body.inputSchema !== undefined) updateData.inputSchema = body.inputSchema;
    if (body.variables !== undefined) updateData.variables = body.variables;
    if (body.executionMode !== undefined) updateData.executionMode = body.executionMode;
    if (body.timeoutMinutes !== undefined) updateData.timeoutMinutes = body.timeoutMinutes;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = repo.merge(workflow, updateData);
    return repo.save(updated);
  }

  @Delete(':id')
  async deleteWorkflow(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);
    const workflow = await repo.findOne({ where: { id } });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (workflow.isSystem) {
      throw new ForbiddenException('Cannot delete system workflows');
    }

    // Soft delete
    workflow.deletedAt = new Date();
    workflow.isActive = false;
    await repo.save(workflow);

    return { success: true };
  }

  @Post(':id/toggle')
  async toggleWorkflow(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);
    const workflow = await repo.findOne({ where: { id } });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    workflow.isActive = !workflow.isActive;
    workflow.status = workflow.isActive ? 'active' : 'inactive';
    workflow.updatedBy = ctx.userId;

    return repo.save(workflow);
  }

  // ========== Workflow Runs ==========

  @Get(':id/runs')
  async listRuns(
    @Param('id') id: string,
    @Query('status') status: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowRun>(
      ctx.tenantId,
      WorkflowRun,
    );

    const where: any = { workflowId: id, tenantId: ctx.tenantId };
    if (status) where.status = status;

    const runs = await repo.find({
      where,
      order: { startedAt: 'DESC' },
      take: parseInt(limit, 10) || 50,
      skip: parseInt(offset, 10) || 0,
    });

    return { items: runs };
  }

  @Get('runs/:runId')
  async getRun(@Param('runId') runId: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowRun>(
      ctx.tenantId,
      WorkflowRun,
    );
    const run = await repo.findOne({ where: { id: runId, tenantId: ctx.tenantId } });

    if (!run) {
      throw new NotFoundException('Workflow run not found');
    }

    // Get step executions
    const stepRepo = await this.tenantDb.getRepository<WorkflowStepExecution>(
      ctx.tenantId,
      WorkflowStepExecution,
    );
    const stepExecutions = await stepRepo.find({
      where: { runId },
      order: { startedAt: 'ASC' },
    });

    return {
      ...run,
      stepExecutions,
    };
  }

  @Post(':id/execute')
  async executeWorkflow(
    @Param('id') id: string,
    @Body() body: { inputData?: Record<string, any>; correlationId?: string },
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const workflowRepo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);
    const workflow = await workflowRepo.findOne({ where: { id } });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (!workflow.isActive) {
      throw new ForbiddenException('Workflow is not active');
    }

    // Create run record
    const runRepo = await this.tenantDb.getRepository<WorkflowRun>(
      ctx.tenantId,
      WorkflowRun,
    );

    const run = runRepo.create({
      tenantId: ctx.tenantId,
      workflowId: id,
      triggerType: 'manual',
      triggeredBy: ctx.userId,
      status: 'running' as WorkflowRunStatus,
      currentStepId: this.findStartStep(workflow.steps as WorkflowStep[])?.id,
      inputData: body.inputData,
      contextData: {},
      correlationId: body.correlationId,
      startedAt: new Date(),
    });

    const savedRun = await runRepo.save(run);

    // In a real implementation, this would queue the workflow for async processing
    // For now, we simulate execution
    const result = await this.simulateExecution(
      ctx,
      workflow,
      savedRun,
      body.inputData || {},
    );

    return {
      runId: savedRun.id,
      status: result.status,
      message: result.message,
    };
  }

  @Post('runs/:runId/cancel')
  async cancelRun(@Param('runId') runId: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowRun>(
      ctx.tenantId,
      WorkflowRun,
    );
    const run = await repo.findOne({ where: { id: runId, tenantId: ctx.tenantId } });

    if (!run) {
      throw new NotFoundException('Workflow run not found');
    }

    if (run.status !== 'running' && run.status !== 'waiting' && run.status !== 'paused') {
      throw new ForbiddenException('Run is not in a cancellable state');
    }

    run.status = 'cancelled';
    run.completedAt = new Date();

    await repo.save(run);

    return { success: true, status: 'cancelled' };
  }

  @Post('runs/:runId/retry')
  async retryRun(@Param('runId') runId: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<WorkflowRun>(
      ctx.tenantId,
      WorkflowRun,
    );
    const run = await repo.findOne({ where: { id: runId, tenantId: ctx.tenantId } });

    if (!run) {
      throw new NotFoundException('Workflow run not found');
    }

    if (run.status !== 'failed') {
      throw new ForbiddenException('Can only retry failed runs');
    }

    // Create new run based on the failed one
    const workflowRepo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);
    const workflow = await workflowRepo.findOne({ where: { id: run.workflowId } });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    const newRun = repo.create({
      tenantId: ctx.tenantId,
      workflowId: run.workflowId,
      triggerType: 'manual',
      triggeredBy: ctx.userId,
      status: 'running' as WorkflowRunStatus,
      currentStepId: this.findStartStep(workflow.steps as WorkflowStep[])?.id,
      inputData: run.inputData,
      contextData: {},
      parentRunId: runId,
      correlationId: run.correlationId,
      retryCount: run.retryCount + 1,
      startedAt: new Date(),
    });

    const saved = await repo.save(newRun);

    return {
      runId: saved.id,
      status: 'running',
      message: 'Retry run started',
    };
  }

  // ========== Helper Methods ==========

  private validateWorkflow(steps: WorkflowStep[]): void {
    if (!steps || steps.length === 0) {
      throw new ForbiddenException('Workflow must have at least one step');
    }

    // Check for start step
    const startSteps = steps.filter((s) => s.type === 'start');
    if (startSteps.length === 0) {
      throw new ForbiddenException('Workflow must have a start step');
    }
    if (startSteps.length > 1) {
      throw new ForbiddenException('Workflow can only have one start step');
    }

    // Check for end step
    const endSteps = steps.filter((s) => s.type === 'end');
    if (endSteps.length === 0) {
      throw new ForbiddenException('Workflow must have at least one end step');
    }
  }

  private findStartStep(steps: WorkflowStep[]): WorkflowStep | undefined {
    return steps.find((s) => s.type === 'start');
  }

  private async simulateExecution(
    ctx: RequestContext,
    workflow: WorkflowDefinition,
    run: WorkflowRun,
    inputData: Record<string, any>,
  ): Promise<{ status: string; message: string }> {
    const stepRepo = await this.tenantDb.getRepository<WorkflowStepExecution>(
      ctx.tenantId,
      WorkflowStepExecution,
    );
    const runRepo = await this.tenantDb.getRepository<WorkflowRun>(
      ctx.tenantId,
      WorkflowRun,
    );

    const steps = workflow.steps as WorkflowStep[];

    // Simple simulation - just record step executions
    let currentStep = this.findStartStep(steps);
    const visited = new Set<string>();

    while (currentStep && !visited.has(currentStep.id)) {
      visited.add(currentStep.id);

      // Create step execution record
      const stepExecution = stepRepo.create({
        runId: run.id,
        stepId: currentStep.id,
        stepType: currentStep.type,
        status: 'completed',
        inputData,
        outputData: { simulated: true },
        startedAt: new Date(),
        completedAt: new Date(),
      });

      await stepRepo.save(stepExecution);

      // Find next step (simplified - in real implementation would follow edges)
      if (currentStep.type === 'end') {
        break;
      }

      // For simulation, just move to next step in array
      const currentIndex = steps.findIndex((s) => s.id === currentStep!.id);
      currentStep = steps[currentIndex + 1];
    }

    // Update run status
    run.status = 'completed';
    run.completedAt = new Date();
    await runRepo.save(run);

    return {
      status: 'completed',
      message: 'Workflow executed successfully (simulated)',
    };
  }
}
