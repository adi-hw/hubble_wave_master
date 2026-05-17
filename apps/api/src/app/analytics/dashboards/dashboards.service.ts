import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRequestContext } from '@hubblewave/auth-guard';
import { AuthorizationService } from '@hubblewave/authorization';
import { AuditLog, CollectionDefinition, DashboardDefinition, DashboardScope } from '@hubblewave/instance-db';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(DashboardDefinition)
    private readonly dashboardRepo: Repository<DashboardDefinition>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    private readonly authz: AuthorizationService,
  ) {}

  async list(context: UserRequestContext): Promise<DashboardDefinition[]> {
    const dashboards = await this.dashboardRepo.find({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });
    const visible = dashboards.filter((dashboard) => this.canRead(context, dashboard));
    for (const dashboard of visible) {
      dashboard.layout = await this.filterLayoutByCollectionAccess(context, dashboard.layout);
    }
    return visible;
  }

  async get(context: UserRequestContext, code: string): Promise<DashboardDefinition> {
    const dashboard = await this.dashboardRepo.findOne({ where: { code, isActive: true } });
    if (!dashboard) {
      throw new NotFoundException(`Dashboard ${code} not found`);
    }
    if (!this.canRead(context, dashboard)) {
      throw new ForbiddenException('Dashboard access denied');
    }
    dashboard.layout = await this.filterLayoutByCollectionAccess(context, dashboard.layout);
    return dashboard;
  }

  async create(context: UserRequestContext, input: DashboardDefinitionInput): Promise<DashboardDefinition> {
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
    context: UserRequestContext,
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
  private canRead(context: UserRequestContext, dashboard: DashboardDefinition): boolean {
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
      const userRoles = context.roleCodes;
      return allowed.some((role) => userRoles.includes(role));
    }
    return false;
  }

  /**
   * Per-widget collection-access filter (F146). The dashboard-level scope
   * check (canRead) decides whether the viewer can see the dashboard at all;
   * this method decides which widgets within an authorized dashboard the
   * viewer can see. Widgets that reference a collection the viewer cannot
   * read are silently dropped — partial dashboards beat broken dashboards,
   * and this mirrors metrics.service.ts which already filters individual
   * metric reads by collection access.
   *
   * Widget reference conventions supported (both shapes observed in the
   * codebase / frontend):
   *   - widget.collectionId (UUID): direct collection access check.
   *   - widget.drilldown.collectionCode (code): resolved to id via the
   *     CollectionDefinition repo, then access-checked.
   *   - widget.collectionCode (code): same resolution path.
   *
   * Widgets with no recognizable collection reference (e.g. static text,
   * dashboard-overview tiles, AVA chat panels) pass through unchanged so
   * that a non-data widget cannot be accidentally dropped by this filter.
   */
  private async filterLayoutByCollectionAccess(
    context: UserRequestContext,
    layout: Record<string, unknown> | null | undefined,
  ): Promise<Record<string, unknown>> {
    if (!layout || typeof layout !== 'object') {
      return {};
    }
    const widgetsRaw = (layout as { widgets?: unknown }).widgets;
    if (!Array.isArray(widgetsRaw)) {
      return { ...layout };
    }

    // Admin bypass: skip per-widget checks. The dashboard-level canRead
    // already cleared the admin; nothing further to do.
    if (context.isAdmin) {
      return { ...layout };
    }

    const filteredWidgets: unknown[] = [];
    for (const widget of widgetsRaw) {
      if (await this.widgetAuthorized(context, widget)) {
        filteredWidgets.push(widget);
      }
    }

    return { ...layout, widgets: filteredWidgets };
  }

  /**
   * Decide whether a single widget passes the per-widget authz gate. A
   * widget with no recognizable collection reference is treated as
   * authorized (no collection to gate on). A widget whose collection
   * reference cannot be resolved (unknown code, malformed id) is also
   * dropped — fail closed.
   */
  private async widgetAuthorized(context: UserRequestContext, widget: unknown): Promise<boolean> {
    if (!widget || typeof widget !== 'object') {
      return true;
    }
    const w = widget as Record<string, unknown>;

    const directId = typeof w.collectionId === 'string' && UUID_REGEX.test(w.collectionId.toLowerCase())
      ? w.collectionId
      : null;
    if (directId) {
      return this.authz.canAccessCollection(context, directId, 'read');
    }

    const codes: string[] = [];
    if (typeof w.collectionCode === 'string' && w.collectionCode.length > 0) {
      codes.push(w.collectionCode);
    }
    const drilldown = w.drilldown;
    if (drilldown && typeof drilldown === 'object') {
      const code = (drilldown as { collectionCode?: unknown }).collectionCode;
      if (typeof code === 'string' && code.length > 0) {
        codes.push(code);
      }
    }

    if (codes.length === 0) {
      // No recognizable collection reference; treat as a non-collection
      // widget (e.g. static text, AVA chat) and let it through.
      return true;
    }

    for (const code of codes) {
      const collection = await this.collectionRepo.findOne({ where: { code } });
      if (!collection) {
        // Unresolved code → fail closed; the alternative is leaking the
        // existence of a renamed/deleted collection by including the
        // widget anyway.
        return false;
      }
      const allowed = await this.authz.canAccessCollection(context, collection.id, 'read');
      if (!allowed) {
        return false;
      }
    }
    return true;
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

  private assertAdmin(context: UserRequestContext): void {
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
