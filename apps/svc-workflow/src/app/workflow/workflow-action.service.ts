import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RecordMutationService } from './record-mutation.service';
import { OutboxPublisherService } from './outbox-publisher.service';

@Injectable()
export class WorkflowActionService {
  private readonly logger = new Logger(WorkflowActionService.name);

  constructor(
    private readonly recordMutation: RecordMutationService,
    private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  @OnEvent('processFlow.action')
  async handleAction(payload: {
    instanceId: string;
    nodeId: string;
    actionType?: string;
    config?: Record<string, unknown>;
    context?: Record<string, unknown>;
    callback?: (error: Error | null, result?: unknown) => void;
  }) {
    const actionType = payload.actionType || 'noop';
    try {
      const result = await this.executeAction(actionType, payload.config || {}, payload.context || {});
      if (payload.callback) {
        payload.callback(null, result);
      }
    } catch (error) {
      if (payload.callback) {
        payload.callback(error as Error);
      }
      this.logger.error(`Workflow action failed: ${(error as Error).message}`);
    }
  }

  private async executeAction(
    actionType: string,
    config: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    switch (actionType) {
      case 'update_record':
        return this.handleUpdateRecord(config, context);
      case 'create_record':
        return this.handleCreateRecord(config, context);
      case 'send_notification':
        return this.handleSendNotification(config, context);
      case 'send_email':
        return this.handleSendNotification({
          ...config,
          channels: ['email'],
        }, context);
      default:
        return { status: 'ignored', actionType };
    }
  }

  private async handleUpdateRecord(
    config: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const collectionCode = this.readString(config, 'collectionCode') || this.readString(config, 'collection') || this.readString(context, 'collectionCode');
    const recordId = this.readString(config, 'recordId') || this.readString(context, 'recordId');

    if (!collectionCode || !recordId) {
      throw new Error('update_record requires collectionCode and recordId');
    }

    const changes = this.extractKeyValuePairs(config, 'properties');
    const values = this.extractObject(config, 'values');
    const finalChanges = { ...changes, ...values };

    if (Object.keys(finalChanges).length === 0) {
      return { status: 'no_changes' };
    }

    return this.recordMutation.updateRecord({
      collectionCode,
      recordId,
      changes: finalChanges,
      actorId: this.readString(context, 'actorId') || null,
    });
  }

  private async handleCreateRecord(
    config: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const collectionCode = this.readString(config, 'collectionCode') || this.readString(config, 'collection');
    if (!collectionCode) {
      throw new Error('create_record requires collectionCode');
    }

    const values = this.extractObject(config, 'values');
    return this.recordMutation.createRecord({
      collectionCode,
      values,
      actorId: this.readString(context, 'actorId') || null,
    });
  }

  private async handleSendNotification(
    config: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const templateCode = this.readString(config, 'templateCode');
    if (!templateCode) {
      throw new Error('send_notification requires templateCode');
    }

    const recipients = this.readRecipients(config);
    if (recipients.length === 0) {
      throw new Error('send_notification requires at least one recipient');
    }

    const data = this.parseData(config.data);
    const payload = {
      templateCode,
      recipients,
      data,
      channels: Array.isArray(config.channels) ? config.channels : undefined,
      triggeredBy: this.readString(context, 'actorId') || null,
    };

    await this.outboxPublisher.publish({
      eventType: 'workflow.notification.requested',
      payload,
    });

    return { status: 'queued', templateCode, recipients: recipients.length };
  }

  private readRecipients(config: Record<string, unknown>): string[] {
    const raw = config.recipients;
    if (Array.isArray(raw)) {
      return raw.map((entry) => String(entry)).filter(Boolean);
    }
    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  private parseData(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }
    return {};
  }

  private extractKeyValuePairs(config: Record<string, unknown>, key: string): Record<string, unknown> {
    const entries = config[key];
    if (!Array.isArray(entries)) {
      return {};
    }

    return entries.reduce<Record<string, unknown>>((acc, entry) => {
      if (!entry || typeof entry !== 'object') return acc;
      const item = entry as { key?: string; value?: unknown };
      if (item.key) {
        acc[item.key] = item.value;
      }
      return acc;
    }, {});
  }

  private extractObject(config: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = config[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }
    return {};
  }

  private readString(config: Record<string, unknown>, key: string): string {
    const value = config[key];
    if (typeof value === 'string') {
      return value.trim();
    }
    return '';
  }
}
