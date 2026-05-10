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
  StartWorkflowConfig,
  ActionResult,
} from './automation-runtime.types';

@Injectable()
export class ActionHandlerService {
  async execute(action: AutomationAction, context: ExecutionContext): Promise<ActionResult> {
    const config = action.config;
    // Translate canonical PascalCase codes from BUILT_IN_AUTOMATION_ACTIONS
    // (SetField, CreateRecord, FireEvent, CallFlow, Abort) onto the
    // snake_case branches the handler's switch table dispatches on.
    // Without this translation, a canvas authored with the canonical
    // catalog falls through to the default `none` and the rule
    // appears successful while doing nothing.
    const canonical = AUTOMATION_CODE_ALIASES[action.type] ?? action.type;
    const dispatchKey = this.canonicalToDispatchKey(canonical) ?? action.type;
    switch (dispatchKey) {
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
        // Canonical CreateRecord uses `collectionCode`; the older
        // alias `collection` is also accepted at the dispatcher
        // boundary so both shapes execute correctly.
        this.assertStringFieldAny(config, ['collectionCode', 'collection'], 'create_record');
        return this.handleCreateRecord(config as unknown as CreateRecordConfig, context);
      case 'send_notification':
        this.assertStringArrayField(config, 'recipients', 'send_notification');
        if (!config.template && !config.templateId && !config.templateCode) {
          throw new Error('Automation action send_notification requires a template reference');
        }
        return this.handleSendNotification(config as unknown as SendNotificationConfig, context);
      case 'start_workflow':
        // Catalog CallFlow uses `flowCode`; the older alias
        // `workflowId` is also accepted at the dispatcher boundary so
        // canvas-authored CallFlow rules and existing start_workflow
        // rows both execute correctly.
        this.assertStringFieldAny(config, ['flowCode', 'workflowId'], 'start_workflow');
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

  /**
   * Map a canonical PascalCase catalog code to the snake_case branch
   * the handler's switch table dispatches on. Returning the dispatch
   * key keeps the switch table single-shaped while letting catalog
   * authors write the canonical names.
   */
  private canonicalToDispatchKey(code: string): string | undefined {
    const reverseMap: Record<string, string> = {
      SetField: 'set_value',
      CreateRecord: 'create_record',
      FireEvent: 'log_event',
      CallFlow: 'start_workflow',
      Abort: 'abort',
      // svc-automation also handles these, accept their PascalCase too.
      SendNotification: 'send_notification',
      AddError: 'add_error',
      AddWarning: 'add_warning',
      AddComment: 'add_comment',
    };
    return reverseMap[code];
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

    // Catalog uses `collectionCode`; the older alias `collection`
    // remains accepted so already-saved rules keep executing. Prefer
    // the canonical name and fall back to the alias.
    const collection =
      (config as unknown as { collectionCode?: string }).collectionCode ??
      config.collection;

    return {
      type: 'create_record',
      output: {
        collection,
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

    const workflowId =
      (config as unknown as { flowCode?: string }).flowCode ?? config.workflowId;

    return {
      type: 'start_workflow',
      output: {
        workflowId,
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

    // Phase 4 §9.1 FireEvent (also keyed under `log_event`) publishes to the
    // platform event bus. Returning `type: 'none'` previously meant
    // the runtime ignored the result, so the rule appeared to run
    // while producing no downstream event. The runtime catches
    // `fire_event` results and forwards them via OutboxPublisherService.
    return {
      type: 'fire_event',
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
    if (value === '@instanceCode') {
      // Plan §8.1.4 — pairs with the data-pill picker's `@instanceCode`
      // automation token. Resolves to the platform `INSTANCE_CODE` env.
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

  private assertStringFieldAny(
    config: Record<string, unknown>,
    fields: ReadonlyArray<string>,
    action: string
  ): void {
    for (const field of fields) {
      const value = config[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        return;
      }
    }
    throw new Error(
      `Automation action ${action} requires one of: ${fields.join(', ')}`,
    );
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
