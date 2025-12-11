import { Injectable } from '@nestjs/common';
import { TenantDbService, ModelTable, ModelField, ModelFieldType } from '@eam-platform/tenant-db';

@Injectable()
export class MetadataService {
  constructor(private readonly tenantDb: TenantDbService) {}

  private async repos(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return {
      modelRepo: ds.getRepository(ModelTable),
      fieldRepo: ds.getRepository(ModelField),
      fieldTypeRepo: ds.getRepository(ModelFieldType),
    };
  }

  async createTable(tenantId: string, name: string, fields: any[]) {
    const { modelRepo, fieldRepo, fieldTypeRepo } = await this.repos(tenantId);
    const model = await modelRepo.save(
      modelRepo.create({
        code: name,
        label: name,
        category: 'application',
        storageSchema: 'public',
        storageTable: name,
        flags: {},
      })
    );

    const fieldEntities = [];
    for (const field of fields || []) {
      const fieldType = await fieldTypeRepo.findOne({ where: { code: field.type } });
      if (!fieldType) continue;
      fieldEntities.push(
        fieldRepo.create({
          tableId: model.id,
          fieldTypeId: fieldType.id,
          code: field.name,
          label: field.label || field.name,
          nullable: !(field.required === true),
          isUnique: !!field.isUnique,
          defaultValue: field.defaultValue,
          storagePath: field.storagePath || `json:attributes.${field.name}`,
          config: field.config || {},
        })
      );
    }
    if (fieldEntities.length) {
      await fieldRepo.save(fieldEntities);
    }
    return model;
  }

  async getTable(tenantId: string, name: string) {
    const { modelRepo, fieldRepo } = await this.repos(tenantId);
    const model = await modelRepo.findOne({ where: { code: name } });
    if (!model) return null;
    const fields = await fieldRepo.find({
      where: { tableId: model.id },
      relations: ['fieldType'],
    });
    return { model, fields };
  }

  async getAllTables(tenantId: string) {
    const { modelRepo } = await this.repos(tenantId);
    return modelRepo.find();
  }
}
