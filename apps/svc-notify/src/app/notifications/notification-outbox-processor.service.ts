import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InstanceEventOutbox } from '@hubblewave/instance-db';
import { NotificationService } from './notification.service';

const EVENT_TYPES = ['automation.notification.requested', 'workflow.notification.requested'];

@Injectable()
export class NotificationOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxProcessor.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly lockTimeoutMs: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationService,
  ) {
    this.batchSize = parseInt(this.configService.get('NOTIFY_OUTBOX_BATCH_SIZE', '20'), 10);
    this.pollIntervalMs = parseInt(this.configService.get('NOTIFY_OUTBOX_POLL_MS', '2000'), 10);
    this.lockTimeoutMs = parseInt(this.configService.get('NOTIFY_OUTBOX_LOCK_TIMEOUT_MS', '60000'), 10);
  }

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const entries = await this.claimPending();
      if (!entries.length) return;

      for (const entry of entries) {
        try {
          await this.handleEntry(entry.payload as Record<string, unknown>);
          await this.markProcessed(entry.id);
        } catch (error) {
          await this.markFailed(entry.id, (error as Error).message);
        }
      }
    } catch (error) {
      this.logger.error(`Notify outbox poll failed: ${(error as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async handleEntry(payload: Record<string, unknown>) {
    const notificationPayload = (payload.notification as Record<string, unknown>) || payload;
    const templateCode = notificationPayload.templateCode as string | undefined;
    const templateId = notificationPayload.templateId as string | undefined;
    const template = notificationPayload.template as string | undefined;
    const recipients = Array.isArray(notificationPayload.recipients)
      ? notificationPayload.recipients.map(String)
      : [];
    const channels = Array.isArray(notificationPayload.channels)
      ? (notificationPayload.channels as string[])
      : undefined;
    const data = (notificationPayload.data as Record<string, unknown>) || {};

    if ((!templateCode && !templateId && !template) || recipients.length === 0) {
      throw new Error('Notification payload requires template reference and recipients');
    }

    await this.notifications.send({
      templateCode: templateCode || template,
      templateId,
      recipients,
      data,
      channels: channels as any,
      actorId: payload.triggeredBy as string | undefined,
    });
  }

  private async claimPending(): Promise<InstanceEventOutbox[]> {
    const lockCutoff = new Date(Date.now() - this.lockTimeoutMs).toISOString();
    const query = `
      UPDATE instance_event_outbox
      SET status = 'processing', locked_at = NOW(), attempts = attempts + 1
      WHERE id IN (
        SELECT id
        FROM instance_event_outbox
        WHERE status = 'pending'
          AND (locked_at IS NULL OR locked_at < $1)
          AND event_type = ANY($2)
        ORDER BY created_at ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    const rows = (await this.dataSource.query(query, [lockCutoff, EVENT_TYPES, this.batchSize])) as Array<{
      id: string;
      event_type: string;
      collection_code: string | null;
      record_id: string | null;
      payload: Record<string, unknown>;
      status: string;
      attempts: number;
      locked_at: Date | null;
      processed_at: Date | null;
      error_message: string | null;
      created_at: Date;
    }>;

    return (rows || []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      collectionCode: row.collection_code,
      recordId: row.record_id,
      payload: row.payload,
      status: row.status as InstanceEventOutbox['status'],
      attempts: row.attempts,
      lockedAt: row.locked_at,
      processedAt: row.processed_at,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
  }

  private async markProcessed(id: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(InstanceEventOutbox)
      .set({
        status: 'processed',
        processedAt: new Date(),
        lockedAt: null,
        errorMessage: null,
      })
      .where('id = :id', { id })
      .execute();
  }

  private async markFailed(id: string, message: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(InstanceEventOutbox)
      .set({
        status: 'failed',
        processedAt: new Date(),
        lockedAt: null,
        errorMessage: message,
      })
      .where('id = :id', { id })
      .execute();
  }
}
