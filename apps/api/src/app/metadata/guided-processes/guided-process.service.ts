import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CollectionDefinition,
  DecisionTable,
  GuidedActivityKind,
  GuidedProcessActivity,
  GuidedProcessDefinition,
  GuidedProcessStage,
  ProcessFlowDefinition,
} from '@hubblewave/instance-db';

export interface CreateGuidedProcessDto {
  code: string;
  name: string;
  description?: string;
  stages: Array<{
    name: string;
    description?: string;
    position?: number;
    visibilityCondition?: Record<string, unknown> | null;
    activities: Array<{
      name: string;
      description?: string;
      position?: number;
      kind: GuidedActivityKind;
      processFlowCode?: string | null;
      requiredCondition?: Record<string, unknown> | null;
    }>;
  }>;
}

export interface UpdateGuidedProcessDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

const VALID_KINDS: ReadonlySet<GuidedActivityKind> = new Set([
  'flow',
  'manual_task',
  'decision',
]);

@Injectable()
export class GuidedProcessService {
  constructor(
    @InjectRepository(GuidedProcessDefinition)
    private readonly defRepo: Repository<GuidedProcessDefinition>,
    @InjectRepository(GuidedProcessStage)
    private readonly _stageRepo: Repository<GuidedProcessStage>,
    @InjectRepository(GuidedProcessActivity)
    private readonly _activityRepo: Repository<GuidedProcessActivity>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(ProcessFlowDefinition)
    private readonly flowRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(DecisionTable)
    private readonly decisionRepo: Repository<DecisionTable>,
    private readonly dataSource: DataSource,
  ) {
    void this._stageRepo;
    void this._activityRepo;
  }

  async list(collectionId: string, includeInactive = false): Promise<GuidedProcessDefinition[]> {
    const qb = this.defRepo
      .createQueryBuilder('p')
      .where('p.collection_id = :collectionId', { collectionId })
      .orderBy('p.name', 'ASC');
    if (!includeInactive) {
      qb.andWhere('p.is_active = true');
    }
    return qb.getMany();
  }

  async get(id: string): Promise<GuidedProcessDefinition> {
    const process = await this.defRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.stages', 'stage')
      .leftJoinAndSelect('stage.activities', 'activity')
      .where('p.id = :id', { id })
      .orderBy('stage.position', 'ASC')
      .addOrderBy('activity.position', 'ASC')
      .getOne();
    if (!process) {
      throw new NotFoundException(`Guided Process ${id} not found`);
    }
    return process;
  }

