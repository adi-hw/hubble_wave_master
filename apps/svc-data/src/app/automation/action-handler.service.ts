import { Injectable } from '@nestjs/common';
import { AUTOMATION_CODE_ALIASES } from '@hubblewave/shared-types';
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

/**
 * Translate canonical PascalCase BUILT_IN_AUTOMATION_ACTIONS codes
 * to the snake_case dispatch keys the handler's switch table uses.
 * Mirrors the reverse map in svc-automation's action handler so
 * canvas-authored rules execute identically in both runtime paths
 * (sync before/after via CollectionDataService AND outbox-driven
 * after via svc-automation).
 */
const CANONICAL_TO_DISPATCH_KEY: Record<string, string> = {
  SetField: 'set_value',
  CreateRecord: 'create_record',
  FireEvent: 'log_event',
  CallFlow: 'trigger_flow',
  Abort: 'abort',
  SendNotification: 'send_notification',
  AddError: 'add_error',
  AddWarning: 'add_warning',
  AddComment: 'add_comment',
};

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
    // Resolve to dispatch key in two steps so a rule authored with
    // `set_value` (alias) OR `SetField` (canonical) hits the same
    // handler branch.
    const aliasResolved = AUTOMATION_CODE_ALIASES[action.type] ?? action.type;
    const dispatchKey = CANONICAL_TO_DISPATCH_KEY[aliasResolved] ?? action.type;
    switch (dispatchKey) {
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
        return this.handleCreateRecord(config as unknown as CreateRecordConfig, context);
      case 'send_notification':
        return this.handleSendNotification(config as unknown as SendNotificationConfig, context);
      case 'log_event':
        return this.handleLogEvent(config as unknown as LogEventConfig, context);
      case 'add_comment':
        return this.handleAddComment(config as unknown as AddCommentConfig);
      case 'call_api':
        return { type: 'queue_async' };
      case 'trigger_flow':
        return this.handleTriggerFlow(config, context);
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

  private handleCreateRecord(
    config: CreateRecordConfig,
    context: ExecutionContext,
  ): ActionResult {
    // Queue for after commit to ensure parent record exists. Accept
    // either canonical `collectionCode` or the older alias `collection`
    // — canvas-authored rules write the canonical name, older rows
    // carry the alias. Values resolve through `resolveValue`
    // so `@record.id` / `@currentUser.id` / `@output.x` bindings are
    // evaluated AT QUEUE TIME — drainQueuedActions reads from the
    // resolved output, not the raw config.
    const collection =
      (config as unknown as { collectionCode?: string }).collectionCode ??
      config.collection;
    const values = this.resolveRecord(config.values, context);
    return {
      type: 'queue_after_commit',
      output: { collection, values },
    };
  }

  private handleSendNotification(
    config: SendNotificationConfig,
    context: ExecutionContext,
  ): ActionResult {
    const data = this.resolveRecord(
      (config as unknown as { data?: Record<string, unknown> }).data,
      context,
    );
    const cfg = config as unknown as {
      template?: string;
      templateCode?: string;
      templateId?: string;
      recipients?: string[];
      recipientUserId?: string;
      channels?: string[];
    };
    return {
      type: 'queue_async',
      output: {
        templateCode: cfg.templateCode ?? cfg.template,
        templateId: cfg.templateId,
        recipients: cfg.recipients ?? (cfg.recipientUserId ? [cfg.recipientUserId] : []),
        channels: cfg.channels,
        data,
      },
    };
  }

  /**
   * CallFlow / trigger_flow — queue a sub-flow start with resolved
   * inputs. Without this, drainQueuedActions falls back to the raw
   * config and `@record.id` / `@output.x` bindings reach the Process
   * Flow as literal placeholder strings.
   */
  private handleTriggerFlow(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): ActionResult {
    const flowCode =
      (config.flowCode as string | undefined) ??
      (config.workflowId as string | undefined);
    const inputs = this.resolveRecord(config.inputs, context);
    return {
      type: 'queue_async',
      output: { workflowId: flowCode, inputs },
    };
  }

  private resolveRecord(
    input: unknown,
    context: ExecutionContext,
  ): Record<string, unknown> {
    // Editors may persist JSON-shaped fields as raw strings (the UI
    // commits an object once the user finishes typing valid JSON, but
    // intermediate states and previously-stored data remain text). Try-parse on
    // string inputs before declaring "no object", so a config like
    // `inputs: '{"x": 1}'` doesn't silently collapse to {}.
    let parsed: unknown = input;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return {};
      }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      out[k] = this.resolveValue(v, context);
    }
    return out;
  }

  private handleLogEvent(config: LogEventConfig, context: ExecutionContext): ActionResult {
    const data = config.data
      ? Object.fromEntries(
          Object.entries(config.data).map(([k, v]) => [k, this.resolveValue(v, context)]),
        )
      : {};

    // FireEvent / log_event must publish onto the platform event bus
    // when the rule fires. Returning `none` here previously meant the
    // asyncQueue never picked it up and CollectionDataService had no
    // signal to forward — so a published rule using FireEvent ran
    // silently with no downstream emission. `queue_async` flags it
    // for the data-service drain step which translates the output
    // into an `automation.event.${name}` outbox publish.
    return {
      type: 'queue_async',
      output: { event: config.event ?? config.eventType, data },
    };
  }

  private handleAddComment(config: AddCommentConfig): ActionResult {
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
    // Plan §8.1.4 — DataPillPicker emits `@instanceCode` for the
    // automation runtime (the runtime has no `@system.` namespace).
    // Resolves to the platform's `INSTANCE_CODE` env so authors can
    // route automation logic on which instance fired the rule.
    if (value === '@instanceCode') {
      return process.env.INSTANCE_CODE ?? 'default';
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

    // Outputs from previous actions
    if (value.startsWith('@output.')) {
      const key = value.substring(8);
      return context.outputs[key];
    }

    return value;
  }
}
