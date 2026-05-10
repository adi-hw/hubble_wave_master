import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CollectionDefinition,
  DisplayAction,
  DisplayRule,
  DisplayRuleRevision,
} from '@hubblewave/instance-db';

export interface DisplayRuleDto {
  name: string;
  description?: string;
  condition: Record<string, unknown>;
  actions: DisplayAction[];
  priority?: number;
  isActive?: boolean;
}

const VALID_ACTIONS = new Set<DisplayAction['action']>([
  'show',
  'hide',
  'mandatory',
  'optional',
  'readonly',
  'editable',
  'setValue',
]);

/**
 * Plan §7.3 — DisplayRule CRUD service. Mirrors the ADR-5 lifecycle
 * pattern (parent + draft revision + publish flips revision +
 * collection-cascading status). Conditions are stored raw; the
 * frontend evaluator and a future server-side resolver evaluate them.
 *
 * Defensive validation: actions[].action must be one of the
 * recognized DisplayActionKind values, and propertyCode must be
 * non-empty. Backend rejection is the last line of defense; the
 * frontend editor should never construct an invalid action, but if
 * it does we'd rather fail loudly than persist data that breaks
 * runtime evaluators.
 */
@Injectable()
export class DisplayRuleService {
  private readonly logger = new Logger(DisplayRuleService.name);

  constructor(
    @InjectRepository(DisplayRule)
    private readonly ruleRepo: Repository<DisplayRule>,
    @InjectRepository(DisplayRuleRevision)
    private readonly _revisionRepo: Repository<DisplayRuleRevision>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    private readonly dataSource: DataSource,
  ) {
    void this._revisionRepo;
  }

  /**
   * List rules for a collection. The DEFAULT excludes drafts so any
   * runtime caller (resolveView, public APIs) sees only published
   * rules — this is the publish lifecycle promise. The editor surface
   * passes `includeDrafts=true` to see its in-progress edits.
   *
   * `includeInactive` is independent: inactive rules are soft-deleted
   * and the editor surfaces them as "Deprecated" history.
   */
  async list(
    collectionId: string,
    includeInactive = false,
    includeDrafts = false,
  ): Promise<DisplayRule[]> {
    const qb = this.ruleRepo
      .createQueryBuilder('r')
      .where('r.collection_id = :collectionId', { collectionId })
      .orderBy('r.priority', 'ASC')
      .addOrderBy('r.created_at', 'ASC');
    if (!includeInactive) {
      qb.andWhere('r.is_active = true');
    }
    if (!includeDrafts) {
      qb.andWhere(`r.status = 'published'`);
    }
    return qb.getMany();
  }