  async create(
    collectionId: string,
    dto: CreateGuidedProcessDto,
    userId?: string,
  ): Promise<GuidedProcessDefinition> {
    if (!dto.code) throw new BadRequestException('code is required');
    if (!dto.name) throw new BadRequestException('name is required');
    this.assertValidStages(dto.stages);

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
      const definition = queryRunner.manager.create(GuidedProcessDefinition, {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        collectionId,
        applicationId,
        status: 'draft',
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      });
      const savedDef = await queryRunner.manager.save(GuidedProcessDefinition, definition);

      for (const [stageIdx, stageDto] of (dto.stages ?? []).entries()) {
        const stage = queryRunner.manager.create(GuidedProcessStage, {
          processId: savedDef.id,
          name: stageDto.name,
          description: stageDto.description ?? null,
          position: stageDto.position ?? stageIdx,
          visibilityCondition: stageDto.visibilityCondition ?? null,
        });
        const savedStage = await queryRunner.manager.save(GuidedProcessStage, stage);

        for (const [actIdx, actDto] of (stageDto.activities ?? []).entries()) {
          const activity = queryRunner.manager.create(GuidedProcessActivity, {
            stageId: savedStage.id,
            name: actDto.name,
            description: actDto.description ?? null,
            position: actDto.position ?? actIdx,
            kind: actDto.kind,
            processFlowCode: actDto.processFlowCode ?? null,
            requiredCondition: actDto.requiredCondition ?? null,
          });
          await queryRunner.manager.save(GuidedProcessActivity, activity);
        }
      }

      await queryRunner.commitTransaction();
      return this.get(savedDef.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    id: string,
    dto: UpdateGuidedProcessDto,
    userId?: string,
  ): Promise<GuidedProcessDefinition> {
    await this.get(id);
    const updateData: Record<string, unknown> = { updatedBy: userId, status: 'draft' };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    await this.defRepo.update(id, updateData);
    return this.get(id);
  }

  /**
   * Replace the stages + activities of an existing process. Editing
   * the playbook structure runs as a single transaction: existing
   * stages/activities are deleted (CASCADE handles activities under
   * their stages) and the new tree is inserted. The process flips
   * back to `draft` so the editor's Save → Publish flow stays clean.
   *
   * Same `assertValidStages` invariants as `create`. The visual
   * editor is the only caller in V1 (plan §15.1).
   */
  async replaceStructure(
    id: string,
    stages: CreateGuidedProcessDto['stages'],
    userId?: string,
  ): Promise<GuidedProcessDefinition> {
    const process = await this.get(id);
    this.assertValidStages(stages);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    try {
      // CASCADE on stage delete drops the children (FK on activity →
      // stage uses ON DELETE CASCADE).
      await queryRunner.manager.delete(GuidedProcessStage, { processId: process.id });

      for (const [stageIdx, stageDto] of stages.entries()) {
        const stage = queryRunner.manager.create(GuidedProcessStage, {
          processId: process.id,
          name: stageDto.name,
          description: stageDto.description ?? null,
          position: stageDto.position ?? stageIdx,
          visibilityCondition: stageDto.visibilityCondition ?? null,
        });
        const savedStage = await queryRunner.manager.save(GuidedProcessStage, stage);

        for (const [actIdx, actDto] of (stageDto.activities ?? []).entries()) {
          const activity = queryRunner.manager.create(GuidedProcessActivity, {
            stageId: savedStage.id,
            name: actDto.name,
            description: actDto.description ?? null,
            position: actDto.position ?? actIdx,
            kind: actDto.kind,
            processFlowCode: actDto.processFlowCode ?? null,
            requiredCondition: actDto.requiredCondition ?? null,
          });
          await queryRunner.manager.save(GuidedProcessActivity, activity);
        }
      }

      // Editing the structure invalidates a published version.
      await queryRunner.manager.update(GuidedProcessDefinition, process.id, {
        status: 'draft',
        updatedBy: userId,
      });

      await queryRunner.commitTransaction();
      return this.get(process.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async publish(id: string, userId?: string): Promise<GuidedProcessDefinition> {
    const process = await this.get(id);
    await this.assertDependenciesPublished(process);
    process.status = 'published';
    process.publishedAt = new Date();
    process.updatedBy = userId;
    await this.defRepo.save(process);
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    await this.defRepo.update(id, { isActive: false, status: 'deprecated' });
  }

  private async assertDependenciesPublished(
    process: GuidedProcessDefinition,
  ): Promise<void> {
    const flowCodes = new Set<string>();
    const decisionCodes = new Set<string>();
    const errors: string[] = [];

    for (const stage of process.stages ?? []) {
      for (const activity of stage.activities ?? []) {
        const code = activity.processFlowCode?.trim();
        if (activity.kind === 'flow') {
          if (!code) {
            errors.push(
              `Activity "${activity.name}" (kind=flow) is missing processFlowCode.`,
            );
            continue;
          }
          flowCodes.add(code);
        } else if (activity.kind === 'decision') {
          if (!code) {
            errors.push(
              `Activity "${activity.name}" (kind=decision) is missing decision table code.`,
            );
            continue;
          }
          decisionCodes.add(code);
        }
      }
    }

    if (flowCodes.size > 0) {
      const flows = await this.flowRepo.find({
        where: [...flowCodes].map((code) => ({ code })),
      });
      const flowByCode = new Map(flows.map((f) => [f.code, f]));
      for (const code of flowCodes) {
        const flow = flowByCode.get(code);
        if (!flow) {
          errors.push(`Process Flow "${code}" does not exist.`);
        } else if (flow.status !== 'published') {
          errors.push(
            `Process Flow "${code}" is in status "${flow.status}". Publish it before publishing this Guided Process.`,
          );
        }
      }
    }

    if (decisionCodes.size > 0) {
      const tables = await this.decisionRepo.find({
        where: [...decisionCodes].map((code) => ({ code })),
      });
      const tableByCode = new Map(tables.map((t) => [t.code, t]));
      for (const code of decisionCodes) {
        const table = tableByCode.get(code);
        if (!table) {
          errors.push(`Decision Table "${code}" does not exist.`);
        } else if (table.status !== 'published') {
          errors.push(
            `Decision Table "${code}" is in status "${table.status}". Publish it before publishing this Guided Process.`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Cannot publish Guided Process: unresolved dependencies',
        errors,
      });
    }
  }

  private assertValidStages(stages: CreateGuidedProcessDto['stages']): void {
    if (!Array.isArray(stages) || stages.length === 0) {
      throw new BadRequestException('At least one stage is required');
    }
    for (const stage of stages) {
      if (!stage.name) throw new BadRequestException('Each stage requires a name');
      if (!Array.isArray(stage.activities) || stage.activities.length === 0) {
        throw new BadRequestException(
          `Stage "${stage.name}" requires at least one activity`,
        );
      }
      for (const activity of stage.activities) {
        if (!activity.name) {
          throw new BadRequestException('Each activity requires a name');
        }
        if (!VALID_KINDS.has(activity.kind)) {
          throw new BadRequestException(
            `Unknown activity kind: ${activity.kind}. Allowed: ${[...VALID_KINDS].join(', ')}`,
          );
        }
        if (
          (activity.kind === 'flow' || activity.kind === 'decision') &&
          !activity.processFlowCode
        ) {
          throw new BadRequestException(
            `Activity "${activity.name}" with kind=${activity.kind} requires processFlowCode`,
          );
        }
      }
    }
  }
}
