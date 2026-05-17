import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CollectionDefinition,
  PanelLayout,
  WorkspaceDefinition,
  WorkspacePage,
  WorkspacePageKind,
  WorkspaceVariant,
  WorkspaceVariantScope,
} from '@hubblewave/instance-db';
import { validatePageLayout } from '@hubblewave/shared-types';

export interface CreateWorkspaceDto {
  applicationId: string;
  code: string;
  name: string;
  description?: string;
  defaultCollectionId?: string;
  themeCode?: string;
}

export interface UpdateWorkspaceDto {
  name?: string;
  description?: string | null;
  themeCode?: string | null;
  defaultCollectionId?: string | null;
  isActive?: boolean;
}

export interface UpsertPageDto {
  code: string;
  name: string;
  kind: WorkspacePageKind;
  position?: number;
  layout?: PanelLayout[];
  collectionId?: string | null;
  source?: string;
}

const DEFAULT_PAGES: ReadonlyArray<{
  code: string;
  name: string;
  kind: WorkspacePageKind;
  position: number;
}> = [
  { code: 'home', name: 'Home', kind: 'home', position: 0 },
  { code: 'list', name: 'Records', kind: 'list', position: 1 },
  { code: 'record', name: 'Record', kind: 'record', position: 2 },
  { code: 'search', name: 'Search', kind: 'search', position: 3 },
  { code: 'analytics', name: 'Analytics', kind: 'analytics', position: 4 },
];

/**
 * Pack-vs-custom direct-edit policy per ADR-7. `home` is always
 * editable (every install needs a unique landing page). The other
 * four default kinds are protected when they originate from a pack
 * — admins must clone the page into a WorkspaceVariant to mutate it.
 */
