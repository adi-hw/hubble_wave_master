import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ProcessFlowDefinition,
  ProcessFlowDefinitionRevision,
  ProcessFlowRunAs,
  User,
} from '@hubblewave/instance-db';
import {
  CreateWorkflowDefinitionRequest,
  UpdateWorkflowDefinitionRequest,
  WorkflowListQuery,
} from './workflow.types';
import { WorkflowAuditService } from './workflow-audit.service';

// Permissions that allow elevating a workflow's runAs to 'system'.
// 'system' execution bypasses the invoking user's authorization, so creators
// must hold an explicit privilege to assign it.
const SYSTEM_RUN_AS_PERMISSIONS = new Set(['system.admin', 'workflow.run-as-system']);

export interface WorkflowDefinitionActor {
  id?: string;
  isAdmin?: boolean;
  permissions?: string[];
  roles?: string[];
}

@Injectable()
export class WorkflowDefinitionService {
  constructor(
    @InjectRepository(ProcessFlowDefinition)
    private readonly definitionRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(ProcessFlowDefinitionRevision)
    private readonly revisionRepo: Repository<ProcessFlowDefinitionRevision>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditService: WorkflowAuditService,
    private readonly dataSource: DataSource,
  ) {}

  async list(query: WorkflowListQuery) {
    const qb = this.definitionRepo.createQueryBuilder('definition');
    if (query.collectionId) {
      qb.andWhere('definition.collectionId = :collectionId', { collectionId: query.collectionId });
    }
    if (query.code) {
      qb.andWhere('definition.code = :code', { code: query.code });
    }
    if (query.active !== undefined) {
      qb.andWhere('definition.isActive = :active', { active: query.active });
    }
    qb.orderBy('definition.updatedAt', 'DESC');
    return qb.getMany();
  }

  async getById(id: string) {
    const definition = await this.definitionRepo.findOne({ where: { id } });
    if (!definition) {
      throw new NotFoundException('Workflow definition not found');
    }
    return definition;
  }

  async create(request: CreateWorkflowDefinitionRequest, actor?: WorkflowDefinitionActor | string) {
    const actorObj = this.normalizeActor(actor);
    if (!request.code || !this.isValidCode(request.code)) {
      throw new BadRequestException('workflow.code must be lowercase letters, numbers, or underscore');
    }
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('workflow.name is required');
    }

    const existing = await this.definitionRepo.findOne({ where: { code: request.code } });
    if (existing) {
      throw new ConflictException('Workflow code already exists');
    }

    await this.validateCanvasApprovers(request.canvas);
    const resolvedRunAs = this.resolveRunAs(request.runAs, actorObj);

    const applicationId = await this.resolveApplicationId(request.collectionId);

    const definition = this.definitionRepo.create({
      code: request.code,
      name: request.name.trim(),
      description: request.description?.trim() || undefined,
      collectionId: request.collectionId || undefined,
      applicationId,
      triggerType: request.triggerType || 'manual',
      triggerConditions: request.triggerConditions || undefined,
      triggerSchedule: request.triggerSchedule || undefined,
      triggerFilter: request.triggerFilter || undefined,
      runAs: resolvedRunAs,
      timeoutMinutes: request.timeoutMinutes ?? 60,
      maxRetries: request.maxRetries ?? 3,
      canvas: this.normalizeCanvas(request.canvas),
      version: 1,
      isActive: false,
      status: 'draft',
      createdBy: actorObj.id || undefined,
      updatedBy: actorObj.id || undefined,
    } as Partial<ProcessFlowDefinition>);

    const saved = await this.definitionRepo.save(definition);

    // Seed revision 1 (draft) so currentRevisionId is non-null from creation.
    const savedRevision = await this.revisionRepo.save(
      this.revisionRepo.create({
        processFlowId: saved.id,
        revision: 1,
        status: 'draft',
        payload: this.snapshot(saved),
        createdBy: actorObj.id ?? null,
      }),
    );
    saved.currentRevisionId = savedRevision.id;
    await this.definitionRepo.save(saved);

