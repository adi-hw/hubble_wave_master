import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InstanceEventOutbox } from '@hubblewave/instance-db';

export type RecordEventPayload = {
  eventType: string;
  collectionCode: string;
  recordId: string;
  record: Record<string, unknown>;
  previousRecord?: Record<string, unknown> | null;
  changedProperties?: string[];
  userId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};

@Injectable()
export class EventOutboxService {
  constructor(private readonly dataSource: DataSource) {}

  async enqueueRecordEvent(payload: Omit<RecordEventPayload, 'occurredAt'>): Promise<void> {
    const repo = this.dataSource.getRepository(InstanceEventOutbox);
    const occurredAt = new Date().toISOString();
    const entry = repo.create({
      eventType: payload.eventType,
      collectionCode: payload.collectionCode,
      recordId: payload.recordId,
      payload: {
        ...payload,
        occurredAt,
      },
      status: 'pending',
      attempts: 0,
    });
    const searchEntry = repo.create({
      eventType: 'search.index',
      collectionCode: payload.collectionCode,
      recordId: payload.recordId,
      payload: {
        ...payload,
        occurredAt,
      },
      status: 'pending',
      attempts: 0,
    });
    await repo.save([entry, searchEntry]);
  }

  async enqueueWorkflowStart(payload: {
    workflowId: string;
    collectionCode?: string;
    recordId?: string;
    inputs?: Record<string, unknown>;
    userId?: string | null;
  }): Promise<void> {
    const repo = this.dataSource.getRepository(InstanceEventOutbox);
    const entry = repo.create({
      eventType: 'automation.workflow.start',
      collectionCode: payload.collectionCode ?? null,
      recordId: payload.recordId ?? null,
      payload: {
        workflow: {
          workflowId: payload.workflowId,
          inputs: payload.inputs || {},
        },
        collectionCode: payload.collectionCode,
        recordId: payload.recordId,
        userId: payload.userId ?? null,
        occurredAt: new Date().toISOString(),
      },
      status: 'pending',
      attempts: 0,
    });
    await repo.save(entry);
  }

  /**
   * Notification-outbox contract per `NotificationOutboxProcessor`:
   * payload keys are `templateCode` / `templateId`, `recipients`,
   * `data`, plus optional `channels` / `triggeredBy` / `correlationId`
   * at the root. Wrapping under `payload.record` (as enqueueRecordEvent
   * does) would fail the consumer's payload validation.
   */
  async enqueueNotificationRequest(payload: {
    templateCode?: string;
    templateId?: string;
    recipients: string[];
    channels?: string[];
    data?: Record<string, unknown>;
    collectionCode?: string;
    recordId?: string;
    userId?: string | null;
  }): Promise<void> {
    const repo = this.dataSource.getRepository(InstanceEventOutbox);
    const entry = repo.create({
      eventType: 'automation.notification.requested',
      collectionCode: payload.collectionCode ?? null,
      recordId: payload.recordId ?? null,
      payload: {
        templateCode: payload.templateCode,
        templateId: payload.templateId,
        recipients: payload.recipients,
        channels: payload.channels,
        data: payload.data ?? {},
        triggeredBy: payload.userId ?? null,
        occurredAt: new Date().toISOString(),
      },
      status: 'pending',
      attempts: 0,
    });
    await repo.save(entry);
  }

  /**
   * Free-form automation event published by FireEvent. Distinct from
   * `enqueueRecordEvent` because no record write occurred — there is
   * no companion `search.index` event and no record-shaped `record`
   * field. Consumer is whoever subscribes to `automation.event.${name}`.
   */
  async enqueueAutomationEvent(payload: {
    event: string;
    data?: Record<string, unknown>;
    collectionCode?: string;
    recordId?: string;
    userId?: string | null;
  }): Promise<void> {
    const repo = this.dataSource.getRepository(InstanceEventOutbox);
    const entry = repo.create({
      eventType: `automation.event.${payload.event}`,
      collectionCode: payload.collectionCode ?? null,
      recordId: payload.recordId ?? null,
      payload: {
        event: payload.event,
        data: payload.data ?? {},
        collectionCode: payload.collectionCode,
        recordId: payload.recordId,
        userId: payload.userId ?? null,
        occurredAt: new Date().toISOString(),
      },
      status: 'pending',
      attempts: 0,
    });
    await repo.save(entry);
  }
}