  async get(id: string): Promise<DisplayRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`DisplayRule ${id} not found`);
    return rule;
  }

  async create(
    collectionId: string,
    dto: DisplayRuleDto,
    userId?: string,
  ): Promise<DisplayRule> {
    this.assertValidActions(dto.actions);
    const collection = await this.collectionRepo.findOne({ where: { id: collectionId } });
    if (!collection) throw new NotFoundException(`Collection ${collectionId} not found`);
    if (!collection.applicationId) {
      throw new BadRequestException(
        `Collection ${collectionId} has no applicationId; ADR-6 requires every metadata entity scoped to an Application.`,
      );
    }
    const applicationId = collection.applicationId;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    try {
      const rule = queryRunner.manager.create(DisplayRule, {
        collectionId,
        applicationId,
        name: dto.name,
        description: dto.description ?? null,
        condition: dto.condition ?? {},
        actions: dto.actions ?? [],
        priority: dto.priority ?? 100,
        isActive: dto.isActive ?? true,
        status: 'draft',
        createdBy: userId,
        updatedBy: userId,
      });
      const saved = await queryRunner.manager.save(DisplayRule, rule);

      const revision = queryRunner.manager.create(DisplayRuleRevision, {
        displayRuleId: saved.id,
        revision: 1,
        status: 'draft',
        payload: this.snapshot(saved),
        createdBy: userId ?? null,
      });
      const savedRevision = await queryRunner.manager.save(DisplayRuleRevision, revision);

      await queryRunner.manager.update(DisplayRule, saved.id, {
        currentRevisionId: savedRevision.id,
      });

      await queryRunner.commitTransaction();
      return (await this.ruleRepo.findOne({ where: { id: saved.id } })) as DisplayRule;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    id: string,
    dto: Partial<DisplayRuleDto>,
    userId?: string,
  ): Promise<DisplayRule> {
    if (dto.actions) this.assertValidActions(dto.actions);
    await this.get(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    try {
      const updateData: Record<string, unknown> = {
        updatedBy: userId,
        status: 'draft',
      };
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.condition !== undefined) updateData.condition = dto.condition;
      if (dto.actions !== undefined) updateData.actions = dto.actions;
      if (dto.priority !== undefined) updateData.priority = dto.priority;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      await queryRunner.manager.update(DisplayRule, id, updateData);
      const refreshed = await queryRunner.manager.findOneOrFail(DisplayRule, {
        where: { id },
      });

      const nextRev = await this.nextRevisionNumber(queryRunner.manager, id);
      const revision = queryRunner.manager.create(DisplayRuleRevision, {
        displayRuleId: id,
        revision: nextRev,
        status: 'draft',
        payload: this.snapshot(refreshed),
        createdBy: userId ?? null,
      });
      const savedRevision = await queryRunner.manager.save(DisplayRuleRevision, revision);
      await queryRunner.manager.update(DisplayRule, id, {
        currentRevisionId: savedRevision.id,
      });

      await queryRunner.commitTransaction();
      return (await this.ruleRepo.findOne({ where: { id } })) as DisplayRule;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `update DisplayRule ${id} failed: ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async publish(id: string, userId?: string): Promise<DisplayRule> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    try {
      const rule = await queryRunner.manager.findOne(DisplayRule, { where: { id } });
      if (!rule) throw new NotFoundException(`DisplayRule ${id} not found`);
      const now = new Date();

      if (rule.currentRevisionId) {
        const revision = await queryRunner.manager.findOne(DisplayRuleRevision, {
          where: { id: rule.currentRevisionId },
        });
        if (revision && revision.status !== 'published') {
          revision.status = 'published';
          revision.publishedBy = userId ?? null;
          revision.publishedAt = now;
          await queryRunner.manager.save(DisplayRuleRevision, revision);
        }
      }

      rule.status = 'published';
      rule.publishedAt = now;
      rule.updatedBy = userId;
      await queryRunner.manager.save(DisplayRule, rule);

      await queryRunner.commitTransaction();
      return rule;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async delete(id: string): Promise<void> {
    const rule = await this.get(id);
    await this.ruleRepo.update(rule.id, { isActive: false, status: 'deprecated' });
  }

  private assertValidActions(actions: DisplayAction[] | undefined): void {
    if (!actions) return;
    if (!Array.isArray(actions)) {
      throw new BadRequestException('actions must be an array');
    }
    for (const action of actions) {
      if (!action || typeof action !== 'object') {
        throw new BadRequestException('Each action must be an object');
      }
      if (!action.propertyCode || typeof action.propertyCode !== 'string') {
        throw new BadRequestException('Each action requires a propertyCode');
      }
      if (!VALID_ACTIONS.has(action.action)) {
        throw new BadRequestException(
          `Unknown DisplayAction kind: ${action.action}. Allowed: ${[...VALID_ACTIONS].join(', ')}`,
        );
      }
      if (action.action === 'setValue' && action.value === undefined) {
        throw new BadRequestException(
          'setValue actions require a `value` field (use null for explicit clear)',
        );
      }
    }
  }

  private snapshot(rule: DisplayRule): Record<string, unknown> {
    return {
      name: rule.name,
      description: rule.description,
      collectionId: rule.collectionId,
      applicationId: rule.applicationId,
      condition: rule.condition,
      actions: rule.actions,
      priority: rule.priority,
      isActive: rule.isActive,
    };
  }

  private async nextRevisionNumber(
    manager: import('typeorm').EntityManager,
    ruleId: string,
  ): Promise<number> {
    const result: Array<{ max: number | string | null }> = await manager
      .createQueryBuilder(DisplayRuleRevision, 'rev')
      .select('MAX(rev.revision)', 'max')
      .where('rev.display_rule_id = :ruleId', { ruleId })
      .getRawMany();
    const max = result[0]?.max;
    return (typeof max === 'string' ? parseInt(max, 10) : max ?? 0) + 1;
  }
}
