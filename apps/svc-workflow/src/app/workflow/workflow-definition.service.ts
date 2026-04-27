import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessFlowDefinition, ProcessFlowRunAs, User } from '@hubblewave/instance-db';
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditService: WorkflowAuditService,
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

    const definition = this.definitionRepo.create({
      code: request.code,
      name: request.name.trim(),
      description: request.description?.trim() || undefined,
      collectionId: request.collectionId || undefined,
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
      createdBy: actorObj.id || undefined,
      updatedBy: actorObj.id || undefined,
    } as Partial<ProcessFlowDefinition>);

    const saved = await this.definitionRepo.save(definition);
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

    const saved = await this.definitionRepo.save(definition);
    await this.auditService.record({
      actorId: actorObj.id,
      action: 'workflow.update',
      recordId: saved.id,
      oldValues: previous,
      newValues: this.auditValues(saved),
    });
    return saved;
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
      createdBy: actorObj.id || undefined,
      updatedBy: actorObj.id || undefined,
    } as Partial<ProcessFlowDefinition>);

    const saved = await this.definitionRepo.save(copy);
    await this.auditService.record({
      actorId: actorObj.id,
      action: 'workflow.duplicate',
      recordId: saved.id,
      newValues: this.auditValues(saved),
    });

    return saved;
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
