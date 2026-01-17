import { Injectable } from '@nestjs/common';
import {
  AutomationAction,
  ExecutionContext,
  SetValueConfig,
  SetValuesConfig,
  AbortConfig,
  AddErrorConfig,
  AddWarningConfig,
  CreateRecordConfig,
  SendNotificationConfig,
  LogEventConfig,
  AddCommentConfig,
  StartWorkflowConfig,
  ActionResult,
} from './automation-runtime.types';

@Injectable()
export class ActionHandlerService {
  async execute(action: AutomationAction, context: ExecutionContext): Promise<ActionResult> {
    const config = action.config;
    switch (action.type) {
      case 'set_value':
        this.assertStringField(config, 'property', 'set_value');
        this.assertField(config, 'value', 'set_value');
        return this.handleSetValue(config as unknown as SetValueConfig, context);
      case 'set_values':
        this.assertObjectField(config, 'values', 'set_values');
        return this.handleSetValues(config as unknown as SetValuesConfig, context);
      case 'abort':
        this.assertStringField(config, 'message', 'abort');
        return this.handleAbort(config as unknown as AbortConfig);
      case 'add_error':
        this.assertStringField(config, 'property', 'add_error');
        this.assertStringField(config, 'message', 'add_error');
        return this.handleAddError(config as unknown as AddErrorConfig);
      case 'add_warning':
        this.assertStringField(config, 'property', 'add_warning');
        this.assertStringField(config, 'message', 'add_warning');
        return this.handleAddWarning(config as unknown as AddWarningConfig);
      case 'create_record':
        this.assertStringField(config, 'collection', 'create_record');
        return this.handleCreateRecord(config as unknown as CreateRecordConfig, context);
      case 'send_notification':
        this.assertStringArrayField(config, 'recipients', 'send_notification');
        if (!config.template && !config.templateId && !config.templateCode) {
          throw new Error('Automation action send_notification requires a template reference');
        }
        return this.handleSendNotification(config as unknown as SendNotificationConfig, context);
      case 'start_workflow':
        this.assertStringField(config, 'workflowId', 'start_workflow');
        return this.handleStartWorkflow(config as unknown as StartWorkflowConfig, context);
      case 'log_event':
        return this.handleLogEvent(config as unknown as LogEventConfig, context);
      case 'add_comment':
        this.assertStringField(config, 'content', 'add_comment');
        return this.handleAddComment(config as unknown as AddCommentConfig);
      case 'run_script':
        return { type: 'none' };
      default:
        return { type: 'none' };
    }
  }

  private handleSetValue(config: SetValueConfig, context: ExecutionContext): ActionResult {
    const value = this.resolveValue(config.value, context);

    if (config.onlyIfEmpty && context.record[config.property] != null) {
      return { type: 'none', output: 'Skipped - property not empty' };
    }

    return {
      type: 'modify_record',
      changes: { [config.property]: value },
      output: { property: config.property, value },
    };
  }

  private handleSetValues(config: SetValuesConfig, context: ExecutionContext): ActionResult {
    const changes: Record<string, unknown> = {};

    for (const [property, value] of Object.entries(config.values)) {
      changes[property] = this.resolveValue(value, context);
    }

    return {
      type: 'modify_record',
      changes,
      output: changes,
    };
  }

  private handleAbort(config: AbortConfig): ActionResult {
    return {
      type: 'abort',
      message: config.message,
      output: { code: config.code, reason: config.reason },
    };
  }

  private handleAddError(config: AddErrorConfig): ActionResult {
    return {
      type: 'add_error',
      property: config.property,
      message: config.message,
    };
  }

  private handleAddWarning(config: AddWarningConfig): ActionResult {
    return {
      type: 'add_warning',
      property: config.property,
      message: config.message,
    };
  }