const ALWAYS_EDITABLE_KINDS: ReadonlySet<WorkspacePageKind> = new Set(['home', 'custom']);

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(WorkspaceDefinition)
    private readonly defRepo: Repository<WorkspaceDefinition>,
    @InjectRepository(WorkspacePage)
    private readonly pageRepo: Repository<WorkspacePage>,
    @InjectRepository(WorkspaceVariant)
    private readonly variantRepo: Repository<WorkspaceVariant>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * `editorScope=true` exposes draft / inactive rows for the
   * Workspace Builder. Default `false` filters to published+active,
   * so a runtime read user (metadata:collection:read only) cannot enumerate
   * unfinished or deactivated workspaces.
   */
  async list(
    applicationId?: string,
    includeInactive = false,
    editorScope = false,
  ): Promise<WorkspaceDefinition[]> {
    const qb = this.defRepo.createQueryBuilder('w').orderBy('w.name', 'ASC');
    if (applicationId) qb.andWhere('w.application_id = :applicationId', { applicationId });
    if (!editorScope) {
      // Read users always see only the runtime-eligible set. The
      // includeInactive flag is honored ONLY when the caller has
      // editor scope.
      qb.andWhere('w.is_active = true').andWhere("w.status = 'published'");
    } else if (!includeInactive) {
      qb.andWhere('w.is_active = true');
    }
    return qb.getMany();
  }

  async get(id: string, editorScope = false): Promise<WorkspaceDefinition> {
    const qb = this.defRepo
      .createQueryBuilder('w')
      .leftJoinAndSelect('w.pages', 'page')
      .where('w.id = :id', { id })
      .orderBy('page.position', 'ASC');
    if (!editorScope) {
      qb.andWhere('w.is_active = true').andWhere("w.status = 'published'");
    }
    const ws = await qb.getOne();
    if (!ws) {
      throw new NotFoundException(
        editorScope
          ? `Workspace ${id} not found`
          : `Workspace ${id} not found or not currently active`,
      );
    }
    return ws;
  }

  /**
   * Create a Workspace and seed the five default pages bound to the
   * supplied default collection. Pages start as `custom` source —
   * pack imports later assign their own provenance.
   */
  async create(dto: CreateWorkspaceDto, userId?: string): Promise<WorkspaceDefinition> {
    if (!dto.code || !dto.name || !dto.applicationId) {
      throw new BadRequestException('code, name, applicationId are required');
    }
    const existing = await this.defRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Workspace with code "${dto.code}" already exists`);
    }
    if (dto.defaultCollectionId) {
      const exists = await this.collectionRepo.findOne({ where: { id: dto.defaultCollectionId } });
      if (!exists) throw new NotFoundException(`Collection ${dto.defaultCollectionId} not found`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    try {
      const workspace = queryRunner.manager.create(WorkspaceDefinition, {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        applicationId: dto.applicationId,
        defaultCollectionId: dto.defaultCollectionId ?? null,
        themeCode: dto.themeCode ?? null,
        source: 'custom',
        status: 'draft',
        isActive: false,
        createdBy: userId,
        updatedBy: userId,
      });
      const saved = await queryRunner.manager.save(WorkspaceDefinition, workspace);

      for (const page of DEFAULT_PAGES) {
        await queryRunner.manager.save(
          WorkspacePage,
          queryRunner.manager.create(WorkspacePage, {
            workspaceId: saved.id,
            code: page.code,
            name: page.name,
            kind: page.kind,
            position: page.position,
            layout: [],
            collectionId: dto.defaultCollectionId ?? null,
            source: 'custom',
          }),
        );
      }

      await queryRunner.commitTransaction();
      return this.get(saved.id, true);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, dto: UpdateWorkspaceDto, userId?: string): Promise<WorkspaceDefinition> {
    const ws = await this.get(id, true);
    const update: Record<string, unknown> = { updatedBy: userId };
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.description !== undefined) update.description = dto.description;
    if (dto.themeCode !== undefined) update.themeCode = dto.themeCode;
    if (dto.defaultCollectionId !== undefined) update.defaultCollectionId = dto.defaultCollectionId;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    // Edits flip the workspace back to draft per ADR-5; runtime stops
    // serving until publish + activate run.
    update.status = 'draft';
    update.isActive = false;
    await this.defRepo.update(id, update);
    void ws;
    return this.get(id, true);
  }

  async publish(id: string, userId?: string): Promise<WorkspaceDefinition> {
    const ws = await this.get(id, true);
    // Validate every page's layout against the widget catalog before
    // flipping the workspace to published. A misconfigured panel
    // would otherwise reach the runtime renderer and surface an
    // error to end users.
    const errors: string[] = [];
    for (const page of ws.pages ?? []) {
      const pageErrors = validatePageLayout(page.layout ?? [], page.kind);
      for (const e of pageErrors) {
        errors.push(`${page.code}: ${e.error}`);
      }
    }
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Cannot publish Workspace: panel validation errors',
        errors,
      });
    }
    await this.defRepo.update(id, {
      status: 'published',
      publishedAt: new Date(),
      updatedBy: userId,
    });
    return this.get(id, true);
  }

  async deprecate(id: string, userId?: string): Promise<WorkspaceDefinition> {
    await this.get(id, true);
    await this.defRepo.update(id, { status: 'deprecated', isActive: false, updatedBy: userId });
    return this.get(id, true);
  }

  async toggleActive(id: string, userId?: string): Promise<WorkspaceDefinition> {
    const ws = await this.get(id, true);
    const next = !ws.isActive;
    if (next && ws.status !== 'published') {
      throw new ConflictException(
        `Workspace "${ws.code}" is in status "${ws.status}". Publish before activating.`,
      );
    }
    await this.defRepo.update(id, { isActive: next, updatedBy: userId });
    return this.get(id, true);
  }

  async delete(id: string): Promise<void> {
    const ws = await this.get(id, true);
    if (ws.isActive) {
      throw new ConflictException('Active Workspaces must be deactivated before delete');
    }
    await this.defRepo.delete(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // Pages
  // ─────────────────────────────────────────────────────────────────

  async upsertPage(
    workspaceId: string,
    pageId: string | null,
    dto: UpsertPageDto,
    userId?: string,
  ): Promise<WorkspacePage> {
    await this.get(workspaceId, true);
    const layout = dto.layout ?? [];
    if (layout.length > 0) {
      const errors = validatePageLayout(layout, dto.kind);
      if (errors.length > 0) {
        throw new BadRequestException({
          message: 'Page layout failed widget-contract validation',
          errors,
        });
      }
    }

    let saved: WorkspacePage;
    if (pageId) {
      const existing = await this.pageRepo.findOne({ where: { id: pageId } });
      if (!existing || existing.workspaceId !== workspaceId) {
        throw new NotFoundException(`Page ${pageId} not found in workspace ${workspaceId}`);
      }
      this.assertEditable(existing);
      existing.code = dto.code;
      existing.name = dto.name;
      existing.kind = dto.kind;
      existing.position = dto.position ?? existing.position;
      existing.layout = layout;
      existing.collectionId = dto.collectionId ?? existing.collectionId;
      existing.source = dto.source ?? existing.source;
      saved = await this.pageRepo.save(existing);
    } else {
      const created = this.pageRepo.create({
        workspaceId,
        code: dto.code,
        name: dto.name,
        kind: dto.kind,
        position: dto.position ?? 999,
        layout,
        collectionId: dto.collectionId ?? null,
        source: dto.source ?? 'custom',
      });
      saved = await this.pageRepo.save(created);
    }

    // Page edits invalidate the published workspace: flip parent
    // back to draft + clear isActive so the runtime stops serving
    // unreviewed layouts. Operators must republish + reactivate
    // explicitly. Mirrors Phase 4.1 lifecycle pattern.
    await this.invalidatePublished(workspaceId, userId);
    return saved;
  }

  async deletePage(workspaceId: string, pageId: string, userId?: string): Promise<void> {
    const page = await this.pageRepo.findOne({ where: { id: pageId } });
    if (!page || page.workspaceId !== workspaceId) {
      throw new NotFoundException(`Page ${pageId} not found in workspace ${workspaceId}`);
    }
    this.assertEditable(page);
    await this.pageRepo.delete(pageId);
    await this.invalidatePublished(workspaceId, userId);
  }

  /**
   * Demote a workspace from published+active back to draft+inactive
   * after a structural change (page upsert/delete, variant upsert).
   * No-op when the workspace is already in draft. Cleared
   * `publishedAt` is preserved as historical context — the publish
   * operator stamps a new value when republishing.
   */
  private async invalidatePublished(workspaceId: string, userId?: string): Promise<void> {
    const ws = await this.defRepo.findOne({ where: { id: workspaceId } });
    if (!ws) return;
    if (ws.status === 'draft' && !ws.isActive) return;
    await this.defRepo.update(workspaceId, {
      status: 'draft',
      isActive: false,
      updatedBy: userId,
    });
  }

  /**
   * ADR-7 direct-edit gate. Pack-shipped pages of kind `list /
   * record / search / analytics` cannot be mutated in place — admins
   * clone them into a WorkspaceVariant to override. `home` and
   * `custom` are always editable.
   */
  private assertEditable(page: WorkspacePage): void {
    if (ALWAYS_EDITABLE_KINDS.has(page.kind)) return;
    if (page.source === 'custom') return;
    throw new ConflictException(
      `Page "${page.code}" (kind=${page.kind}, source=${page.source}) is pack-shipped — clone via a WorkspaceVariant to override.`,
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Variants — Plan §7 hierarchy
  // ─────────────────────────────────────────────────────────────────

  async listVariants(workspaceId: string, editorScope = false): Promise<WorkspaceVariant[]> {
    // Calling `get` with the same editor flag enforces the parent's
    // visibility gate before returning variant metadata. A read user
    // without editor scope receives a 404 for draft / inactive
    // workspaces — same shape as `list` / `get` — so variant data
    // can't be enumerated by guessing IDs.
    await this.get(workspaceId, editorScope);
    return this.variantRepo.find({ where: { workspaceId }, order: { priority: 'ASC' } });
  }

  async upsertVariant(
    workspaceId: string,
    pageId: string,
    dto: {
      scope: WorkspaceVariantScope;
      scopeRef?: string;
      priority?: number;
      layout: PanelLayout[];
    },
    userId?: string,
  ): Promise<WorkspaceVariant> {
    const page = await this.pageRepo.findOne({ where: { id: pageId } });
    if (!page || page.workspaceId !== workspaceId) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    const errors = validatePageLayout(dto.layout, page.kind);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Variant layout failed widget-contract validation',
        errors,
      });
    }

    const existing = await this.variantRepo.findOne({
      where: {
        workspaceId,
        pageId,
        scope: dto.scope,
        scopeRef: dto.scopeRef ?? undefined,
      },
    });
    let saved: WorkspaceVariant;
    if (existing) {
      existing.layout = dto.layout;
      existing.priority = dto.priority ?? existing.priority;
      existing.createdBy = existing.createdBy ?? userId ?? null;
      saved = await this.variantRepo.save(existing);
    } else {
      const created = this.variantRepo.create({
        workspaceId,
        pageId,
        scope: dto.scope,
        scopeRef: dto.scopeRef ?? null,
        priority: dto.priority ?? 100,
        layout: dto.layout,
        createdBy: userId ?? null,
      });
      saved = await this.variantRepo.save(created);
    }
    // Variant changes shift what users actually see at runtime, so
    // they invalidate the published workspace just like a page edit.
    await this.invalidatePublished(workspaceId, userId);
    return saved;
  }

  /**
   * Plan §7 priority resolution. Walks scopes in increasing
   * specificity (system → instance → role → group → personal) and
   * returns the highest-specificity match. Within a scope, lower
   * `priority` wins. Returns the page's base layout if no variant
   * matches — that's the system-default behaviour.
   */
  async resolvePageLayout(
    workspaceId: string,
    pageId: string,
    actor: { roles?: string[]; groups?: string[]; userId?: string },
    editorScope = false,
  ): Promise<PanelLayout[]> {
    // Editor scope unlocks draft/inactive layouts (the Studio preview
    // path); runtime users get the published+active gate so they
    // can't enumerate unfinished workspace layouts by guessing IDs.
    await this.get(workspaceId, editorScope);
    const page = await this.pageRepo.findOne({ where: { id: pageId } });
    if (!page || page.workspaceId !== workspaceId) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    const variants = await this.variantRepo.find({
      where: { workspaceId, pageId },
      order: { priority: 'ASC' },
    });

    // Specificity order: personal > group > role > instance > system.
    // Pick the first (best) match in each tier.
    const ordered: WorkspaceVariantScope[] = ['personal', 'group', 'role', 'instance', 'system'];
    for (const scope of ordered) {
      const matches = variants.filter((v) => {
        if (v.scope !== scope) return false;
        if (scope === 'personal') return v.scopeRef === actor.userId;
        if (scope === 'group') return !!actor.groups?.includes(v.scopeRef ?? '');
        if (scope === 'role') return !!actor.roles?.includes(v.scopeRef ?? '');
        return true; // system / instance always match
      });
      if (matches.length > 0) {
        return matches[0].layout;
      }
    }
    return page.layout ?? [];
  }
}
