import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  InstanceEventOutbox,
  Locale,
  ProcessFlowDefinition,
  TranslationKey,
  TranslationRequest,
} from '@hubblewave/instance-db';

export type CreateTranslationRequest = {
  locale_code: string;
  namespace: string;
  key: string;
  reviewer_ids?: string[];
  due_at?: string;
  notes?: string;
};

const TRANSLATION_WORKFLOW_CODE = 'translation_request';

@Injectable()
export class LocalizationRequestService {
  constructor(
    @InjectRepository(Locale)
    private readonly localeRepo: Repository<Locale>,
    @InjectRepository(TranslationKey)
    private readonly keyRepo: Repository<TranslationKey>,
    @InjectRepository(TranslationRequest)
    private readonly requestRepo: Repository<TranslationRequest>,
    @InjectRepository(ProcessFlowDefinition)
    private readonly workflowRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(InstanceEventOutbox)
    private readonly outboxRepo: Repository<InstanceEventOutbox>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async createRequest(payload: CreateTranslationRequest, actorId?: string) {
    const locale = await this.localeRepo.findOne({
      where: { code: payload.locale_code, isActive: true },
    });
    if (!locale) {
      throw new NotFoundException(`Locale ${payload.locale_code} not found`);
    }
    const key = await this.keyRepo.findOne({
      where: { namespace: payload.namespace, key: payload.key, isActive: true },
    });
    if (!key) {
      throw new NotFoundException(
        `Translation key ${payload.namespace}.${payload.key} not found`,
      );
    }

    const dueAt = payload.due_at ? new Date(payload.due_at) : undefined;
    if (payload.due_at && Number.isNaN(dueAt?.getTime())) {
      throw new BadRequestException('due_at must be a valid ISO date');
    }

    const reviewers = (payload.reviewer_ids || []).map((id) => id.trim()).filter(Boolean);

    const request = this.requestRepo.create({
      localeId: locale.id,
      translationKeyId: key.id,
      status: 'pending',
      requestedBy: actorId || null,
      reviewerIds: reviewers,
      dueAt: dueAt || null,
      metadata: {
        notes: payload.notes || null,
        namespace: key.namespace,
        key: key.key,
        locale: locale.code,
      },
      updatedBy: actorId || null,
    });
    const saved = await this.requestRepo.save(request);

    const workflow = await this.ensureWorkflowDefinition(actorId);
    await this.enqueueWorkflowStart(saved, workflow.id, key, locale, actorId);

    await this.logAudit('localization.request', actorId, saved.id, {
      locale: locale.code,
      namespace: key.namespace,
      key: key.key,
      workflowId: workflow.id,
    });

    return saved;
  }

  private async ensureWorkflowDefinition(actorId?: string): Promise<ProcessFlowDefinition> {
    const existing = await this.workflowRepo.findOne({
      where: { code: TRANSLATION_WORKFLOW_CODE },
    });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.updatedBy = actorId || null;
        return this.workflowRepo.save(existing);
      }
      return existing;
    }

    const definition = this.workflowRepo.create({
      code: TRANSLATION_WORKFLOW_CODE,
      name: 'Translation Request',
      description: 'Review and approve translation requests',
      triggerType: 'manual',
      runAs: 'system',
      isActive: true,
      timeoutMinutes: 1440,
      maxRetries: 0,
      version: 1,
      canvas: {
        nodes: [
          { id: 'start', type: 'start', position: { x: 120, y: 120 }, name: 'Start', config: {} },
          {
            id: 'review',
            type: 'approval',
            position: { x: 360, y: 120 },
            name: 'Review Translation',
            config: {
              approvers: '{{input.reviewers}}',
              approvalType: 'sequential',
              timeoutMinutes: 10080,
            },
          },
          { id: 'end', type: 'end', position: { x: 620, y: 120 }, name: 'Complete', config: {} },
        ],
        connections: [
          { id: 'start-review', fromNode: 'start', toNode: 'review' },
          { id: 'review-end', fromNode: 'review', toNode: 'end' },
        ],
      },
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });

    return this.workflowRepo.save(definition);
  }

  private async enqueueWorkflowStart(
    request: TranslationRequest,
    workflowId: string,
    key: TranslationKey,
    locale: Locale,
    actorId?: string,
  ) {
    const outbox = this.outboxRepo.create({
      eventType: 'automation.workflow.start',
      collectionCode: 'translation_requests',
      recordId: request.id,
      payload: {
        userId: actorId || null,
        recordId: request.id,
        workflow: {
          workflowId,
          inputs: {
            translationRequestId: request.id,
            locale: locale.code,
            namespace: key.namespace,
            key: key.key,
            defaultText: key.defaultText,
            reviewers: request.reviewerIds,
            dueAt: request.dueAt ? request.dueAt.toISOString() : null,
            requestedBy: actorId || null,
          },
        },
      },
    });
    await this.outboxRepo.save(outbox);
  }

  private async logAudit(
    action: string,
    actorId: string | undefined,
    recordId: string,
    payload: Record<string, unknown>,
  ) {
    const log = this.auditRepo.create({
      userId: actorId || null,
      action,
      collectionCode: 'translation_requests',
      recordId,
      newValues: payload,
    });
    await this.auditRepo.save(log);
  }
}
