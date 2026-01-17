import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProcessFlowDefinition,
  ProcessFlowExecutionHistory,
  ProcessFlowInstance,
} from '@hubblewave/instance-db';
import { ProcessFlowEngineService } from '@hubblewave/automation';
import { StartWorkflowRequest, WorkflowInstanceQuery } from './workflow.types';
import { WorkflowAuditService } from './workflow-audit.service';

@Injectable()
export class WorkflowInstanceService {
  constructor(
    @InjectRepository(ProcessFlowDefinition)
    private readonly definitionRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(ProcessFlowInstance)
    private readonly instanceRepo: Repository<ProcessFlowInstance>,
    @InjectRepository(ProcessFlowExecutionHistory)
    private readonly historyRepo: Repository<ProcessFlowExecutionHistory>,
    private readonly engine: ProcessFlowEngineService,
    private readonly auditService: WorkflowAuditService,
  ) {}

  async list(query: WorkflowInstanceQuery) {
    const qb = this.instanceRepo.createQueryBuilder('instance');
    if (query.state) {
      qb.andWhere('instance.state = :state', { state: query.state });
    }
    if (query.processFlowId) {
      qb.andWhere('instance.processFlowId = :processFlowId', { processFlowId: query.processFlowId });
    }
    if (query.collectionId) {
      qb.andWhere('instance.collectionId = :collectionId', { collectionId: query.collectionId });
    }
    if (query.recordId) {
      qb.andWhere('instance.recordId = :recordId', { recordId: query.recordId });
    }
    qb.orderBy('instance.createdAt', 'DESC');
    return qb.getMany();
  }

  async getById(id: string) {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) {
      throw new NotFoundException('Workflow instance not found');
    }
    return instance;
  }

  async getHistory(instanceId: string) {
    await this.getById(instanceId);
    return this.historyRepo.find({
      where: { instanceId },
      order: { createdAt: 'DESC' },
    });
  }

  async start(definitionId: string, request: StartWorkflowRequest, actorId?: string) {
    const definition = await this.definitionRepo.findOne({ where: { id: definitionId } });
    if (!definition) {
      throw new NotFoundException('Workflow definition not found');
    }
    if (!definition.isActive) {
      throw new BadRequestException('Workflow definition is not active');
    }

    const input = request.input || {};
    const instance = await this.engine.startProcessFlow(
      definition.code,
      input,
      actorId,
      request.recordId,
    );

    await this.auditService.record({
      actorId,
      action: 'workflow.start',
      recordId: instance.id,
      newValues: {
        workflowId: definition.id,
        workflowCode: definition.code,
        instanceId: instance.id,
        recordId: request.recordId || null,
      },
    });

    return instance;
  }

  async cancel(instanceId: string, actorId?: string) {
    const instance = await this.getById(instanceId);
    if (['completed', 'failed', 'cancelled'].includes(instance.state)) {
      return instance;
    }

    const previous = { state: instance.state };
    instance.state = 'cancelled';
    instance.completedAt = new Date();
    await this.instanceRepo.save(instance);

    await this.auditService.record({
      actorId,
      action: 'workflow.cancel',
      recordId: instance.id,
      oldValues: previous,
      newValues: { state: instance.state },
    });

    return instance;
  }
}
