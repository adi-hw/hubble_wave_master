import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, InstanceEventOutbox, AlertDefinition, MetricDefinition, MetricPoint, ProcessFlowDefinition } from '@hubblewave/instance-db';
import { AlertActionConfig, AlertConditionConfig, AlertNotificationAction, AlertWorkflowAction } from './alerts.types';

type AlertRuntimeState = {
  last_triggered_at?: string;
  last_triggered_period_end?: string;
  last_triggered_value?: number;
};

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(AlertDefinition)
    private readonly alertRepo: Repository<AlertDefinition>,
    @InjectRepository(MetricDefinition)
    private readonly metricRepo: Repository<MetricDefinition>,
    @InjectRepository(MetricPoint)
    private readonly pointRepo: Repository<MetricPoint>,
    @InjectRepository(ProcessFlowDefinition)
    private readonly workflowRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(InstanceEventOutbox)
    private readonly outboxRepo: Repository<InstanceEventOutbox>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  @Cron('*/5 * * * *')
  async evaluateAlerts(): Promise<void> {
    const alerts = await this.alertRepo.find({ where: { isActive: true } });
    for (const alert of alerts) {
      try {
        await this.evaluateAlert(alert);
      } catch (error) {
        this.logger.error(
          `Alert evaluation failed for ${alert.code}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
  }

  private async evaluateAlert(alert: AlertDefinition): Promise<void> {
    const condition = (alert.conditions || {}) as AlertConditionConfig;
    const actions = (alert.actions || {}) as AlertActionConfig;
    const metricCode = condition.metric_code || condition.metricCode;
    if (!metricCode) {
      return;
    }

    const metric = await this.metricRepo.findOne({ where: { code: metricCode, isActive: true } });
    if (!metric) {
      return;
    }

    const latest = await this.pointRepo.findOne({
      where: { metricCode },
      order: { periodEnd: 'DESC' },
    });
    if (!latest) {
      return;
    }

    const runtime = this.readRuntime(alert.metadata);
    const cooldownMinutes = condition.cooldown_minutes ?? condition.cooldownMinutes ?? 0;
    if (this.isOnCooldown(runtime, latest.periodEnd, cooldownMinutes)) {
      return;
    }

    const value = Number(latest.value);
    if (!Number.isFinite(value)) {
      return;
    }

    const shouldTrigger = this.evaluateCondition(
      value,
      condition.operator,
      condition.threshold,
    );
    if (!shouldTrigger) {
      return;
    }

    const workflowAction = actions.workflow;
    if (workflowAction) {
      await this.queueWorkflow(alert, workflowAction);
    }

    const notifyAction = actions.notify;
    if (notifyAction) {
      await this.queueNotification(alert, notifyAction);
    }

    await this.writeAudit(alert, value);
    await this.updateRuntime(alert, latest);
  }

  private evaluateCondition(
    value: number,
    operator: AlertConditionConfig['operator'],
    threshold?: number,
  ): boolean {
    if (threshold === undefined || threshold === null) {
      return false;
    }
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      case 'neq':
        return value !== threshold;
      default:
        return false;
    }
  }

  private isOnCooldown(runtime: AlertRuntimeState, periodEnd: Date, cooldownMinutes: number): boolean {
    if (!runtime.last_triggered_period_end && !runtime.last_triggered_at) {
      return false;
    }
    if (runtime.last_triggered_period_end === periodEnd.toISOString()) {
      return true;
    }
    if (!cooldownMinutes || !runtime.last_triggered_at) {
      return false;
    }
    const lastTriggered = new Date(runtime.last_triggered_at);
    if (Number.isNaN(lastTriggered.getTime())) {
      return false;
    }
    const cutoff = Date.now() - cooldownMinutes * 60 * 1000;
    return lastTriggered.getTime() >= cutoff;
  }

  private async queueWorkflow(alert: AlertDefinition, action: AlertWorkflowAction): Promise<void> {
    const workflowId = action.workflow_id || action.workflowId || (await this.resolveWorkflowId(action));
    if (!workflowId) {
      return;
    }

    const payload = {
      workflow: {
        workflowId,
        inputs: action.inputs || {},
      },
      triggeredBy: 'system',
      userId: action.run_as || action.runAs || undefined,
      alertCode: alert.code,
    };

    await this.outboxRepo.save(
      this.outboxRepo.create({
        eventType: 'automation.workflow.start',
        payload,
        status: 'pending',
      }),
    );
  }

  private async resolveWorkflowId(action: AlertWorkflowAction): Promise<string | undefined> {
    const workflowCode = action.workflow_code || action.workflowCode;
    if (!workflowCode) {
      return undefined;
    }
    const definition = await this.workflowRepo.findOne({ where: { code: workflowCode, isActive: true } });
    return definition?.id;
  }

  private async queueNotification(alert: AlertDefinition, action: AlertNotificationAction): Promise<void> {
    const recipients = Array.isArray(action.recipients) ? action.recipients.map(String) : [];
    const templateCode = action.template_code || action.templateCode;
    const templateId = action.template_id || action.templateId;
    if (!recipients.length || (!templateCode && !templateId)) {
      return;
    }

    const notification = {
      templateCode,
      templateId,
      recipients,
      channels: Array.isArray(action.channels) ? action.channels : undefined,
      data: action.data || {},
    };

    await this.outboxRepo.save(
      this.outboxRepo.create({
        eventType: 'automation.notification.requested',
        payload: { notification, triggeredBy: 'system', alertCode: alert.code },
        status: 'pending',
      }),
    );
  }

  private async writeAudit(alert: AlertDefinition, value: number): Promise<void> {
    const entry = this.auditRepo.create({
      userId: null,
      collectionCode: 'alert_definition',
      recordId: alert.id,
      action: 'alert.trigger',
      newValues: {
        alertCode: alert.code,
        value,
      },
    });
    await this.auditRepo.save(entry);
  }

  private async updateRuntime(alert: AlertDefinition, point: MetricPoint): Promise<void> {
    const runtime: AlertRuntimeState = {
      last_triggered_at: new Date().toISOString(),
      last_triggered_period_end: point.periodEnd.toISOString(),
      last_triggered_value: Number(point.value),
    };
    alert.metadata = this.mergeRuntime(alert.metadata, runtime);
    await this.alertRepo.save(alert);
  }

  private readRuntime(metadata?: Record<string, unknown> | null): AlertRuntimeState {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }
    const runtime = (metadata as Record<string, unknown>).runtime;
    if (!runtime || typeof runtime !== 'object') {
      return {};
    }
    return runtime as AlertRuntimeState;
  }

  private mergeRuntime(
    metadata: Record<string, unknown> | null | undefined,
    runtime: AlertRuntimeState,
  ): Record<string, unknown> {
    const existing = metadata && typeof metadata === 'object' ? metadata : {};
    const currentRuntime = this.readRuntime(existing);
    return {
      ...existing,
      runtime: {
        ...currentRuntime,
        ...runtime,
      },
    };
  }
}