  private handleCreateRecord(config: CreateRecordConfig, context: ExecutionContext): ActionResult {
    const values = {
      ...(config.data || {}),
      ...(config.values || {}),
    };

    if (config.copyFromSource?.length) {
      for (const key of config.copyFromSource) {
        values[key] = context.record[key];
      }
    }

    return {
      type: 'create_record',
      output: {
        collection: config.collection,
        values,
      },
    };
  }

  private handleSendNotification(
    config: SendNotificationConfig,
    context: ExecutionContext,
  ): ActionResult {
    const dataObject = this.parseData(config.data);
    const data = dataObject
      ? Object.fromEntries(
          Object.entries(dataObject).map(([k, v]) => [k, this.resolveValue(v, context)]),
        )
      : undefined;

    return {
      type: 'send_notification',
      output: {
        templateId: config.templateId,
        template: config.templateCode || config.template,
        recipients: config.recipients,
        data,
      },
    };
  }

  private handleStartWorkflow(
    config: StartWorkflowConfig,
    context: ExecutionContext,
  ): ActionResult {
    const inputObject = this.parseData(config.inputs);
    const inputs = inputObject
      ? Object.fromEntries(
          Object.entries(inputObject).map(([k, v]) => [k, this.resolveValue(v, context)]),
        )
      : undefined;

    return {
      type: 'start_workflow',
      output: {
        workflowId: config.workflowId,
        inputs,
      },
    };
  }

  private parseData(value: unknown): Record<string, unknown> | undefined {
    if (!value) return undefined;
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private handleLogEvent(config: LogEventConfig, context: ExecutionContext): ActionResult {
    const data = config.data
      ? Object.fromEntries(
          Object.entries(config.data).map(([k, v]) => [k, this.resolveValue(v, context)]),
        )
      : {};

    return {
      type: 'none',
      output: { event: config.event || config.eventType, data },
    };
  }

  private handleAddComment(config: AddCommentConfig): ActionResult {
    return {
      type: 'none',
      output: { content: config.content, type: config.type, author: config.author },
    };
  }

  private resolveValue(value: unknown, context: ExecutionContext): unknown {
    if (typeof value !== 'string') return value;

    if (value.startsWith('@record.')) {
      const path = value.substring(8);
      if (path.startsWith('_previous.')) {
        return context.previousRecord?.[path.substring(10)];
      }
      return context.record[path];
    }

    if (value.startsWith('@currentUser.')) {
      const prop = value.substring(13);
      return (context.user as unknown as Record<string, unknown>)[prop];
    }

    if (value === '@now') {
      return new Date();
    }
    if (value === '@today') {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (value.startsWith('@now.addDays(')) {
      const match = value.match(/@now\.addDays\((-?\d+)\)/);
      if (match) {
        const days = parseInt(match[1], 10);
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
      }
    }
    if (value.startsWith('@now.addHours(')) {
      const match = value.match(/@now\.addHours\((-?\d+)\)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const date = new Date();
        date.setHours(date.getHours() + hours);
        return date;
      }
    }

    if (value.startsWith('@output.')) {
      const key = value.substring(8);
      return context.outputs[key];
    }

    return value;
  }

  private assertField(
    config: Record<string, unknown>,
    field: string,
    action: string
  ): void {
    if (config[field] === undefined) {
      throw new Error(`Automation action ${action} requires ${field}`);
    }
  }

  private assertStringField(
    config: Record<string, unknown>,
    field: string,
    action: string
  ): void {
    const value = config[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Automation action ${action} requires ${field}`);
    }
  }

  private assertStringArrayField(
    config: Record<string, unknown>,
    field: string,
    action: string
  ): void {
    const value = config[field];
    if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === 'string')) {
      throw new Error(`Automation action ${action} requires ${field}`);
    }
  }

  private assertObjectField(
    config: Record<string, unknown>,
    field: string,
    action: string
  ): void {
    const value = config[field];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Automation action ${action} requires ${field}`);
    }
  }
}
