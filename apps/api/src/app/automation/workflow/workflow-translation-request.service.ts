import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  ProcessFlowDefinition,
  ProcessFlowInstance,
  TranslationRequest,
  TranslationRequestStatus,
} from '@hubblewave/instance-db';

type ProcessFlowStartedPayload = {
  instanceId: string;
  processFlowCode?: string;
  input?: Record<string, unknown>;
};

type ProcessFlowCompletedPayload = {
  instanceId: string;
  output?: Record<string, unknown>;
};

type ProcessFlowFailedPayload = {
  instanceId: string;
};

@Injectable()
export class WorkflowTranslationRequestService {
  private readonly terminalStatuses = new Set<TranslationRequestStatus>([
    'approved',
    'rejected',
    'cancelled',
    'failed',
  ]);

  constructor(
    @InjectRepository(TranslationRequest)
    private readonly requestRepo: Repository<TranslationRequest>,
    @InjectRepository(ProcessFlowInstance)
    private readonly instanceRepo: Repository<ProcessFlowInstance>,
    @InjectRepository(ProcessFlowDefinition)
    private readonly definitionRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  @OnEvent('processFlow.started')
  async handleProcessFlowStarted(payload: ProcessFlowStartedPayload): Promise<void> {
    if (payload.processFlowCode !== 'translation_request') {
      return;
    }
    const requestId = this.readRequestId(payload.input);
    if (!requestId) {
      return;
    }

    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request || this.terminalStatuses.has(request.status)) {
      return;
    }

    const previous = { status: request.status };
    request.workflowInstanceId = payload.instanceId;
    request.status = 'in_review';
    request.updatedBy = null;
    await this.requestRepo.save(request);
    await this.logStatus(request.id, previous, {
      status: request.status,
      workflowInstanceId: payload.instanceId,
    });
  }

  @OnEvent('processFlow.completed')
  async handleProcessFlowCompleted(payload: ProcessFlowCompletedPayload): Promise<void> {
    const request = await this.resolveRequest(payload.instanceId);
    if (!request || this.terminalStatuses.has(request.status)) {
      return;
    }

    const approved = this.readApproval(payload.output);
    const nextStatus = approved === false ? 'rejected' : 'approved';
    const previous = { status: request.status };
    request.status = nextStatus;
    request.updatedBy = null;
    await this.requestRepo.save(request);
    await this.logStatus(request.id, previous, { status: nextStatus });
  }

  @OnEvent('processFlow.failed')
  async handleProcessFlowFailed(payload: ProcessFlowFailedPayload): Promise<void> {
    const request = await this.resolveRequest(payload.instanceId);
    if (!request || this.terminalStatuses.has(request.status)) {
      return;
    }

    const previous = { status: request.status };
    request.status = 'failed';
    request.updatedBy = null;
    await this.requestRepo.save(request);
    await this.logStatus(request.id, previous, { status: request.status });
  }

  private async resolveRequest(instanceId: string): Promise<TranslationRequest | null> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance) {
      return null;
    }

    const definition = await this.definitionRepo.findOne({ where: { id: instance.processFlowId } });
    if (!definition || definition.code !== 'translation_request') {
      return null;
    }

    const input = (instance.context as Record<string, unknown> | undefined)?.input as Record<string, unknown> | undefined;
    const requestId = this.readRequestId(input);
    if (requestId) {
      return this.requestRepo.findOne({ where: { id: requestId } });
    }

    return this.requestRepo.findOne({ where: { workflowInstanceId: instanceId } });
  }

  private readRequestId(input?: Record<string, unknown>): string | null {
    if (!input) return null;
    const candidate = input['translationRequestId'] ?? input['translation_request_id'];
    if (typeof candidate !== 'string') {
      return null;
    }
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readApproval(output?: Record<string, unknown>): boolean | null {
    if (!output) return null;
    const approved = output['approved'];
    if (typeof approved === 'boolean') {
      return approved;
    }
    if (typeof approved === 'string') {
      const normalized = approved.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return null;
  }

  private async logStatus(
    recordId: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    const log = this.auditRepo.create({
      userId: null,
      action: 'localization.request.status',
      collectionCode: 'translation_requests',
      recordId,
      oldValues,
      newValues,
    });
    await this.auditRepo.save(log);
  }
}
