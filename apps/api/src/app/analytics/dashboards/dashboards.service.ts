import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '@hubblewave/auth-guard';
import { AuditLog, DashboardDefinition, DashboardScope } from '@hubblewave/instance-db';

export type DashboardDefinitionInput = {
  code: string;
  name: string;
  description?: string | null;
  scope?: DashboardScope;
  layout?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

const ALLOWED_SCOPES: readonly DashboardScope[] = ['system', 'tenant', 'role', 'personal'] as const;
const ALLOWED_METADATA_KEYS: readonly string[] = ['status', 'source', 'tags', 'owner', 'roles'] as const;
const ALLOWED_METADATA_STATUSES: readonly string[] = ['draft', 'published', 'archived'] as const;

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(DashboardDefinition)
    private readonly dashboardRepo: Repository<DashboardDefinition>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async list(context: RequestContext): Promise<DashboardDefinition[]> {
    const dashboards = await this.dashboardRepo.find({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });
    return dashboards.filter((dashboard) => this.canRead(context, dashboard));
  }

  async get(context: RequestContext, code: string): Promise<DashboardDefinition> {
    const dashboard = await this.dashboardRepo.findOne({ where: { code, isActive: true } });
    if (!dashboard) {
      throw new NotFoundException(`Dashboard ${code} not found`);
    }
    if (!this.canRead(context, dashboard)) {
      throw new ForbiddenException('Dashboard access denied');
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
      scope: payload.scope ?? 'tenant',
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
      scope: saved.scope,
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
        scope: input.scope ?? dashboard.scope,
        layout: input.layout ?? dashboard.layout ?? {},
        metadata: this.mergeMetadata(dashboard.metadata, input.metadata),
      },
      false,
    );

    dashboard.name = payload.name;
    dashboard.description = payload.description ?? undefined;
    dashboard.scope = payload.scope ?? dashboard.scope;
    dashboard.layout = payload.layout ?? {};
    dashboard.metadata = payload.metadata ?? {};
    dashboard.updatedBy = context.userId;

    const saved = await this.dashboardRepo.save(dashboard);
    await this.writeAudit(context.userId, 'dashboard.update', saved.id, {
      code: saved.code,
      name: saved.name,
      scope: saved.scope,
    });
    return saved;
  }

  /**
   * Visibility check applied to read endpoints. The instance DataSource already
   * enforces tenant isolation at the database level, so this only filters by
   * intra-tenant scope (system/tenant/role/personal).
   */
  private canRead(context: RequestContext, dashboard: DashboardDefinition): boolean {
    const scope = dashboard.scope || 'tenant';
    if (scope === 'system' || scope === 'tenant') {
      return true;
    }
    if (context.isAdmin) {
      return true;
    }
    if (scope === 'personal') {
      return !!dashboard.createdBy && dashboard.createdBy === context.userId;
    }
    if (scope === 'role') {
      const allowed = this.readRoleList(dashboard.metadata);
      if (allowed.length === 0) {
        return false;
      }
      const userRoles = context.roles || [];
      return allowed.some((role) => userRoles.includes(role));
    }
    return false;
  }

  private readRoleList(metadata: Record<string, unknown> | null | undefined): string[] {
    if (!metadata || typeof metadata !== 'object') return [];
    const roles = (metadata as { roles?: unknown }).roles;
    if (!Array.isArray(roles)) return [];
    return roles.filter((role): role is string => typeof role === 'string');
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

    const scope = input.scope;
    if (scope !== undefined && !ALLOWED_SCOPES.includes(scope)) {
      throw new BadRequestException(`dashboard.scope must be one of: ${ALLOWED_SCOPES.join(', ')}`);
    }

    return {
      code: code || '',
      name,
      description: input.description?.trim() || null,
      scope,
      layout: input.layout || {},
      metadata: this.validateMetadata(input.metadata),
    };
  }

  private validateMetadata(
    incoming: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    if (!incoming || typeof incoming !== 'object') {
      return { status: 'published', source: 'studio' };
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (!ALLOWED_METADATA_KEYS.includes(key)) {
        throw new BadRequestException(
          `dashboard.metadata key "${key}" is not allowed. Allowed: ${ALLOWED_METADATA_KEYS.join(', ')}`,
        );
      }
      if (key === 'status') {
        if (typeof value !== 'string' || !ALLOWED_METADATA_STATUSES.includes(value)) {
          throw new BadRequestException(
            `dashboard.metadata.status must be one of: ${ALLOWED_METADATA_STATUSES.join(', ')}`,
          );
        }
      }
      if (key === 'tags' || key === 'roles') {
        if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
          throw new BadRequestException(`dashboard.metadata.${key} must be an array of strings`);
        }
      }
      if (key === 'source' || key === 'owner') {
        if (typeof value !== 'string') {
          throw new BadRequestException(`dashboard.metadata.${key} must be a string`);
        }
      }
      result[key] = value;
    }
    if (!result.status) {
      result.status = 'published';
    }
    return result;
  }

  private mergeMetadata(
    existing: Record<string, unknown> | null | undefined,
    incoming: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const base = existing && typeof existing === 'object' ? existing : {};
    if (!incoming) {
      return { ...base };
    }
    // Validate the incoming patch first so unknown keys are rejected at the
    // boundary even when the request only updates a subset of metadata.
    this.validateMetadata(incoming);
    return {
      ...base,
      ...incoming,
      status:
        (incoming as { status?: string }).status
        || (base as { status?: string }).status
        || 'published',
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
