import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  NavigationModule,
  NavigationModuleRevision,
  NavigationScope,
  NavigationVariant,
} from '@hubblewave/instance-db';
import type { NavigationContext, NavigationResolveInput, ResolvedNavigation } from './navigation.types';
import { validate as validateUuid } from 'uuid';

type NavigationCandidate = {
  module: NavigationModule;
  variant: NavigationVariant;
};

@Injectable()
export class NavigationService {
  constructor(
    @InjectRepository(NavigationModule)
    private readonly moduleRepo: Repository<NavigationModule>,
    @InjectRepository(NavigationVariant)
    private readonly variantRepo: Repository<NavigationVariant>,
    @InjectRepository(NavigationModuleRevision)
    private readonly revisionRepo: Repository<NavigationModuleRevision>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async resolveNavigation(
    input: NavigationResolveInput,
    context: NavigationContext
  ): Promise<ResolvedNavigation> {
    this.validateResolveInput(input);
    const modules = await this.findModules(input);
    if (modules.length === 0) {
      throw new NotFoundException('No navigation modules match the request');
    }

    const candidates = await this.buildCandidates(modules, context);
    if (candidates.length === 0) {
      throw new NotFoundException('No navigation modules available for the current user');
    }

    const selected = this.selectBestCandidate(candidates);
    const revision = await this.getLatestPublishedRevision(selected.module.id);
    if (!revision) {
      throw new NotFoundException('No published revision for the selected navigation module');
    }

    return {
      moduleId: selected.module.id,
      navigationCode: selected.module.code,
      name: selected.module.name,
      description: selected.module.description,
      revisionId: revision.id,
      revision: revision.revision,
      scope: selected.variant.scope,
      scopeKey: selected.variant.scopeKey,
      priority: selected.variant.priority,
      layout: revision.layout,
      publishedAt: revision.publishedAt ? revision.publishedAt.toISOString() : null,
      resolvedAt: new Date(),
    };
  }

  async buildContext(userId: string, roles: string[]): Promise<NavigationContext> {
    this.ensureUserId(userId);
    const groups = await this.fetchUserGroups(userId);
    return { userId, roles, groups };
  }

  private async findModules(input: NavigationResolveInput): Promise<NavigationModule[]> {
    const qb = this.moduleRepo.createQueryBuilder('navigation').where('navigation.isActive = true');
    if (input.code) {
      qb.andWhere('navigation.code = :code', { code: input.code });
    }
    return qb.getMany();
  }

  private async buildCandidates(
    modules: NavigationModule[],
    context: NavigationContext
  ): Promise<NavigationCandidate[]> {
    const moduleIds = modules.map((module) => module.id);
    const variants = await this.variantRepo.find({
      where: { moduleId: In(moduleIds), isActive: true },
    });

    const moduleMap = new Map(modules.map((module) => [module.id, module]));
    const applicable = variants.filter((variant) => this.isVariantApplicable(variant, context));

    return applicable
      .map((variant) => {
        const module = moduleMap.get(variant.moduleId);
        return module ? { module, variant } : null;
      })
      .filter((candidate): candidate is NavigationCandidate => Boolean(candidate));
  }

  private selectBestCandidate(candidates: NavigationCandidate[]): NavigationCandidate {
    const precedence: Record<NavigationScope, number> = {
      personal: 5,
      group: 4,
      role: 3,
      instance: 2,
      system: 1,
    };

    return candidates.sort((a, b) => {
      const scopeScore = precedence[b.variant.scope] - precedence[a.variant.scope];
      if (scopeScore !== 0) {
        return scopeScore;
      }
      const priorityScore = a.variant.priority - b.variant.priority;
      if (priorityScore !== 0) {
        return priorityScore;
      }
      return b.variant.updatedAt.getTime() - a.variant.updatedAt.getTime();
    })[0];
  }

  private async getLatestPublishedRevision(
    moduleId: string
  ): Promise<NavigationModuleRevision | null> {
    return this.revisionRepo.findOne({
      where: { moduleId, status: 'published' },
      order: { publishedAt: 'DESC', revision: 'DESC' },
    });
  }

  private isVariantApplicable(variant: NavigationVariant, context: NavigationContext): boolean {
    switch (variant.scope) {
      case 'system':
      case 'instance':
        return true;
      case 'role':
        return variant.scopeKey ? context.roles.includes(variant.scopeKey) : false;
      case 'group':
        return variant.scopeKey ? context.groups.includes(variant.scopeKey) : false;
      case 'personal':
        return variant.scopeKey ? variant.scopeKey === context.userId : false;
      default:
        return false;
    }
  }

  private validateResolveInput(input: NavigationResolveInput) {
    if (input.code && !this.isValidCode(input.code)) {
      throw new BadRequestException('code must be lowercase letters, numbers, or underscore');
    }
  }

  private isValidCode(value: string): boolean {
    return /^[a-z0-9_]+$/.test(value);
  }

  private ensureUserId(userId: string) {
    if (!userId || !validateUuid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
  }

  private async fetchUserGroups(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT group_id FROM group_members
       WHERE user_id = $1
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_until IS NULL OR valid_until > NOW())`,
      [userId]
    );
    return rows.map((row: { group_id: string }) => row.group_id);
  }
}
