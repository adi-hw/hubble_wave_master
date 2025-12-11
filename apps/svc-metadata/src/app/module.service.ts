import { Injectable } from '@nestjs/common';
import { ModuleEntity, TenantDbService } from '@eam-platform/tenant-db';

@Injectable()
export class ModuleService {
  constructor(private readonly tenantDb: TenantDbService) {}

  private async repo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(ModuleEntity);
  }

  async listModules(tenantId: string) {
    const repo = await this.repo(tenantId);
    return repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async createModule(
    tenantId: string,
    input: { name: string; slug: string; description?: string; route?: string; icon?: string; category?: string; sortOrder?: number }
  ) {
    const repo = await this.repo(tenantId);
    const module = repo.create({
      ...input,
      sortOrder: input.sortOrder ?? 0,
    });
    return repo.save(module);
  }
}
