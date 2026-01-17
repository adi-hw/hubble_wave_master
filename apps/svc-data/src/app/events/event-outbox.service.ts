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
}
