import { Injectable } from '@nestjs/common';
import { TenantDbService } from '@eam-platform/tenant-db';
import { FieldAcl, Permission } from '@eam-platform/platform-db';
import { In, IsNull } from 'typeorm';

@Injectable()
export class FieldAclRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async findByTable(tenantId: string, tableName: string, operation: string) {
    const repo = await this.tenantDb.getRepository<FieldAcl>(tenantId, FieldAcl as any);
    return repo.find({
      where: [
        { tenantId, tableName, operation, isEnabled: true },
        { tenantId: IsNull(), tableName, operation, isEnabled: true },
      ],
      order: { priority: 'ASC' },
    });
  }

  async mapPermissionNames(tenantId: string, ids: string[]) {
    const map = new Map<string, string>();
    if (!ids.length) return map;
    const repo = await this.tenantDb.getRepository<Permission>(tenantId, Permission as any);
    const perms = await repo.find({ where: { id: In(ids) } });
    perms.forEach((p) => map.set(p.id, p.name));
    return map;
  }
}
