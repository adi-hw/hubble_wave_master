import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  AuditLog,
  ViewDefinition,
  ViewDefinitionRevision,
  ViewKind,
  ViewRevisionStatus,
  ViewScope,
  ViewVariant,
} from '@hubblewave/instance-db';

export type CreateViewRequest = {
  code: string;
  name: string;
  description?: string;
  kind: ViewKind;
  target_collection_code?: string;
  layout?: Record<string, unknown>;
  widget_bindings?: Record<string, unknown>;
  actions?: Record<string, unknown>;
  variant: {
    scope: ViewScope;
    scope_key?: string;
    priority?: number;
  };
};

export type PublishViewRequest = {
  revisionId?: string;
};

@Injectable()
export class ViewService {
  constructor(
    @InjectRepository(ViewDefinition)
    private readonly definitionRepo: Repository<ViewDefinition>,
    @InjectRepository(ViewDefinitionRevision)
    private readonly revisionRepo: Repository<ViewDefinitionRevision>,
    @InjectRepository(ViewVariant)
    private readonly variantRepo: Repository<ViewVariant>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async createDraft(request: CreateViewRequest, actorId?: string) {
    this.validateDefinitionRequest(request);

    const existing = await this.definitionRepo.findOne({ where: { code: request.code } });
    const definition = existing
      ? await this.updateDefinition(existing, request, actorId)
      : await this.createDefinition(request, actorId);

    const variant = await this.createVariant(definition, request.variant, actorId, true);
    const revision = await this.createRevision(definition, request, actorId);

    await this.logAudit('view.create', actorId, definition.id, {
      viewCode: definition.code,
      revisionId: revision.id,
      variantId: variant.id,
    });

    return { definition, variant, revision };
  }

  async publishView(viewCode: string, request: PublishViewRequest, actorId?: string) {
    const definition = await this.definitionRepo.findOne({ where: { code: viewCode } });
    if (!definition) {
      throw new NotFoundException(`View ${viewCode} not found`);
    }

    const revision = request.revisionId
      ? await this.revisionRepo.findOne({ where: { id: request.revisionId, definitionId: definition.id } })
      : await this.revisionRepo.findOne({
          where: { definitionId: definition.id, status: 'draft' },
          order: { createdAt: 'DESC' },
        });

    if (!revision) {
      throw new NotFoundException('Draft revision not found');
    }

    revision.status = 'published';
    revision.publishedAt = new Date();
    revision.publishedBy = actorId || null;
    const published = await this.revisionRepo.save(revision);

    definition.metadata = this.mergeMetadata(definition.metadata, { status: 'published' });
    definition.updatedBy = actorId;
    await this.definitionRepo.save(definition);

    await this.logAudit('view.publish', actorId, definition.id, {
      viewCode,
      revisionId: published.id,
    });

    return published;
  }

  async listRevisions(viewCode: string): Promise<ViewDefinitionRevision[]> {
    const definition = await this.definitionRepo.findOne({ where: { code: viewCode } });
    if (!definition) {
      throw new NotFoundException(`View ${viewCode} not found`);
    }
    return this.revisionRepo.find({
      where: { definitionId: definition.id },
      order: { revision: 'DESC' },
    });
  }

  async getRevision(viewCode: string, revisionId: string): Promise<ViewDefinitionRevision> {
    const definition = await this.definitionRepo.findOne({ where: { code: viewCode } });
    if (!definition) {
      throw new NotFoundException(`View ${viewCode} not found`);
    }
    const revision = await this.revisionRepo.findOne({
      where: { id: revisionId, definitionId: definition.id },
    });
    if (!revision) {
      throw new NotFoundException(`Revision ${revisionId} not found`);
    }
    return revision;
  }

  async listVariants(viewCode: string): Promise<ViewVariant[]> {
    const definition = await this.definitionRepo.findOne({ where: { code: viewCode } });
    if (!definition) {
      throw new NotFoundException(`View ${viewCode} not found`);
    }
    return this.variantRepo.find({
      where: { definitionId: definition.id, isActive: true },
      order: { priority: 'ASC', createdAt: 'DESC' },
    });
  }

  async addVariant(viewCode: string, variant: CreateViewRequest['variant'], actorId?: string) {
    const definition = await this.definitionRepo.findOne({ where: { code: viewCode } });
    if (!definition) {
      throw new NotFoundException(`View ${viewCode} not found`);
    }
    const created = await this.createVariant(definition, variant, actorId, false);
    await this.logAudit('view.variant.create', actorId, definition.id, {
      viewCode,
      variantId: created.id,
    });
    return created;
  }

  async listDefinitions(filters: { kind?: ViewKind; collection?: string; code?: string }) {
    const qb = this.definitionRepo.createQueryBuilder('view').where('view.isActive = true');
    if (filters.kind) {
      qb.andWhere('view.kind = :kind', { kind: filters.kind });
    }
    if (filters.collection) {
      qb.andWhere('view.targetCollectionCode = :collection', { collection: filters.collection });
    }
    if (filters.code) {
      qb.andWhere('view.code = :code', { code: filters.code });
    }

    const definitions = await qb.getMany();
    if (definitions.length === 0) {
      return [];
    }

    const definitionIds = definitions.map((def) => def.id);
    const revisions = await this.revisionRepo.find({
      where: { definitionId: In(definitionIds) },
      order: { revision: 'DESC' },
    });

    const latestByDefinition = new Map<string, ViewDefinitionRevision>();
    const latestPublishedByDefinition = new Map<string, ViewDefinitionRevision>();

    revisions.forEach((rev) => {
      if (!latestByDefinition.has(rev.definitionId)) {
        latestByDefinition.set(rev.definitionId, rev);
      }
      if (rev.status === 'published' && !latestPublishedByDefinition.has(rev.definitionId)) {
        latestPublishedByDefinition.set(rev.definitionId, rev);
      }
    });

    const variants = await this.variantRepo.find({
      where: { definitionId: In(definitionIds), isActive: true },
      order: { priority: 'ASC', updatedAt: 'DESC' },
    });
    const variantsByDefinition = new Map<string, ViewVariant[]>();
    variants.forEach((variant) => {
      if (!variantsByDefinition.has(variant.definitionId)) {
        variantsByDefinition.set(variant.definitionId, []);
      }
      variantsByDefinition.get(variant.definitionId)?.push(variant);
    });

    return definitions.map((definition) => ({
      definition,
      latestRevision: latestByDefinition.get(definition.id) || null,
      latestPublishedRevision: latestPublishedByDefinition.get(definition.id) || null,
      variants: variantsByDefinition.get(definition.id) || [],
    }));
  }

  private async createDefinition(request: CreateViewRequest, actorId?: string) {
    const definition = this.definitionRepo.create({
      code: request.code,
      name: request.name,
      description: request.description,
      kind: request.kind,
      targetCollectionCode: request.target_collection_code,
      metadata: this.mergeMetadata({}, { status: 'draft' }),
      isActive: true,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.definitionRepo.save(definition);
  }

  private async updateDefinition(
    existing: ViewDefinition,
    request: CreateViewRequest,
    actorId?: string
  ) {
    if (existing.kind !== request.kind) {
      throw new ConflictException(`View ${request.code} kind mismatch`);
    }
    if ((existing.targetCollectionCode || null) !== (request.target_collection_code || null)) {
      throw new ConflictException(`View ${request.code} target collection mismatch`);
    }
    existing.name = request.name;
    existing.description = request.description;
    existing.updatedBy = actorId;
    existing.metadata = this.mergeMetadata(existing.metadata, { status: 'draft' });
    return this.definitionRepo.save(existing);
  }

  private async createRevision(
    definition: ViewDefinition,
    request: CreateViewRequest,
    actorId?: string
  ) {
    const latest = await this.revisionRepo.findOne({
      where: { definitionId: definition.id },
      order: { revision: 'DESC' },
    });
    const revisionNumber = (latest?.revision || 0) + 1;

    const revision = this.revisionRepo.create({
      definitionId: definition.id,
      revision: revisionNumber,
      status: 'draft',
      layout: this.ensureObject(request.layout),
      widgetBindings: this.ensureObject(request.widget_bindings),
      actions: this.ensureObject(request.actions),
      createdBy: actorId,
    });
    return this.revisionRepo.save(revision);
  }

  private async createVariant(
    definition: ViewDefinition,
    variant: CreateViewRequest['variant'],
    actorId: string | undefined,
    allowExisting: boolean
  ) {
    const normalized = this.normalizeVariant(variant, actorId);
    const scopeKeyCondition = normalized.scopeKey === null ? IsNull() : normalized.scopeKey;
    const existing = await this.variantRepo.findOne({
      where: {
        definitionId: definition.id,
        scope: normalized.scope,
        scopeKey: scopeKeyCondition,
        isActive: true,
      },
    });
    if (existing) {
      if (allowExisting) {
        return existing;
      }
      throw new ConflictException('View variant already exists for this scope');
    }

    const created = this.variantRepo.create({
      definitionId: definition.id,
      scope: normalized.scope,
      scopeKey: normalized.scopeKey,
      priority: normalized.priority,
      isActive: true,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.variantRepo.save(created);
  }

  private validateDefinitionRequest(request: CreateViewRequest) {
    if (!request.code || !this.isValidCode(request.code)) {
      throw new BadRequestException('view.code must be lowercase letters, numbers, or underscore');
    }
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('view.name is required');
    }
    if (!request.kind || !['form', 'list', 'page'].includes(request.kind)) {
      throw new BadRequestException('view.kind must be form, list, or page');
    }
    if ((request.kind === 'form' || request.kind === 'list') && !request.target_collection_code) {
      throw new BadRequestException('view.target_collection_code is required for form and list');
    }
    if (!request.variant) {
      throw new BadRequestException('view.variant is required');
    }
  }

  private normalizeVariant(
    variant: CreateViewRequest['variant'],
    actorId?: string
  ): { scope: ViewScope; scopeKey: string | null; priority: number } {
    const scope = variant.scope;
    const priority = Number.isFinite(variant.priority) ? (variant.priority as number) : 100;

    if (scope === 'system' || scope === 'instance') {
      if (variant.scope_key) {
        throw new BadRequestException('scope_key is not allowed for system or instance scope');
      }
      return { scope, scopeKey: null, priority };
    }
    if (scope === 'role' || scope === 'group') {
      if (!variant.scope_key) {
        throw new BadRequestException(`scope_key is required for ${scope} scope`);
      }
      return { scope, scopeKey: variant.scope_key, priority };
    }
    if (scope === 'personal') {
      const scopeKey = variant.scope_key || actorId;
      if (!scopeKey) {
        throw new BadRequestException('scope_key is required for personal scope');
      }
      return { scope, scopeKey, priority };
    }
    throw new BadRequestException('Invalid view scope');
  }

  private ensureObject(value?: Record<string, unknown>): Record<string, unknown> {
    if (!value) {
      return {};
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('View payload fields must be objects');
    }
    return value;
  }

  private mergeMetadata(
    existing: Record<string, unknown>,
    updates: { status?: ViewRevisionStatus },
  ) {
    return {
      ...existing,
      ...updates,
    };
  }

  private isValidCode(code: string): boolean {
    return /^[a-z0-9_]+$/.test(code) && code.length <= 120;
  }

  private async logAudit(
    action: string,
    actorId: string | undefined,
    recordId: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const log = this.auditRepo.create({
      userId: actorId || null,
      action,
      collectionCode: 'view_definitions',
      recordId,
      newValues: payload,
    });
    await this.auditRepo.save(log);
  }
}
