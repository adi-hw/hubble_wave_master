import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantDbService, WorkflowDefinition, WorkflowRun } from '@eam-platform/tenant-db';

@Injectable()
export class WorkflowService {
  constructor(private readonly tenantDb: TenantDbService) {}

  private async repos(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return {
      defRepo: ds.getRepository(WorkflowDefinition),
      runRepo: ds.getRepository(WorkflowRun),
    };
  }

  async listWorkflows(tenantId: string) {
    const { defRepo } = await this.repos(tenantId);
    return defRepo.find({ order: { name: 'ASC' } });
  }

  async getWorkflow(id: string, tenantId: string) {
    const { defRepo, runRepo } = await this.repos(tenantId);
    const wf = await defRepo.findOne({ where: { id } });
    if (!wf) throw new NotFoundException('Workflow not found');
    const runs = await runRepo.find({ where: { workflowId: id }, order: { createdAt: 'DESC' }, take: 20 });
    return { ...wf, runs };
  }

  async createWorkflow(
    tenantId: string,
    input: { name: string; slug: string; description?: string; triggerType?: any; triggerConfig?: any; steps?: any[] }
  ) {
    const { defRepo } = await this.repos(tenantId);
    const wf = defRepo.create({
      name: input.name,
      slug: input.slug,
      description: input.description,
      triggerType: input.triggerType ?? 'manual',
      triggerConfig: input.triggerConfig ?? {},
      steps: input.steps ?? [],
      status: 'active',
    });
    return defRepo.save(wf);
  }

  async trigger(tenantId: string, workflowId: string, payload: any) {
    const { defRepo, runRepo } = await this.repos(tenantId);
    const wf = await defRepo.findOne({ where: { id: workflowId, status: 'active' } });
    if (!wf) throw new NotFoundException('Workflow not found or inactive');

    const run = runRepo.create({
      workflowId,
      status: 'running',
      input: payload,
      startedAt: new Date(),
    });
    const saved = await runRepo.save(run);

    saved.status = 'succeeded';
    saved.output = { echo: payload, steps: wf.steps };
    saved.finishedAt = new Date();
    await runRepo.save(saved);

    return saved;
  }
}
