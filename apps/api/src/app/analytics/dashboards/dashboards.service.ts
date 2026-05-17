import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserRequestContext } from '@hubblewave/auth-guard';
import { AuthorizationService, FILTER_UNRESOLVED } from '@hubblewave/authorization';
import { CollectionDefinition, DashboardDefinition, DashboardScope, withAudit } from '@hubblewave/instance-db';

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

/**
 * Action code for the per-read audit row written when one or more
 * widgets were dropped by the F146 widget-authz filter. The shape
 * mirrors other read-side audit codes (`<domain>.<event>.<modifier>`)
 * and is short enough to fit `audit_logs.action` (varchar 50).
 *
 * One row per dashboard read (not one row per dropped widget): the
 * payload carries `droppedWidgetCount` plus the compact `droppedWidgets`
 * array so operators can answer "which widgets did user X see hidden
 * from dashboard Y on date Z" without joining N rows.
 */
const DASHBOARD_READ_FILTERED_ACTION = 'dashboard.read.filtered';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(DashboardDefinition)
    private readonly dashboardRepo: Repository<DashboardDefinition>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    private readonly authz: AuthorizationService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async list(context: UserRequestContext): Promise<DashboardDefinition[]> {
    const dashboards = await this.dashboardRepo.find({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });
    const visible = dashboards.filter((dashboard) => this.canRead(context, dashboard));
    for (const dashboard of visible) {
      dashboard.layout = await this.filterAndAuditLayout(context, dashboard);
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
    dashboard.layout = await this.filterAndAuditLayout(context, dashboard);
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

    const saved = await withAudit(this.dataSource, async (mgr, recordAudit) => {
      const persisted = await mgr.getRepository(DashboardDefinition).save(created);
      recordAudit({
        userId: context.userId,
        action: 'dashboard.create',
        collectionCode: 'dashboard_definition',
        recordId: persisted.id,
        newValues: {
          code: persisted.code,
          name: persisted.name,
          scope: persisted.scope,
        },
      });
      return persisted;
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

    const saved = await withAudit(this.dataSource, async (mgr, recordAudit) => {
      const persisted = await mgr.getRepository(DashboardDefinition).save(dashboard);
      recordAudit({
        userId: context.userId,
        action: 'dashboard.update',
        collectionCode: 'dashboard_definition',
        recordId: persisted.id,
        newValues: {
          code: persisted.code,
          name: persisted.name,
          scope: persisted.scope,
        },
      });
      return persisted;
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
   * F146 + canon §10 — per-widget collection-access filter with
   * transactional audit. Delegates the layout walk to
   * `AuthorizationService.filterDashboardLayout` so the §28 evaluator
   * remains the single source of truth for collection access; this
   * method's responsibility is to (a) resolve widget collection
   * references in this service's own way and (b) write the §10 audit
   * row inside the same transaction when widgets were dropped.
   *
   * Audit emission is conditional on drops occurring: a dashboard with
   * zero forbidden widgets writes no audit row, mirroring the pattern
   * the rest of the read API uses (read paths that produce no
   * effective trust decision do not pollute the audit table).
   */
  private async filterAndAuditLayout(
    context: UserRequestContext,
    dashboard: DashboardDefinition,
  ): Promise<Record<string, unknown>> {
    const { layout, droppedWidgetCount, droppedWidgets } = await this.authz.filterDashboardLayout(
      dashboard.layout,
      context,
      (widget) => this.resolveWidgetCollectionId(widget),
    );

    if (droppedWidgetCount === 0) {
      return layout;
    }

    // Canon §10: the audit row that records WHICH widgets were hidden
    // must commit together with the read-time projection it describes.
    // The dashboard read itself is non-mutating, so the transaction
    // wraps only the audit insert — but the wrap is required because
    // a future PR that adds an associated mutation (last-viewed
    // bookkeeping, per-user dismissal of widget warnings) must extend
    // this transaction, not bolt a parallel one onto the side.
    await withAudit(this.dataSource, async (_mgr, recordAudit) => {
      recordAudit({
        userId: context.userId,
        action: DASHBOARD_READ_FILTERED_ACTION,
        collectionCode: 'dashboard_definition',
        recordId: dashboard.id,
        newValues: {
          dashboardCode: dashboard.code,
          droppedWidgetCount,
          droppedWidgets,
        },
      });
    });

    return layout;
  }

  /**
   * Hook handed to `AuthorizationService.filterDashboardLayout` so the
   * authz library never has to reach into a CollectionDefinition repo.
   * Three widget shapes are supported (all observed in shipped packs and
   * in the studio's authoring model):
   *   1. `widget.collectionId` (UUID) — pre-resolved.
   *   2. `widget.dataSource.collectionId` (UUID) — the W2 plan shape.
   *   3. `widget.collectionCode` / `widget.drilldown.collectionCode`
   *      (code) — looked up against `CollectionDefinition` by code.
   *
   * Returns:
   *   - `null` when the widget carries NO recognizable collection
   *     reference (static text, AVA chat, layout label, etc.).
   *   - A `collectionId` UUID string when the reference resolves.
   *   - `FILTER_UNRESOLVED` when the widget cites a code that no longer
   *     points at any collection. The filter treats this as a drop,
   *     fail-closed.
   */
  private async resolveWidgetCollectionId(
    widget: Record<string, unknown>,
  ): Promise<string | null | typeof FILTER_UNRESOLVED> {
    const directId = typeof widget.collectionId === 'string' && UUID_REGEX.test(widget.collectionId.toLowerCase())
      ? widget.collectionId
      : null;
    if (directId) {
      return directId;
    }

    const dataSource = widget.dataSource;
    if (dataSource && typeof dataSource === 'object') {
      const nested = (dataSource as { collectionId?: unknown }).collectionId;
      if (typeof nested === 'string' && UUID_REGEX.test(nested.toLowerCase())) {
        return nested;
      }
    }

    const codes: string[] = [];
    if (typeof widget.collectionCode === 'string' && widget.collectionCode.length > 0) {
      codes.push(widget.collectionCode);
    }
    const drilldown = widget.drilldown;
    if (drilldown && typeof drilldown === 'object') {
      const code = (drilldown as { collectionCode?: unknown }).collectionCode;
      if (typeof code === 'string' && code.length > 0) {
        codes.push(code);
      }
    }
    if (codes.length === 0) {
      return null;
    }

    // Resolve the first code that maps to a CollectionDefinition. A
    // widget that lists multiple codes (drilldown + primary) and has
    // one unresolved code falls through to UNRESOLVED, fail-closed.
    for (const code of codes) {
      const collection = await this.collectionRepo.findOne({ where: { code } });
      if (!collection) {
        return FILTER_UNRESOLVED;
      }
      // The widget's primary collection is the first one that resolves.
      // Multiple codes in one widget are rare in practice; the
      // §28 evaluator gates one collectionId per call so we surface
      // the first resolved id.
      return collection.id;
    }
    return FILTER_UNRESOLVED;
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
}
