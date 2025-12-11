import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigSetting } from '@eam-platform/platform-db';
import { TenantDbService } from '@eam-platform/tenant-db';

type ConfigScope = string;
type ConfigType = string;

interface SetConfigInput {
  scope: ConfigScope;
  tenantId?: string | null;
  category: string;
  key: string;
  type: ConfigType;
  value: any;
  userId?: string;
}

@Injectable()
export class ConfigServiceLocal {
  constructor(
    private readonly tenantDbService: TenantDbService,
  ) {}

  async get(scope: ConfigScope, key: string, tenantId?: string | null) {
    if (!tenantId) {
      throw new NotFoundException('Tenant context required for config lookup');
    }
    const configRepo = await this.tenantDbService.getRepository(tenantId, ConfigSetting);
    const setting = await configRepo.findOne({
      where: { scope, key },
    });
    if (!setting) throw new NotFoundException('Config not found');
    return setting;
  }

  async set(input: SetConfigInput) {
    const tenantId = input.tenantId ?? null;
    if (!tenantId) {
      throw new NotFoundException('Tenant context required for config save');
    }
    const configRepo = await this.tenantDbService.getRepository(tenantId, ConfigSetting);
    let existing = await configRepo.findOne({
      where: { scope: input.scope, key: input.key },
    });

    if (!existing) {
      existing = configRepo.create({
        scope: input.scope,
        key: input.key,
        category: input.category,
        type: input.type,
        value: input.value,
        version: 1,
        createdBy: input.userId,
      });
    } else {
      existing.value = input.value;
      existing.type = input.type;
      existing.category = input.category;
      existing.version = (existing.version || 1) + 1;
    }

    return configRepo.save(existing);
  }

  async list(scope: ConfigScope, tenantId?: string | null) {
    if (!tenantId) {
      throw new NotFoundException('Tenant context required for config list');
    }
    const configRepo = await this.tenantDbService.getRepository(tenantId, ConfigSetting);
    return configRepo.find({
      where: { scope },
      order: { category: 'ASC', key: 'ASC' },
    });
  }
}