    await this.auditService.record({
      actorId: actorObj.id,
      action: 'workflow.create',
      recordId: saved.id,
      newValues: this.auditValues(saved),
    });
    return saved;
  }

  async update(id: string, request: UpdateWorkflowDefinitionRequest, actor?: WorkflowDefinitionActor | string) {
    const actorObj = this.normalizeActor(actor);
    const definition = await this.getById(id);

    if (request.name !== undefined && request.name.trim().length === 0) {
      throw new BadRequestException('workflow.name is required');
    }

    if (request.canvas) {
      await this.validateCanvasApprovers(request.canvas);
    }

    const previous = this.auditValues(definition);

    definition.name = request.name?.trim() ?? definition.name;
    definition.description = request.description?.trim() || undefined;
    definition.collectionId = request.collectionId ?? definition.collectionId;
    definition.triggerType = request.triggerType ?? definition.triggerType;
    definition.triggerConditions = request.triggerConditions ?? definition.triggerConditions;
    definition.triggerSchedule = request.triggerSchedule ?? definition.triggerSchedule;
    definition.triggerFilter = request.triggerFilter ?? definition.triggerFilter;
    if (request.runAs !== undefined) {
      definition.runAs = this.resolveRunAs(request.runAs, actorObj);
    }
    definition.timeoutMinutes = request.timeoutMinutes ?? definition.timeoutMinutes;
    definition.maxRetries = request.maxRetries ?? definition.maxRetries;
    if (request.canvas) {
      definition.canvas = this.normalizeCanvas(request.canvas);
    }
    definition.version = definition.version + 1;
    definition.updatedBy = actorObj.id || undefined;

    // Per ADR-5 every edit returns the parent to draft and appends a
    // new draft revision. Publishing the new revision flips both back.
    definition.status = 'draft';

    const saved = await this.definitionRepo.save(definition);

    const nextRev = await this.nextRevisionNumber(saved.id);
    const savedRevision = await this.revisionRepo.save(
      this.revisionRepo.create({
        processFlowId: saved.id,
        revision: nextRev,
        status: 'draft',
        payload: this.snapshot(saved),
        createdBy: actorObj.id ?? null,
      }),
    );
    saved.currentRevisionId = savedRevision.id;
    await this.definitionRepo.save(saved);

    await this.auditService.record({
      actorId: actorObj.id,
      action: 'workflow.update',
      recordId: saved.id,
      oldValues: previous,
      newValues: this.auditValues(saved),
    });
    return saved;
  }

  /**
   * Publish the current draft revision of a workflow. Sets the revision
   * status to `published`, stamps publishedBy/publishedAt, and bumps
   * the parent ProcessFlowDefinition to `published`.
   *
   * Note: lifecycle status is orthogonal to operational `is_active`.
   * Publishing a flow does NOT auto-activate it; a separate `activate`
   * call is required for runtime triggers to fire.
   */
  async publish(id: string, actorId?: string) {
    const definition = await this.getById(id);
    const previous = this.auditValues(definition);

    if (!definition.currentRevisionId) {
      throw new NotFoundException(
        `Workflow ${id} has no current revision to publish`,
      );
    }
    const revision = await this.revisionRepo.findOne({
      where: { id: definition.currentRevisionId },
    });
    if (!revision) {
      throw new NotFoundException(
        `Current revision ${definition.currentRevisionId} missing`,
      );
    }

    if (revision.status !== 'published') {
      revision.status = 'published';
      revision.publishedBy = actorId ?? null;
      revision.publishedAt = new Date();
      await this.revisionRepo.save(revision);
    }

    if (definition.status !== 'published') {
      definition.status = 'published';
      definition.publishedAt = new Date();
      definition.updatedBy = actorId || undefined;
      await this.definitionRepo.save(definition);
    }

    await this.auditService.record({
      actorId,
      action: 'workflow.publish',
      recordId: definition.id,
      oldValues: previous,
      newValues: this.auditValues(definition),
    });
    return definition;
  }

  /** Soft-deprecate a workflow definition. */
  async deprecate(id: string, actorId?: string) {
    const definition = await this.getById(id);
    const previous = this.auditValues(definition);
    definition.status = 'deprecated';
    definition.updatedBy = actorId || undefined;
    const saved = await this.definitionRepo.save(definition);
    await this.auditService.record({
      actorId,
      action: 'workflow.deprecate',
      recordId: saved.id,
      oldValues: previous,
      newValues: this.auditValues(saved),
    });
    return saved;
  }

  /** List revisions for a workflow definition, newest first. */
  listRevisions(id: string) {
    return this.revisionRepo.find({
      where: { processFlowId: id },
      order: { revision: 'DESC' },
    });
  }

  async delete(id: string, actorId?: string) {
    const definition = await this.getById(id);
    if (definition.isActive) {
      throw new ConflictException('Active workflow definitions must be deactivated before delete');
    }

    await this.definitionRepo.delete(id);
    await this.auditService.record({
      actorId,
      action: 'workflow.delete',
      recordId: definition.id,
      oldValues: this.auditValues(definition),
    });

    return { id: definition.id, deleted: true };
  }

  async activate(id: string, actorId?: string) {
    const definition = await this.getById(id);
    if (!definition.isActive) {
      const previous = this.auditValues(definition);
      definition.isActive = true;
      definition.updatedBy = actorId || undefined;
      const saved = await this.definitionRepo.save(definition);
      await this.auditService.record({
        actorId,
        action: 'workflow.activate',
        recordId: saved.id,
        oldValues: previous,
        newValues: this.auditValues(saved),
      });
      return saved;
    }
    return definition;
  }

  async deactivate(id: string, actorId?: string) {
    const definition = await this.getById(id);
    if (definition.isActive) {
      const previous = this.auditValues(definition);
      definition.isActive = false;
      definition.updatedBy = actorId || undefined;
      const saved = await this.definitionRepo.save(definition);
      await this.auditService.record({
        actorId,
        action: 'workflow.deactivate',
        recordId: saved.id,
        oldValues: previous,
        newValues: this.auditValues(saved),
      });
      return saved;
    }
    return definition;
  }

  async duplicate(id: string, newCode: string, actor?: WorkflowDefinitionActor | string) {
    const actorObj = this.normalizeActor(actor);
    if (!newCode || !this.isValidCode(newCode)) {
      throw new BadRequestException('workflow.code must be lowercase letters, numbers, or underscore');
    }

    const source = await this.getById(id);
    const existing = await this.definitionRepo.findOne({ where: { code: newCode } });
    if (existing) {
      throw new ConflictException('Workflow code already exists');
    }

    // Duplicating preserves the source's runAs only if the actor is allowed to set it.
    const sourceRunAs: ProcessFlowRunAs = source.runAs;
    const resolvedRunAs =
      sourceRunAs === 'system' && !this.actorCanRunAsSystem(actorObj) ? 'triggering_user' : sourceRunAs;

    const copy = this.definitionRepo.create({
      code: newCode,
      name: `${source.name} Copy`,
      description: source.description,
      collectionId: source.collectionId,
      applicationId: source.applicationId,
      triggerType: source.triggerType,
      triggerConditions: source.triggerConditions,
      triggerSchedule: source.triggerSchedule,
      triggerFilter: source.triggerFilter,
      runAs: resolvedRunAs,
      timeoutMinutes: source.timeoutMinutes,
      maxRetries: source.maxRetries,
      canvas: source.canvas,
      version: 1,
      isActive: false,
      status: 'draft',
      createdBy: actorObj.id || undefined,
      updatedBy: actorObj.id || undefined,
    } as Partial<ProcessFlowDefinition>);

    const saved = await this.definitionRepo.save(copy);

    // Seed revision 1 (draft) for the duplicated workflow as well.
    const savedRevision = await this.revisionRepo.save(
      this.revisionRepo.create({
        processFlowId: saved.id,
        revision: 1,
        status: 'draft',
        payload: this.snapshot(saved),
        createdBy: actorObj.id ?? null,
      }),
    );
    saved.currentRevisionId = savedRevision.id;
    await this.definitionRepo.save(saved);

    await this.auditService.record({
      actorId: actorObj.id,
      action: 'workflow.duplicate',
      recordId: saved.id,
      newValues: this.auditValues(saved),
    });

    return saved;
  }

  /**
   * Resolve the Application a workflow should belong to. When bound to
   * a collection, inherit that collection's applicationId; otherwise
   * fall back to the `default` Application created in Slice A.
   */
  private async resolveApplicationId(collectionId?: string | null): Promise<string> {
    if (collectionId) {
      const result: Array<{ application_id: string | null }> = await this.dataSource.query(
        `SELECT application_id FROM collection_definitions WHERE id = $1 LIMIT 1`,
        [collectionId],
      );
      const fromCollection = result[0]?.application_id;
      if (fromCollection) {
        return fromCollection;
      }
    }
    const fallback: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM applications WHERE code = 'default' LIMIT 1`,
    );
    if (fallback.length === 0) {
      throw new NotFoundException(
        'Default Application missing — applications-registry migration must run first.',
      );
    }
    return fallback[0].id;
  }

  /** Authoring snapshot persisted on every ProcessFlowDefinitionRevision row. */
  private snapshot(d: ProcessFlowDefinition): Record<string, unknown> {
    return {
      name: d.name,
      code: d.code,
      description: d.description,
      collectionId: d.collectionId,
      applicationId: d.applicationId,
      version: d.version,
      isActive: d.isActive,
      canvas: d.canvas,
      triggerType: d.triggerType,
      triggerConditions: d.triggerConditions,
      triggerSchedule: d.triggerSchedule,
      triggerFilter: d.triggerFilter,
      runAs: d.runAs,
      timeoutMinutes: d.timeoutMinutes,
      maxRetries: d.maxRetries,
    };
  }

  private async nextRevisionNumber(processFlowId: string): Promise<number> {
    const result: Array<{ max: number | string | null }> = await this.revisionRepo
      .createQueryBuilder('rev')
      .select('MAX(rev.revision)', 'max')
      .where('rev.process_flow_id = :processFlowId', { processFlowId })
      .getRawMany();
    const current = Number(result[0]?.max ?? 0);
    return Number.isFinite(current) ? current + 1 : 1;
  }

  private normalizeActor(actor?: WorkflowDefinitionActor | string): WorkflowDefinitionActor {
    if (!actor) {
      return {};
    }
    if (typeof actor === 'string') {
      return { id: actor };
    }
    return actor;
  }

  private actorCanRunAsSystem(actor: WorkflowDefinitionActor): boolean {
    if (actor.isAdmin) {
      return true;
    }
    if (actor.roles?.includes('admin')) {
      return true;
    }
    if (!actor.permissions) {
      return false;
    }
    return actor.permissions.some((perm) => SYSTEM_RUN_AS_PERMISSIONS.has(perm));
  }

  private resolveRunAs(
    requested: ProcessFlowRunAs | undefined,
    actor: WorkflowDefinitionActor,
  ): ProcessFlowRunAs {
    // Default execution context is the user who triggered the workflow.
    // Promoting to 'system' bypasses invoker authorization, so it is gated by
    // an explicit permission held by the workflow's creator.
    if (!requested) {
      return 'triggering_user';
    }
    if (requested === 'system' && !this.actorCanRunAsSystem(actor)) {
      throw new ForbiddenException(
        "Setting runAs='system' requires the 'system.admin' or 'workflow.run-as-system' permission",
      );
    }
    return requested;
  }

  private async validateCanvasApprovers(
    canvas: ProcessFlowDefinition['canvas'] | undefined,
  ): Promise<void> {
    if (!canvas?.nodes?.length) {
      return;
    }
    const approverIds = new Set<string>();
    for (const node of canvas.nodes) {
      if (!node || typeof node !== 'object') continue;
      const nodeType = (node as ProcessFlowDefinition['canvas']['nodes'][number]).type as string;
      if (nodeType !== 'create_approval' && nodeType !== 'approval') continue;
      const approvers = this.parseApprovers(node.config?.approvers);
      for (const id of approvers) {
        approverIds.add(id);
      }
    }
    if (approverIds.size === 0) {
      return;
    }
    const ids = Array.from(approverIds);
    const users = await this.userRepo.find({
      where: ids.map((id) => ({ id })),
      select: ['id', 'status', 'deletedAt'],
    });
    const activeIds = new Set(
      users.filter((u) => u.status === 'active' && !u.deletedAt).map((u) => u.id),
    );
    const missing = ids.filter((id) => !activeIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown or inactive approver(s): ${missing.join(', ')}`);
    }
  }

  private isValidCode(code: string): boolean {
    return /^[a-z0-9_]+$/.test(code) && code.length <= 120;
  }

  private normalizeCanvas(
    canvas: ProcessFlowDefinition['canvas'] | undefined
  ): ProcessFlowDefinition['canvas'] {
    if (!canvas) {
      return { nodes: [], connections: [] };
    }

    const nodes = (canvas.nodes || []).map((node) => {
      if (!node || typeof node !== 'object') {
        return node;
      }

      const nodeType = (node as ProcessFlowDefinition['canvas']['nodes'][number]).type as string;
      const actionTypes = ['update_record', 'create_record', 'send_email', 'send_notification'];
      if (actionTypes.includes(nodeType)) {
        return {
          ...node,
          type: 'action',
          config: {
            actionType: nodeType,
            actionConfig: node.config || {},
          },
        };
      }

      if (nodeType === 'create_approval') {
        const approvers = this.parseApprovers(node.config?.approvers);
        const approvalType = node.config?.approvalType || 'sequential';
        const dueDays = Number(node.config?.dueDays || 0);
        const timeoutMinutes = Number.isFinite(dueDays) && dueDays > 0 ? dueDays * 24 * 60 : undefined;
        return {
          ...node,
          type: 'approval',
          config: {
            ...node.config,
            approvers,
            approvalType,
            timeoutMinutes,
          },
        };
      }

      if (nodeType === 'wait') {
        const waitType = node.config?.waitType || 'duration';
        const durationValue = Number(node.config?.durationValue || node.config?.duration || 0);
        const durationUnit = node.config?.durationUnit || 'minutes';
        return {
          ...node,
          config: {
            ...node.config,
            waitType,
            duration: durationValue,
            durationUnit,
          },
        };
      }

      return node;
    });

    return {
      nodes,
      connections: canvas.connections || [],
    } as ProcessFlowDefinition['canvas'];
  }

  private parseApprovers(value: unknown): string[] {
    let entries: string[] = [];
    if (Array.isArray(value)) {
      entries = value.map((entry) => String(entry).trim()).filter(Boolean);
    } else if (typeof value === 'string') {
      entries = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    // Dedupe — duplicate approverIds in canvas configuration would create
    // redundant Approval rows with conflicting sequence numbers at runtime.
    return Array.from(new Set(entries));
  }

  private auditValues(definition: ProcessFlowDefinition) {
    return {
      id: definition.id,
      code: definition.code,
      name: definition.name,
      description: definition.description,
      collectionId: definition.collectionId,
      triggerType: definition.triggerType,
      triggerSchedule: definition.triggerSchedule,
      isActive: definition.isActive,
      version: definition.version,
    };
  }
}
