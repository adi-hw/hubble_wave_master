import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuthorizationService, PropertyMeta } from '@hubblewave/authorization';
import type { RequestContext } from '@hubblewave/auth-guard';
import {
  CollectionDefinition,
  PropertyDefinition,
  ViewDefinition,
  ViewDefinitionRevision,
  ViewScope,
  ViewVariant,
} from '@hubblewave/instance-db';
import type { FieldPermission, ViewContext, ViewResolveInput, ResolvedView } from './view.types';

type ViewCandidate = {
  definition: ViewDefinition;
  variant: ViewVariant;
};

@Injectable()
export class ViewService {
  constructor(
    @InjectRepository(ViewDefinition)
    private readonly definitionRepo: Repository<ViewDefinition>,
    @InjectRepository(ViewVariant)
    private readonly variantRepo: Repository<ViewVariant>,
    @InjectRepository(ViewDefinitionRevision)
    private readonly revisionRepo: Repository<ViewDefinitionRevision>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    private readonly authz: AuthorizationService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async resolveView(
    input: ViewResolveInput,
    context: ViewContext,
    authContext: RequestContext
  ): Promise<ResolvedView> {
    this.validateResolveInput(input);
    const definitions = await this.findDefinitions(input);
    if (definitions.length === 0) {
      throw new NotFoundException('No views match the requested criteria');
    }

    const candidates = await this.buildCandidates(definitions, context);
    if (candidates.length === 0) {
      throw new NotFoundException('No views available for the current user');
    }

    const selected = this.selectBestCandidate(candidates);
    const revision = await this.getLatestPublishedRevision(selected.definition.id);
    if (!revision) {
      throw new NotFoundException('No published revision for the selected view');
    }

    const resolvedLayout = this.composeLayout(revision.layout, selected.variant);
    const fieldPermissions = await this.resolveFieldPermissions(input, authContext);
    const layoutWithPermissions = this.applyFieldPermissions(
      resolvedLayout,
      fieldPermissions,
      input.kind
    );

    return {
      definitionId: selected.definition.id,
      viewCode: selected.definition.code,
      name: selected.definition.name,
      description: selected.definition.description,
      kind: selected.definition.kind,
      targetCollectionCode: selected.definition.targetCollectionCode,
      revisionId: revision.id,
      revision: revision.revision,
      scope: selected.variant.scope,
      scopeKey: selected.variant.scopeKey,
      priority: selected.variant.priority,
      layout: layoutWithPermissions,
      fieldPermissions,
      widgetBindings: revision.widgetBindings,
      actions: revision.actions,
      publishedAt: revision.publishedAt,
      resolvedAt: new Date(),
    };
  }

  private async findDefinitions(input: ViewResolveInput): Promise<ViewDefinition[]> {
    const qb = this.definitionRepo.createQueryBuilder('view').where('view.isActive = true');

    qb.andWhere('view.kind = :kind', { kind: input.kind });

    if (input.collection) {
      qb.andWhere('view.targetCollectionCode = :collection', {
        collection: input.collection,
      });
    }

    if (input.route) {
      qb.andWhere('view.code = :code', { code: this.normalizeRoute(input.route) });
    }

    return qb.getMany();
  }

  private async buildCandidates(
    definitions: ViewDefinition[],
    context: ViewContext
  ): Promise<ViewCandidate[]> {
    const definitionIds = definitions.map((def) => def.id);
    const variants = await this.variantRepo.find({
      where: { definitionId: In(definitionIds), isActive: true },
    });

    const definitionMap = new Map(definitions.map((def) => [def.id, def]));
    const applicable = variants.filter((variant) => this.isVariantApplicable(variant, context));

    return applicable
      .map((variant) => {
        const definition = definitionMap.get(variant.definitionId);
        return definition ? { definition, variant } : null;
      })
      .filter((candidate): candidate is ViewCandidate => Boolean(candidate));
  }

  private selectBestCandidate(candidates: ViewCandidate[]): ViewCandidate {
    const precedence: Record<ViewScope, number> = {
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
    definitionId: string
  ): Promise<ViewDefinitionRevision | null> {
    return this.revisionRepo.findOne({
      where: { definitionId, status: 'published' },
      order: { publishedAt: 'DESC', revision: 'DESC' },
    });
  }

  private isVariantApplicable(variant: ViewVariant, context: ViewContext): boolean {
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

  private composeLayout(layout: Record<string, unknown>, variant: ViewVariant): Record<string, unknown> {
    const base = layout.base as Record<string, unknown> | undefined;
    const overrides = layout.overrides as Array<Record<string, unknown>> | undefined;

    if (!base || !Array.isArray(overrides)) {
      return layout;
    }

    let merged = this.mergeDeep({}, base);
    overrides.forEach((override) => {
      const scope = override.scope as ViewScope | undefined;
      const scopeKey = override.scope_key as string | undefined;
      const patch = override.layout as Record<string, unknown> | undefined;
      if (!scope || !patch) {
        return;
      }
      const matchesScope = scope === variant.scope;
      const matchesKey = scopeKey ? scopeKey === variant.scopeKey : true;
      if (matchesScope && matchesKey) {
        merged = this.mergeDeep(merged, patch);
      }
    });

    return merged;
  }

  private applyFieldPermissions(
    layout: Record<string, unknown>,
    fieldPermissions: Record<string, FieldPermission>,
    kind: ViewResolveInput['kind']
  ): Record<string, unknown> {
    if (!layout || typeof layout !== 'object') {
      return layout;
    }
    if (Object.keys(fieldPermissions).length === 0) {
      return layout;
    }

    if (kind === 'list') {
      const updated: Record<string, unknown> = { ...layout };
      const listLayout = (updated.list as Record<string, unknown> | undefined) || updated;
      const columns = listLayout.columns as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(columns)) {
        const nextColumns = columns.map((column) => {
          const code = (column.property_code || column.code) as string | undefined;
          if (!code) return column;
          const permissions = fieldPermissions[code];
          if (!permissions) return column;
          const isHidden = column.visible === false || column.hidden === true;
          return {
            ...column,
            visible: isHidden ? false : permissions.canRead,
            editable: permissions.canWrite,
          };
        });
        if (listLayout === updated) {
          updated.columns = nextColumns;
        } else {
          updated.list = { ...listLayout, columns: nextColumns };
        }
      }
      return updated;
    }

    if (kind === 'form') {
      return { ...layout, fieldPermissions };
    }

    return layout;
  }

  private async resolveFieldPermissions(
    input: ViewResolveInput,
    ctx: RequestContext
  ): Promise<Record<string, FieldPermission>> {
    if (!input.collection) {
      return {};
    }
    const collection = await this.collectionRepo.findOne({ where: { code: input.collection } });
    if (!collection) {
      return {};
    }
    const properties = await this.propertyRepo.find({
      where: { collectionId: collection.id, isActive: true },
      order: { position: 'ASC' },
    });

    const metas: PropertyMeta[] = properties.map((prop) => ({
      code: prop.code,
      label: prop.name,
      type: (prop.config?.dataType as string) || undefined,
      isSystem: prop.isSystem,
    }));

    const authorized = await this.authz.getAuthorizedFields(ctx, collection.tableName, metas);
    return authorized.reduce<Record<string, FieldPermission>>((acc, field) => {
      acc[field.code] = {
        canRead: field.canRead,
        canWrite: field.canWrite,
        maskingStrategy: field.maskingStrategy,
      };
      return acc;
    }, {});
  }

  private mergeDeep(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const output = { ...target };
    Object.entries(source).forEach(([key, value]) => {
      if (this.isPlainObject(value) && this.isPlainObject(output[key])) {
        output[key] = this.mergeDeep(output[key] as Record<string, unknown>, value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private normalizeRoute(route: string): string {
    return route.replace(/^\/+|\/+$/g, '');
  }

  private validateResolveInput(input: ViewResolveInput) {
    if (!input.kind) {
      throw new BadRequestException('kind is required');
    }
    if ((input.kind === 'form' || input.kind === 'list') && !input.collection) {
      throw new BadRequestException('collection is required for form and list views');
    }
  }

  async buildContext(userId: string, roles: string[]): Promise<ViewContext> {
    const groups = await this.fetchUserGroups(userId);
    return { userId, roles, groups };
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
