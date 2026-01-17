import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InstanceEventOutbox } from '@hubblewave/instance-db';

export type OutboxEventPayload = {
  eventType: string;
  collectionCode?: string | null;
  recordId?: string | null;
  payload: Record<string, unknown>;
};

@Injectable()
export class OutboxPublisherService {
  constructor(private readonly dataSource: DataSource) {}

  async publish(event: OutboxEventPayload): Promise<void> {
    const repo = this.dataSource.getRepository(InstanceEventOutbox);
    const entry = repo.create({
      eventType: event.eventType,
      collectionCode: event.collectionCode ?? null,
      recordId: event.recordId ?? null,
      payload: {
        ...event.payload,
        occurredAt: new Date().toISOString(),
      },
      status: 'pending',
      attempts: 0,
    });
    await repo.save(entry);
  }
}
