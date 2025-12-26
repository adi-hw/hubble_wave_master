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
} from '../../types/automation.types';

interface ActionResult {
  type: 'modify_record' | 'abort' | 'add_error' | 'add_warning' | 'queue_async' | 'queue_after_commit' | 'none';
  changes?: Record<string, unknown>;
  message?: string;
  property?: string;
  output?: unknown;
}

@Injectable()
export class ActionHandlerService {
  /**
   * Execute a single action
   */
  async execute(action: AutomationAction, context: ExecutionContext): Promise<ActionResult> {
    const config = action.config;
    switch (action.type) {
      case 'set_value':
        return this.handleSetValue(config as unknown as SetValueConfig, context);
      case 'set_values':
        return this.handleSetValues(config as unknown as SetValuesConfig, context);
      case 'abort':
        return this.handleAbort(config as unknown as AbortConfig);
      case 'add_error':
        return this.handleAddError(config as unknown as AddErrorConfig);
      case 'add_warning':
        return this.handleAddWarning(config as unknown as AddWarningConfig);
      case 'create_record':
        return this.handleCreateRecord(config as unknown as CreateRecordConfig);
      case 'send_notification':
        return this.handleSendNotification(config as unknown as SendNotificationConfig);
      case 'log_event':
        return this.handleLogEvent(config as unknown as LogEventConfig, context);
      case 'add_comment':
        return this.handleAddComment(config as unknown as AddCommentConfig);
      case 'call_api':
        return { type: 'queue_async' };
      case 'trigger_flow':
        return { type: 'queue_async' };
      case 'run_script':
        // Scripts handled separately in executor
        return { type: 'none' };
      default:
        return { type: 'none' };
    }
  }

  private handleSetValue(config: SetValueConfig, context: ExecutionContext): ActionResult {
    const value = this.resolveValue(config.value, context);
    
    // Check onlyIfEmpty
    if (config.onlyIfEmpty && context.record[config.property] != null) {
      return { type: 'none', output: 'Skipped - field not empty' };
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
      output: { code: config.code },
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

  private handleCreateRecord(config: CreateRecordConfig): ActionResult {
    // Queue for after commit to ensure parent record exists
    return {
      type: 'queue_after_commit',
      output: { collection: config.collection, values: config.values },
    };
  }

  private handleSendNotification(config: SendNotificationConfig): ActionResult {
    // Always async
    return {
      type: 'queue_async',
      output: { template: config.template, recipients: config.recipients },
    };
  }

  private handleLogEvent(config: LogEventConfig, context: ExecutionContext): ActionResult {
    // Log event synchronously
    const data = config.data
      ? Object.fromEntries(
          Object.entries(config.data).map(([k, v]) => [k, this.resolveValue(v, context)]),
        )
      : {};

    // TODO: Emit event
    return {
      type: 'none',
      output: { event: config.event, data },
    };
  }

  private handleAddComment(config: AddCommentConfig): ActionResult {
    // TODO: Add comment to record
    return {
      type: 'none',
      output: { content: config.content, type: config.type },
    };
  }

  private resolveValue(value: unknown, context: ExecutionContext): unknown {
    if (typeof value !== 'string') return value;

    // Record values
    if (value.startsWith('@record.')) {
      const path = value.substring(8);
      if (path.startsWith('_previous.')) {
        return context.previousRecord?.[path.substring(10)];
      }
      return context.record[path];
    }

    // Current user values
    if (value.startsWith('@currentUser.')) {
      const prop = value.substring(13);
      return (context.user as any)[prop];
    }

    // Time values
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

    // Tenant
    if (value === '@tenant.id') {
      return context.tenantId;
    }

    // Outputs from previous actions
    if (value.startsWith('@output.')) {
      const key = value.substring(8);
      return context.outputs[key];
    }

    return value;
  }
}
