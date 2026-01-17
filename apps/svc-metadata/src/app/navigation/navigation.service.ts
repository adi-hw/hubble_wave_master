import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  AuditLog,
  NavigationModule,
  NavigationModuleRevision,
  NavigationScope,
  NavigationVariant,
} from '@hubblewave/instance-db';

export type CreateNavigationRequest = {
  code: string;
  name: string;
  description?: string;
  layout?: Record<string, unknown>;
  variant: {
    scope: NavigationScope;
    scope_key?: string;
    priority?: number;
  };
};

export type PublishNavigationRequest = {
  revisionId?: string;
};

@Injectable()
export class NavigationService {
  constructor(
    @InjectRepository(NavigationModule)
    private readonly moduleRepo: Repository<NavigationModule>,
    @InjectRepository(NavigationModuleRevision)
    private readonly revisionRepo: Repository<NavigationModuleRevision>,
    @InjectRepository(NavigationVariant)
    private readonly variantRepo: Repository<NavigationVariant>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async createDraft(request: CreateNavigationRequest, actorId?: string) {
    this.validateRequest(request);

    const existing = await this.moduleRepo.findOne({ where: { code: request.code } });
    const module = existing
      ? await this.updateModule(existing, request, actorId)
      : await this.createModule(request, actorId);

    const variant = await this.createVariant(module, request.variant, actorId, true);
    const revision = await this.createRevision(module, request, actorId);

    await this.logAudit('navigation.create', actorId, module.id, {
      navigationCode: module.code,
      revisionId: revision.id,
      variantId: variant.id,
    });

    return { module, variant, revision };
  }

  async publishNavigation(navigationCode: string, request: PublishNavigationRequest, actorId?: string) {
    const module = await this.moduleRepo.findOne({ where: { code: navigationCode } });
    if (!module) {
      throw new NotFoundException(`Navigation ${navigationCode} not found`);
    }

    const revision = request.revisionId
      ? await this.revisionRepo.findOne({ where: { id: request.revisionId, moduleId: module.id } })
      : await this.revisionRepo.findOne({
          where: { moduleId: module.id, status: 'draft' },
          order: { createdAt: 'DESC' },
        });

    if (!revision) {
      throw new NotFoundException('Draft revision not found');
    }

    revision.status = 'published';
    revision.publishedAt = new Date();
    revision.publishedBy = actorId || null;
    const published = await this.revisionRepo.save(revision);

    module.metadata = this.mergeMetadata(module.metadata, { status: 'published' });
    module.updatedBy = actorId;
    await this.moduleRepo.save(module);

    await this.logAudit('navigation.publish', actorId, module.id, {
      navigationCode,
      revisionId: published.id,
    });

    return published;
  }

  async listRevisions(navigationCode: string): Promise<NavigationModuleRevision[]> {
    const module = await this.moduleRepo.findOne({ where: { code: navigationCode } });
    if (!module) {
      throw new NotFoundException(`Navigation ${navigationCode} not found`);
    }
    return this.revisionRepo.find({
      where: { moduleId: module.id },
      order: { revision: 'DESC' },
    });
  }

  async getRevision(navigationCode: string, revisionId: string): Promise<NavigationModuleRevision> {
    const module = await this.moduleRepo.findOne({ where: { code: navigationCode } });
    if (!module) {
      throw new NotFoundException(`Navigation ${navigationCode} not found`);
    }
    const revision = await this.revisionRepo.findOne({
      where: { id: revisionId, moduleId: module.id },
    });
    if (!revision) {
      throw new NotFoundException(`Revision ${revisionId} not found`);
    }
    return revision;
  }

  async listVariants(navigationCode: string): Promise<NavigationVariant[]> {
    const module = await this.moduleRepo.findOne({ where: { code: navigationCode } });
    if (!module) {
      throw new NotFoundException(`Navigation ${navigationCode} not found`);
    }
    return this.variantRepo.find({
      where: { moduleId: module.id, isActive: true },
      order: { priority: 'ASC', createdAt: 'DESC' },
    });
  }

  async addVariant(navigationCode: string, variant: CreateNavigationRequest['variant'], actorId?: string) {
    const module = await this.moduleRepo.findOne({ where: { code: navigationCode } });
    if (!module) {
      throw new NotFoundException(`Navigation ${navigationCode} not found`);
    }
    const created = await this.createVariant(module, variant, actorId, false);
    await this.logAudit('navigation.variant.create', actorId, module.id, {
      navigationCode,
      variantId: created.id,
    });
    return created;
  }

  async listModules(filters: { code?: string }) {
    const qb = this.moduleRepo.createQueryBuilder('navigation').where('navigation.isActive = true');
    if (filters.code) {
      qb.andWhere('navigation.code = :code', { code: filters.code });
    }

    const modules = await qb.getMany();
    if (modules.length === 0) {
      return [];
    }

    const moduleIds = modules.map((module) => module.id);
    const revisions = await this.revisionRepo.find({
      where: { moduleId: In(moduleIds) },
      order: { revision: 'DESC' },
    });

    const latestByModule = new Map<string, NavigationModuleRevision>();
    const latestPublishedByModule = new Map<string, NavigationModuleRevision>();

    revisions.forEach((rev) => {
      if (!latestByModule.has(rev.moduleId)) {
        latestByModule.set(rev.moduleId, rev);
      }
      if (rev.status === 'published' && !latestPublishedByModule.has(rev.moduleId)) {
        latestPublishedByModule.set(rev.moduleId, rev);
      }
    });

    const variants = await this.variantRepo.find({
      where: { moduleId: In(moduleIds), isActive: true },
      order: { priority: 'ASC', updatedAt: 'DESC' },
    });
    const variantsByModule = new Map<string, NavigationVariant[]>();
    variants.forEach((variant) => {
      if (!variantsByModule.has(variant.moduleId)) {
        variantsByModule.set(variant.moduleId, []);
      }
      variantsByModule.get(variant.moduleId)?.push(variant);
    });

    return modules.map((module) => ({
      module,
      latestRevision: latestByModule.get(module.id) || null,
      latestPublishedRevision: latestPublishedByModule.get(module.id) || null,
      variants: variantsByModule.get(module.id) || [],
    }));
  }

  private async createModule(request: CreateNavigationRequest, actorId?: string) {
    const module = this.moduleRepo.create({
      code: request.code,
      name: request.name,
      description: request.description,
      metadata: this.mergeMetadata({}, { status: 'draft' }),
      isActive: true,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.moduleRepo.save(module);
  }

  private async updateModule(
    existing: NavigationModule,
    request: CreateNavigationRequest,
    actorId?: string
  ) {
    existing.name = request.name;
    existing.description = request.description;
    existing.updatedBy = actorId;
    existing.metadata = this.mergeMetadata(existing.metadata, { status: 'draft' });
    return this.moduleRepo.save(existing);
  }

  private async createRevision(
    module: NavigationModule,
    request: CreateNavigationRequest,
    actorId?: string
  ) {
    const latest = await this.revisionRepo.findOne({
      where: { moduleId: module.id },
      order: { revision: 'DESC' },
    });
    const revisionNumber = (latest?.revision || 0) + 1;

    const revision = this.revisionRepo.create({
      moduleId: module.id,
      revision: revisionNumber,
      status: 'draft',
      layout: this.ensureObject(request.layout),
      createdBy: actorId,
    });
    return this.revisionRepo.save(revision);
  }

  private async createVariant(
    module: NavigationModule,
    variant: CreateNavigationRequest['variant'],
    actorId: string | undefined,
    allowExisting: boolean
  ) {
    const normalized = this.normalizeVariant(variant, actorId);
    const scopeKeyCondition = normalized.scopeKey === null ? IsNull() : normalized.scopeKey;
    const existing = await this.variantRepo.findOne({
      where: {
        moduleId: module.id,
        scope: normalized.scope,
        scopeKey: scopeKeyCondition,
        isActive: true,
      },
    });
    if (existing) {
      if (allowExisting) {
        return existing;
      }
      throw new ConflictException('Navigation variant already exists for this scope');
    }

    const created = this.variantRepo.create({
      moduleId: module.id,
      scope: normalized.scope,
      scopeKey: normalized.scopeKey,
      priority: normalized.priority,
      isActive: true,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.variantRepo.save(created);
  }

  private validateRequest(request: CreateNavigationRequest) {
    if (!request.code || !this.isValidCode(request.code)) {
      throw new BadRequestException('navigation.code must be lowercase letters, numbers, or underscore');
    }
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('navigation.name is required');
    }
    if (!request.variant) {
      throw new BadRequestException('navigation.variant is required');
    }
  }

  private normalizeVariant(
    variant: CreateNavigationRequest['variant'],
    actorId?: string
  ): { scope: NavigationScope; scopeKey: string | null; priority: number } {
    const scope = variant.scope;
    const priority = Number.isFinite(variant.priority) ? (variant.priority as number) : 100;

    if (scope === 'system' || scope === 'instance') {
      return { scope, scopeKey: null, priority };
    }

    if (scope === 'personal') {
      if (!variant.scope_key) {
        return { scope, scopeKey: actorId || null, priority };
      }
      return { scope, scopeKey: variant.scope_key, priority };
    }

    if (!variant.scope_key) {
      throw new BadRequestException('navigation.variant.scope_key is required for role and group scopes');
    }

    return { scope, scopeKey: variant.scope_key, priority };
  }

  private isValidCode(value: string): boolean {
    return /^[a-z0-9_]+$/.test(value);
  }

  private ensureObject(value?: Record<string, unknown>): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return value;
  }

  private mergeMetadata(
    current: Record<string, unknown>,
    updates: Record<string, unknown>
  ): Record<string, unknown> {
    return { ...current, ...updates };
  }

  private async logAudit(
    action: string,
    actorId: string | undefined,
    targetId: string,
    metadata: Record<string, unknown>
  ) {
    const entry = this.auditRepo.create({
      userId: actorId || null,
      action,
      collectionCode: 'navigation_modules',
      recordId: targetId,
      newValues: metadata,
    });
    await this.auditRepo.save(entry);
  }
}
