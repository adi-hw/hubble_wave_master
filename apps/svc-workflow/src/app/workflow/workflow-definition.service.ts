import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessFlowDefinition } from '@hubblewave/instance-db';
import {
  CreateWorkflowDefinitionRequest,
  UpdateWorkflowDefinitionRequest,
  WorkflowListQuery,
} from './workflow.types';
import { WorkflowAuditService } from './workflow-audit.service';

@Injectable()
export class WorkflowDefinitionService {
  constructor(
    @InjectRepository(ProcessFlowDefinition)
    private readonly definitionRepo: Repository<ProcessFlowDefinition>,
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

  async create(request: CreateWorkflowDefinitionRequest, actorId?: string) {
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

    const definition = this.definitionRepo.create({
      code: request.code,
      name: request.name.trim(),
      description: request.description?.trim() || undefined,
      collectionId: request.collectionId || undefined,
      triggerType: request.triggerType || 'manual',
      triggerConditions: request.triggerConditions || undefined,
      triggerSchedule: request.triggerSchedule || undefined,
      triggerFilter: request.triggerFilter || undefined,
      runAs: request.runAs || 'system',
      timeoutMinutes: request.timeoutMinutes ?? 60,
      maxRetries: request.maxRetries ?? 3,
      canvas: this.normalizeCanvas(request.canvas),
      version: 1,
      isActive: false,
      createdBy: actorId || undefined,
      updatedBy: actorId || undefined,
    } as Partial<ProcessFlowDefinition>);

    const saved = await this.definitionRepo.save(definition);
    await this.auditService.record({
      actorId,
      action: 'workflow.create',
      recordId: saved.id,
      newValues: this.auditValues(saved),
    });
    return saved;
  }

  async update(id: string, request: UpdateWorkflowDefinitionRequest, actorId?: string) {
    const definition = await this.getById(id);

    if (request.name !== undefined && request.name.trim().length === 0) {
      throw new BadRequestException('workflow.name is required');
    }

    const previous = this.auditValues(definition);

    definition.name = request.name?.trim() ?? definition.name;
    definition.description = request.description?.trim() || undefined;
    definition.collectionId = request.collectionId ?? definition.collectionId;
    definition.triggerType = request.triggerType ?? definition.triggerType;
    definition.triggerConditions = request.triggerConditions ?? definition.triggerConditions;
    definition.triggerSchedule = request.triggerSchedule ?? definition.triggerSchedule;
    definition.triggerFilter = request.triggerFilter ?? definition.triggerFilter;
    definition.runAs = request.runAs ?? definition.runAs;
    definition.timeoutMinutes = request.timeoutMinutes ?? definition.timeoutMinutes;
    definition.maxRetries = request.maxRetries ?? definition.maxRetries;
    if (request.canvas) {
      definition.canvas = this.normalizeCanvas(request.canvas);
    }
    definition.version = definition.version + 1;
    definition.updatedBy = actorId || undefined;

    const saved = await this.definitionRepo.save(definition);
    await this.auditService.record({
      actorId,
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

  async duplicate(id: string, newCode: string, actorId?: string) {
    if (!newCode || !this.isValidCode(newCode)) {
      throw new BadRequestException('workflow.code must be lowercase letters, numbers, or underscore');
    }

    const source = await this.getById(id);
    const existing = await this.definitionRepo.findOne({ where: { code: newCode } });
    if (existing) {
      throw new ConflictException('Workflow code already exists');
    }

    const copy = this.definitionRepo.create({
      code: newCode,
      name: `${source.name} Copy`,
      description: source.description,
      collectionId: source.collectionId,
      triggerType: source.triggerType,
      triggerConditions: source.triggerConditions,
      triggerSchedule: source.triggerSchedule,
      triggerFilter: source.triggerFilter,
      runAs: source.runAs,
      timeoutMinutes: source.timeoutMinutes,
      maxRetries: source.maxRetries,
      canvas: source.canvas,
      version: 1,
      isActive: false,
      createdBy: actorId || undefined,
      updatedBy: actorId || undefined,
    } as Partial<ProcessFlowDefinition>);

    const saved = await this.definitionRepo.save(copy);
    await this.auditService.record({
      actorId,
      action: 'workflow.duplicate',
      recordId: saved.id,
      newValues: this.auditValues(saved),
    });

    return saved;
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
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry)).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
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
