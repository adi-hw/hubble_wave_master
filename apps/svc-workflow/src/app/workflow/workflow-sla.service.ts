import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ProcessFlowQueueService } from '@hubblewave/automation';
import { RecordMutationService } from './record-mutation.service';

type SlaCheckPayload = {
  instanceId?: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class WorkflowSlaService {
  private readonly completionStatuses = new Set([
    'completed',
    'closed',
    'resolved',
    'done',
    'cancelled',
  ]);

  constructor(
    private readonly recordMutation: RecordMutationService,
    private readonly queue: ProcessFlowQueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('processFlow.started')
  async handleProcessFlowStarted(payload: { instanceId: string; input?: Record<string, unknown> }) {
    const workItemId = this.resolveWorkItemId(payload.input);
    if (!workItemId) {
      return;
    }
    const record = await this.recordMutation.getRecordById('work_items', workItemId);
    if (!record) {
      return;
    }
    const dueAt = this.ensureDueAt(record);
    if (!dueAt) {
      return;
    }
    if (this.isTerminalSla(record)) {
      return;
    }
    this.scheduleCheck(payload.instanceId, workItemId, dueAt);
  }

  @OnEvent('processFlow.queue.sla_check')
  async handleSlaCheck(payload: SlaCheckPayload) {
    const workItemId = this.resolveWorkItemId(payload.data);
    if (!workItemId) {
      return;
    }

    const record = await this.recordMutation.getRecordById('work_items', workItemId);
    if (!record) {
      return;
    }

    if (this.isTerminalSla(record)) {
      return;
    }

    const dueAt = this.readDate(record['due_at']);
    if (!dueAt) {
      return;
    }

    const now = new Date();
    if (dueAt.getTime() > now.getTime()) {
      this.scheduleCheck(payload.instanceId || null, workItemId, dueAt);
      return;
    }

    const statusValue = String(record['status'] || '').toLowerCase();
    if (this.completionStatuses.has(statusValue)) {
      await this.markSlaMet(workItemId);
      return;
    }

    await this.markSlaBreached(workItemId, dueAt);
  }

  private resolveWorkItemId(input?: Record<string, unknown>): string | null {
    if (!input) return null;
    const candidates = [
      input['workItemId'],
      input['work_item_id'],
      input['recordId'],
    ];
    const match = candidates.find((value) => typeof value === 'string' && value.length > 0);
    return match ? String(match) : null;
  }

  private ensureDueAt(record: Record<string, unknown>): Date | null {
    const existing = this.readDate(record['due_at']);
    if (existing) {
      return existing;
    }

    const slaMinutesRaw = record['sla_target_minutes'];
    const slaMinutes = typeof slaMinutesRaw === 'number' ? slaMinutesRaw : Number(slaMinutesRaw);
    if (!Number.isFinite(slaMinutes) || slaMinutes <= 0) {
      return null;
    }

    const submittedAt = this.readDate(record['submitted_at']) || new Date();
    const dueAt = new Date(submittedAt.getTime() + slaMinutes * 60 * 1000);

    void this.recordMutation.updateRecord({
      collectionCode: 'work_items',
      recordId: String(record['id']),
      changes: {
        due_at: dueAt,
        sla_status: record['sla_status'] || 'active',
      },
      actorId: null,
    });

    return dueAt;
  }

  private scheduleCheck(instanceId: string | null, workItemId: string, dueAt: Date) {
    const delayMs = Math.max(0, dueAt.getTime() - Date.now());
    if (this.queue.isQueueEnabled() && instanceId) {
      void this.queue.scheduleSlaCheck(instanceId, delayMs, { workItemId });
      return;
    }

    setTimeout(() => {
      void this.handleSlaCheck({ data: { workItemId } });
    }, delayMs);
  }

  private async markSlaBreached(workItemId: string, dueAt: Date) {
    await this.recordMutation.updateRecord({
      collectionCode: 'work_items',
      recordId: workItemId,
      changes: {
        sla_status: 'breached',
        sla_breached_at: new Date(),
      },
      actorId: null,
    });

    await this.recordMutation.createRecord({
      collectionCode: 'work_timeline',
      values: {
        work_item_id: workItemId,
        event_type: 'sla_breached',
        message: `SLA breached at ${dueAt.toISOString()}`,
        data: { dueAt: dueAt.toISOString() },
      },
      actorId: null,
    });

    this.eventEmitter.emit('sla.breached', {
      workItemId,
      dueAt: dueAt.toISOString(),
    });
  }

  private async markSlaMet(workItemId: string) {
    await this.recordMutation.updateRecord({
      collectionCode: 'work_items',
      recordId: workItemId,
      changes: {
        sla_status: 'met',
        sla_met_at: new Date(),
      },
      actorId: null,
    });
  }

  private isTerminalSla(record: Record<string, unknown>): boolean {
    const status = String(record['sla_status'] || '').toLowerCase();
    return status === 'breached' || status === 'met';
  }

  private readDate(value: unknown): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
