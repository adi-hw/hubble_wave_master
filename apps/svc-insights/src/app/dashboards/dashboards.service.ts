import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '@hubblewave/auth-guard';
import { AuditLog, DashboardDefinition } from '@hubblewave/instance-db';

export type DashboardDefinitionInput = {
  code: string;
  name: string;
  description?: string | null;
  layout?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(DashboardDefinition)
    private readonly dashboardRepo: Repository<DashboardDefinition>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async list(): Promise<DashboardDefinition[]> {
    return this.dashboardRepo.find({ where: { isActive: true }, order: { updatedAt: 'DESC' } });
  }

  async get(code: string): Promise<DashboardDefinition> {
    const dashboard = await this.dashboardRepo.findOne({ where: { code, isActive: true } });
    if (!dashboard) {
      throw new NotFoundException(`Dashboard ${code} not found`);
    }
    return dashboard;
  }

  async create(context: RequestContext, input: DashboardDefinitionInput): Promise<DashboardDefinition> {
    this.assertAdmin(context);
    const payload = this.normalizeInput(input, true);

    const existing = await this.dashboardRepo.findOne({ where: { code: payload.code } });
    if (existing) {
      throw new ConflictException(`Dashboard ${payload.code} already exists`);
    }

    const created = this.dashboardRepo.create({
      code: payload.code,
      name: payload.name,
      description: payload.description ?? undefined,
      layout: payload.layout ?? {},
      metadata: payload.metadata ?? {},
      isActive: true,
      createdBy: context.userId,
      updatedBy: context.userId,
    });

    const saved = await this.dashboardRepo.save(created);
    await this.writeAudit(context.userId, 'dashboard.create', saved.id, {
      code: saved.code,
      name: saved.name,
    });
    return saved;
  }

  async update(
    context: RequestContext,
    code: string,
    input: Partial<DashboardDefinitionInput>,
  ): Promise<DashboardDefinition> {
    this.assertAdmin(context);
    const dashboard = await this.dashboardRepo.findOne({ where: { code } });
    if (!dashboard) {
      throw new NotFoundException(`Dashboard ${code} not found`);
    }

    const payload = this.normalizeInput(
      {
        code: dashboard.code,
        name: input.name ?? dashboard.name,
        description: input.description ?? dashboard.description ?? null,
        layout: input.layout ?? dashboard.layout ?? {},
        metadata: this.mergeMetadata(dashboard.metadata, input.metadata),
      },
      false,
    );

    dashboard.name = payload.name;
    dashboard.description = payload.description ?? undefined;
    dashboard.layout = payload.layout ?? {};
    dashboard.metadata = payload.metadata ?? {};
    dashboard.updatedBy = context.userId;

    const saved = await this.dashboardRepo.save(dashboard);
    await this.writeAudit(context.userId, 'dashboard.update', saved.id, {
      code: saved.code,
      name: saved.name,
    });
    return saved;
  }

  private normalizeInput(input: DashboardDefinitionInput, requireCode: boolean): DashboardDefinitionInput {
    const code = input.code?.trim();
    if (requireCode && (!code || !/^[a-z0-9_]+$/.test(code))) {
      throw new BadRequestException('dashboard.code must be lowercase letters, numbers, or underscore');
    }
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('dashboard.name is required');
    }

    return {
      code: code || '',
      name,
      description: input.description?.trim() || null,
      layout: input.layout || {},
      metadata: input.metadata || { status: 'published', source: 'studio' },
    };
  }

  private mergeMetadata(
    existing: Record<string, unknown> | null | undefined,
    incoming: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const base = existing && typeof existing === 'object' ? existing : {};
    const updates = incoming && typeof incoming === 'object' ? incoming : {};
    return {
      ...base,
      ...updates,
      status: (updates as { status?: string }).status || (base as { status?: string }).status || 'published',
    };
  }

  private assertAdmin(context: RequestContext): void {
    if (!context.isAdmin) {
      throw new ForbiddenException('Admin role is required to manage dashboards');
    }
  }

  private async writeAudit(
    userId: string,
    action: string,
    recordId: string,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    const entry = this.auditRepo.create({
      userId,
      collectionCode: 'dashboard_definition',
      recordId,
      action,
      newValues,
    });
    await this.auditRepo.save(entry);
  }
}
