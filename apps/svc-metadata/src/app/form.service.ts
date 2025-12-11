import { Injectable, NotFoundException } from '@nestjs/common';
import { FormDefinition, FormVersion, TenantDbService } from '@eam-platform/tenant-db';

@Injectable()
export class FormService {
  constructor(private readonly tenantDb: TenantDbService) {}

  private async repos(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return {
      formRepo: ds.getRepository(FormDefinition),
      versionRepo: ds.getRepository(FormVersion),
    };
  }

  async listForms(tenantId: string) {
    const { formRepo } = await this.repos(tenantId);
    return formRepo.find({ order: { name: 'ASC' } });
  }

  async getForm(id: string, tenantId: string) {
    const { formRepo, versionRepo } = await this.repos(tenantId);
    const form = await formRepo.findOne({ where: { id } });
    if (!form) throw new NotFoundException('Form not found');
    const versions = await versionRepo.find({ where: { formId: id }, order: { version: 'DESC' } });
    return { ...form, versions };
  }

  async createForm(
    tenantId: string,
    input: { name: string; slug: string; description?: string; schema?: any; createdBy?: string }
  ) {
    const { formRepo, versionRepo } = await this.repos(tenantId);
    const form = formRepo.create({
      name: input.name,
      slug: input.slug,
      description: input.description,
      currentVersion: 1,
    });
    const saved = await formRepo.save(form);
    const version = versionRepo.create({
      formId: saved.id,
      version: 1,
      schema: input.schema ?? {},
      status: 'draft',
      createdBy: input.createdBy,
    });
    await versionRepo.save(version);
    return this.getForm(saved.id, tenantId);
  }

  async publishDraft(tenantId: string, formId: string, schema: any, createdBy?: string) {
    const { formRepo, versionRepo } = await this.repos(tenantId);
    const form = await formRepo.findOne({ where: { id: formId } });
    if (!form) throw new NotFoundException('Form not found');
    const newVersion = form.currentVersion + 1;
    await versionRepo.save(
      versionRepo.create({
        formId,
        version: newVersion,
        schema,
        status: 'published',
        createdBy,
      })
    );
    await formRepo.update(formId, { currentVersion: newVersion });
    return this.getForm(formId, tenantId);
  }
}
