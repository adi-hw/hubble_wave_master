/**
 * AutomationService
 * HubbleWave Platform - Phase 3
 *
 * Service for managing automation rules (business rules, triggers).
 */

import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  AutomationRule,
  TriggerTiming,
  TriggerOperation,
  AutomationAction,
} from '@hubblewave/instance-db';

export { TriggerTiming, TriggerOperation };

export interface Automation {
  id: string;
  name: string;
  description?: string;
  collectionId: string;
  triggerTiming: TriggerTiming;
  triggerOperations: TriggerOperation[];
  watchProperties?: string[];
  conditionType: 'always' | 'condition' | 'script';
  condition?: Record<string, unknown>;
  conditionScript?: string;
  actionType: 'no_code' | 'script';
  actions?: AutomationAction[];
  script?: string;
  abortOnError: boolean;
  isActive: boolean;
  isSystem: boolean;
  executionOrder: number;
  consecutiveErrors: number;
  lastExecutedAt?: Date;
  metadata: Record<string, unknown>;
}

export interface CreateAutomationDto {
  name: string;
  description?: string;
  collectionId: string;
  triggerTiming: TriggerTiming;
  triggerOperations: TriggerOperation[];
  watchProperties?: string[];
  conditionType?: 'always' | 'condition' | 'script';
  condition?: Record<string, unknown>;
  conditionScript?: string;
  actionType?: 'no_code' | 'script';
  actions?: AutomationAction[];
  script?: string;
  abortOnError?: boolean;
  executionOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateAutomationDto extends Partial<Omit<CreateAutomationDto, 'collectionId'>> {}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectRepository(AutomationRule)
    private readonly automationRepo: Repository<AutomationRule>,
  ) {}

  /**
   * Get all automations for a specific trigger
   */
  async getAutomationsForTrigger(
    collectionId: string,
    timing: TriggerTiming,
    operation: TriggerOperation,
  ): Promise<Automation[]> {
    const automations = await this.automationRepo
      .createQueryBuilder('rule')
      .where('rule.collection_id = :collectionId', { collectionId })
      .andWhere('rule.trigger_timing = :timing', { timing })
      .andWhere('rule.is_active = :isActive', { isActive: true })
      .andWhere('rule.consecutive_errors < :maxErrors', { maxErrors: 5 })
      .orderBy('rule.execution_order', 'ASC')
      .getMany();

    return automations
      .filter((a) => a.triggerOperations.includes(operation))
      .map((a) => this.toAutomation(a));
  }

  /**
   * Get all automations for a collection
   */
  async getAutomationsForCollection(
    collectionId: string,
    includeInactive = false,
  ): Promise<Automation[]> {
    const query = this.automationRepo
      .createQueryBuilder('rule')
      .where('rule.collection_id = :collectionId', { collectionId })
      .orderBy('rule.execution_order', 'ASC');

    if (!includeInactive) {
      query.andWhere('rule.is_active = :isActive', { isActive: true });
    }

    const automations = await query.getMany();
    return automations.map((a) => this.toAutomation(a));
  }

  /**
   * Get all automations across all collections
   */
  async getAllAutomations(includeInactive = false): Promise<Automation[]> {
    const query = this.automationRepo
      .createQueryBuilder('rule')
      .orderBy('rule.collection_id', 'ASC')
      .addOrderBy('rule.execution_order', 'ASC');

    if (!includeInactive) {
      query.andWhere('rule.is_active = :isActive', { isActive: true });
    }

    const automations = await query.getMany();
    return automations.map((a) => this.toAutomation(a));
  }

  /**
   * Get automation by ID
   */
  async getAutomationById(automationId: string): Promise<Automation | null> {
    const automation = await this.automationRepo.findOne({
      where: { id: automationId },
    });

    return automation ? this.toAutomation(automation) : null;
  }

  /**
   * Get automation by ID (throws if not found)
   */
  async getAutomation(automationId: string): Promise<Automation> {
    const automation = await this.getAutomationById(automationId);
    if (!automation) {
      throw new NotFoundException(`Automation with ID '${automationId}' not found`);
    }
    return automation;
  }

  /**
   * Create a new automation rule
   */
  async createAutomation(dto: CreateAutomationDto, userId?: string): Promise<Automation> {
    const existingName = await this.automationRepo.findOne({
      where: { collectionId: dto.collectionId, name: dto.name },
    });

    if (existingName) {
      throw new ConflictException(`Automation with name '${dto.name}' already exists in this collection`);
    }

    const maxOrder = await this.getMaxExecutionOrder(dto.collectionId);

    const automation = this.automationRepo.create({
      name: dto.name,
      description: dto.description,
      collectionId: dto.collectionId,
      triggerTiming: dto.triggerTiming,
      triggerOperations: dto.triggerOperations,
      watchProperties: dto.watchProperties,
      conditionType: dto.conditionType ?? 'always',
      condition: dto.condition,
      conditionScript: dto.conditionScript,
      actionType: dto.actionType ?? 'no_code',
      actions: dto.actions,
      script: dto.script,
      abortOnError: dto.abortOnError ?? false,
      executionOrder: dto.executionOrder ?? maxOrder + 10,
      isActive: dto.isActive ?? true,
      isSystem: false,
      consecutiveErrors: 0,
      metadata: dto.metadata ?? {},
      createdBy: userId,
    });

    const saved = await this.automationRepo.save(automation);
    this.logger.log(`Created automation '${dto.name}' for collection ${dto.collectionId}`);
    return this.toAutomation(saved);
  }

  /**
   * Update an automation rule
   */
  async updateAutomation(
    automationId: string,
    dto: UpdateAutomationDto,
    userId?: string,
  ): Promise<Automation> {
    const existing = await this.automationRepo.findOne({
      where: { id: automationId },
    });

    if (!existing) {
      throw new NotFoundException(`Automation with ID '${automationId}' not found`);
    }

    if (existing.isSystem) {
      throw new ConflictException('Cannot modify system automation');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.triggerTiming !== undefined) updateData.triggerTiming = dto.triggerTiming;
    if (dto.triggerOperations !== undefined) updateData.triggerOperations = dto.triggerOperations;
    if (dto.watchProperties !== undefined) updateData.watchProperties = dto.watchProperties;
    if (dto.conditionType !== undefined) updateData.conditionType = dto.conditionType;
    if (dto.condition !== undefined) updateData.condition = dto.condition;
    if (dto.conditionScript !== undefined) updateData.conditionScript = dto.conditionScript;
    if (dto.actionType !== undefined) updateData.actionType = dto.actionType;
    if (dto.actions !== undefined) updateData.actions = dto.actions;
    if (dto.script !== undefined) updateData.script = dto.script;
    if (dto.abortOnError !== undefined) updateData.abortOnError = dto.abortOnError;
    if (dto.executionOrder !== undefined) updateData.executionOrder = dto.executionOrder;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;
    updateData.updatedBy = userId;

    if (Object.keys(updateData).length > 1) {
      await this.automationRepo.update(automationId, updateData);
    }

    return this.getAutomation(automationId);
  }

  /**
   * Delete an automation rule
   */
  async deleteAutomation(automationId: string, force = false): Promise<{ id: string; deleted: boolean }> {
    const existing = await this.automationRepo.findOne({
      where: { id: automationId },
    });

    if (!existing) {
      throw new NotFoundException(`Automation with ID '${automationId}' not found`);
    }

    if (existing.isSystem && !force) {
      throw new ConflictException('Cannot delete system automation without force flag');
    }

    await this.automationRepo.delete(automationId);
    this.logger.log(`Deleted automation '${existing.name}'`);
    return { id: automationId, deleted: true };
  }

  /**
   * Toggle automation active state
   */
  async toggleAutomation(automationId: string, userId?: string): Promise<Automation> {
    const existing = await this.automationRepo.findOne({
      where: { id: automationId },
    });

    if (!existing) {
      throw new NotFoundException(`Automation with ID '${automationId}' not found`);
    }

    await this.automationRepo.update(automationId, {
      isActive: !existing.isActive,
      updatedBy: userId,
    });

    return this.getAutomation(automationId);
  }

  /**
   * Record successful execution
   */
  async recordSuccess(automationId: string): Promise<void> {
    await this.automationRepo.update(automationId, {
      consecutiveErrors: 0,
      lastExecutedAt: new Date(),
    });
  }

  /**
   * Record failed execution
   */
  async recordError(automationId: string): Promise<void> {
    await this.automationRepo.increment({ id: automationId }, 'consecutiveErrors', 1);
    await this.automationRepo.update(automationId, {
      lastExecutedAt: new Date(),
    });

    const automation = await this.automationRepo.findOne({ where: { id: automationId } });
    if (automation && automation.consecutiveErrors >= 5) {
      this.logger.warn(`Automation '${automation.name}' disabled due to consecutive errors`);
    }
  }

  /**
   * Reorder automations
   */
  async reorderAutomations(
    collectionId: string,
    order: Array<{ id: string; executionOrder: number }>,
  ): Promise<{ success: boolean; updated: number }> {
    const automationIds = order.map((o) => o.id);

    const automations = await this.automationRepo.find({
      where: {
        id: In(automationIds),
        collectionId,
      },
    });

    if (automations.length !== automationIds.length) {
      throw new ConflictException('Some automation IDs do not belong to this collection');
    }

    const updates = order.map(({ id, executionOrder }) =>
      this.automationRepo.update(id, { executionOrder }),
    );

    await Promise.all(updates);
    return { success: true, updated: order.length };
  }

  /**
   * Get max execution order for a collection
   */
  private async getMaxExecutionOrder(collectionId: string): Promise<number> {
    const result = await this.automationRepo
      .createQueryBuilder('rule')
      .select('MAX(rule.execution_order)', 'maxOrder')
      .where('rule.collection_id = :collectionId', { collectionId })
      .getRawOne();

    return result?.maxOrder || 0;
  }

  /**
   * Convert entity to interface
   */
  private toAutomation(entity: AutomationRule): Automation {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      collectionId: entity.collectionId,
      triggerTiming: entity.triggerTiming,
      triggerOperations: entity.triggerOperations,
      watchProperties: entity.watchProperties,
      conditionType: entity.conditionType,
      condition: entity.condition,
      conditionScript: entity.conditionScript,
      actionType: entity.actionType,
      actions: entity.actions,
      script: entity.script,
      abortOnError: entity.abortOnError,
      isActive: entity.isActive,
      isSystem: entity.isSystem,
      executionOrder: entity.executionOrder,
      consecutiveErrors: entity.consecutiveErrors,
      lastExecutedAt: entity.lastExecutedAt,
      metadata: entity.metadata,
    };
  }
}
