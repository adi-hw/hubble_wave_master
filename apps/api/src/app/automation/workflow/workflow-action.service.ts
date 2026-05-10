import {
  BadRequestException,
  Injectable,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import {
  Approval,
  Connector,
  DecisionTable,
} from '@hubblewave/instance-db';
import {
  BUILT_IN_ACTIONS,
  evaluateDecisionTable,
  findActionByCode,
  validateActionPayload,
  type ActionDefinition,
  type DecisionTableDto,
} from '@hubblewave/shared-types';
import { RecordMutationService } from './record-mutation.service';
import { OutboxPublisherService } from './outbox-publisher.service';

/**
 * Normalizes the snake_case action codes accepted from the canvas
 * editor to the canonical PascalCase codes from BUILT_IN_ACTIONS, so
 * canvas-time and engine-time validation share the same catalog spec.
 *
 * Note on `send_email`: there is no separate Email action — the
 * platform's notification system models email as a channel of
 * `SendNotification` (see `BUILT_IN_ACTIONS.SendNotification`). The
 * `send_email` alias is therefore correct, not a semantic collapse.
 * If a dedicated SendEmail action is added later, remove this entry
 * and add a SendEmail handler to the catalog.
 */
const CANVAS_CODE_NORMALIZER: Record<string, string> = {
  create_record: 'CreateRecord',
  update_record: 'UpdateRecord',
  delete_record: 'DeleteRecord',
  lookup_record: 'LookUpRecord',
  send_notification: 'SendNotification',
  send_email: 'SendNotification',
  set_field_value: 'SetFieldValue',
  http_request: 'HTTPRequest',
  make_decision: 'MakeDecision',
};

@Injectable()
export class WorkflowActionService {
  private readonly logger = new Logger(WorkflowActionService.name);

  constructor(
    private readonly recordMutation: RecordMutationService,
    private readonly outboxPublisher: OutboxPublisherService,
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
    @InjectRepository(Connector)
    private readonly connectorRepo: Repository<Connector>,
    @InjectRepository(DecisionTable)
    private readonly decisionTableRepo: Repository<DecisionTable>,
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
      const result = await this.executeAction(
        actionType,
        payload.config || {},
        { ...(payload.context || {}), instanceId: payload.instanceId, nodeId: payload.nodeId },
      );
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
    const canonicalCode = CANVAS_CODE_NORMALIZER[actionType] ?? actionType;
    const definition = findActionByCode(canonicalCode);
    if (!definition) {
      throw new BadRequestException(
        `Unknown action type '${actionType}'. Supported codes: ${BUILT_IN_ACTIONS.map((a) => a.code).join(', ')}.`,
      );
    }

    const inputs = this.buildInputPayload(definition, config, context);
    const validationError = validateActionPayload(definition.inputs, inputs);
    if (validationError) {
      throw new BadRequestException(
        `Action '${canonicalCode}' input validation failed: ${validationError}`,
      );
    }

    switch (canonicalCode) {
      case 'CreateRecord':
        return this.handleCreateRecord(inputs, context);
      case 'UpdateRecord':
        return this.handleUpdateRecord(inputs, context);
      case 'DeleteRecord':
        return this.handleDeleteRecord(inputs, context);
      case 'LookUpRecord':
        return this.handleLookUpRecord(inputs);
      case 'SetFieldValue':
        return this.handleSetFieldValue(inputs, context);
      case 'SendNotification':
        return this.handleSendNotification(inputs, context);
      case 'HTTPRequest':
        return this.handleHttpRequest(inputs);
      case 'CreateApproval':
        return this.handleCreateApproval(inputs, context);
      case 'WaitForApproval':
        return this.handleWaitForApproval(inputs);
      case 'MakeDecision':
        return this.handleMakeDecision(inputs);
      case 'CallFlowModule':
        throw new NotImplementedException(
          'CallFlowModule requires the sub-flow execution backbone (deferred). Use a sibling flow with a shared trigger code as a workaround until Phase 4.',
        );
      case 'RunAVAPrompt':
        throw new NotImplementedException(
          'RunAVAPrompt requires the AVA prompt-execution channel (deferred — ships with Phase 5 AVA build-agent integration).',
        );
      default:
        throw new BadRequestException(
          `Action '${canonicalCode}' is registered in the catalog but no handler is wired.`,
        );
    }
  }

  /**
   * Builds the contract-shaped input payload from the canvas config
   * and runtime context. The canvas writes parameter bindings into
   * `config`; runtime-supplied bindings (collectionCode, recordId,
   * actorId, instanceId, nodeId) fall back to `context` when the
   * canvas didn't bind them explicitly. This keeps the action body
   * focused on its semantics, not on hunting through two object
   * shapes.
   */
  private buildInputPayload(
    definition: ActionDefinition,
    config: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const spec of definition.inputs) {
      const candidate = config[spec.name];
      if (candidate !== undefined && candidate !== null && candidate !== '') {
        merged[spec.name] = this.coerce(spec.type, candidate);
        continue;
      }
      const fallback = context[spec.name];
      if (fallback !== undefined && fallback !== null && fallback !== '') {
        merged[spec.name] = this.coerce(spec.type, fallback);
      }
    }
    return merged;
  }

  private coerce(type: string, value: unknown): unknown {
    if (type === 'integer' && typeof value === 'string') {
      const n = Number(value);
      return Number.isInteger(n) ? n : value;
    }
    if (type === 'boolean' && typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    if (type === 'json' && typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  // ─────────────────────────────────────────────────────────────────
  // Record actions
  // ─────────────────────────────────────────────────────────────────

  private async handleCreateRecord(
    inputs: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const record = await this.recordMutation.createRecord({
      collectionCode: inputs.collectionCode as string,
      values: this.asObject(inputs.values),
      actorId: this.readActor(context),
    });
    return { recordId: record?.id };
  }

  private async handleUpdateRecord(
    inputs: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const updated = await this.recordMutation.updateRecord({
      collectionCode: inputs.collectionCode as string,
      recordId: inputs.recordId as string,
      changes: this.asObject(inputs.values),
      actorId: this.readActor(context),
    });
    return { recordId: updated?.id };
  }

  private async handleDeleteRecord(
    inputs: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    return this.recordMutation.deleteRecord({
      collectionCode: inputs.collectionCode as string,
      recordId: inputs.recordId as string,
      actorId: this.readActor(context),
    });
  }

  private async handleLookUpRecord(inputs: Record<string, unknown>) {
    const record = await this.recordMutation.getRecordById(
      inputs.collectionCode as string,
      inputs.recordId as string,
    );
    return { record: record ?? null };
  }

  private async handleSetFieldValue(
    inputs: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const propertyCode = inputs.propertyCode as string;
    const updated = await this.recordMutation.updateRecord({
      collectionCode: inputs.collectionCode as string,
      recordId: inputs.recordId as string,
      changes: { [propertyCode]: inputs.value },
      actorId: this.readActor(context),
    });
    return { recordId: updated?.id };
  }

  // ─────────────────────────────────────────────────────────────────
  // Notification
  // ─────────────────────────────────────────────────────────────────

  private async handleSendNotification(
    inputs: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const payload = {
      templateCode: inputs.templateCode as string,
      recipients: [inputs.recipientUserId as string],
      data: this.asObject(inputs.data ?? {}),
      triggeredBy: this.readActor(context),
    };
    const notificationId = this.uuid();
    await this.outboxPublisher.publish({
      eventType: 'workflow.notification.requested',
      payload: { ...payload, notificationId },
    });
    return { notificationId };
  }

  // ─────────────────────────────────────────────────────────────────
  // Approval
  // ─────────────────────────────────────────────────────────────────

  private async handleCreateApproval(
    inputs: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const instanceId = context.instanceId as string | undefined;
    const nodeId = context.nodeId as string | undefined;
    if (!instanceId || !nodeId) {
      throw new BadRequestException(
        'CreateApproval requires runtime context (instanceId + nodeId). Action is invoked from a flow node only.',
      );
    }
    const assignees = (inputs.assigneeUserIds as string[]) ?? [];
    if (assignees.length === 0) {
      throw new BadRequestException('CreateApproval requires at least one assigneeUserId.');
    }

    // Persist one Approval row per assignee, parallel-any semantics —
    // the runtime resolves the request once any approver responds.
    // Sequential / parallel-all semantics are author-time choices
    // that map to the engine's existing approval node, not to this
    // single CreateApproval action.
    const created = await Promise.all(
      assignees.map((approverId, index) =>
        this.approvalRepo.save(
          this.approvalRepo.create({
            processFlowInstanceId: instanceId,
            nodeId,
            approverId,
            approverType: 'user',
            status: 'pending',
            comments: (inputs.subject as string) ?? null,
            sequenceNumber: index + 1,
            approvalType: 'parallel_any',
          }),
        ),
      ),
    );
    return { approvalId: created[0].id };
  }

  private async handleWaitForApproval(inputs: Record<string, unknown>) {
    const approvalId = inputs.approvalId as string;
    const approval = await this.approvalRepo.findOne({ where: { id: approvalId } });
    if (!approval) {
      throw new BadRequestException(`Approval ${approvalId} not found`);
    }
    if (approval.status === 'pending' || approval.status === 'delegated') {
      // The engine state-machine owns "pause flow" semantics. Surface
      // a typed exception the dispatcher caller (workflow outbox
      // processor) translates into a `waiting_approval` state
      // transition — the action itself never returns from a pending
      // approval, otherwise the next node would consume a stale
      // 'rejected' default.
      throw new ApprovalPendingException(approvalId);
    }
    if (approval.status === 'approved' || approval.status === 'rejected') {
      return {
        decision: approval.status,
        comment: approval.comments ?? undefined,
      };
    }
    throw new BadRequestException(
      `Approval ${approvalId} is in terminal state '${approval.status}' — flow cannot proceed.`,
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Decision
  // ─────────────────────────────────────────────────────────────────

  private async handleMakeDecision(inputs: Record<string, unknown>) {
    const tableCode = inputs.tableCode as string;
    const tableInputs = this.asObject(inputs.inputs);
    const table = await this.decisionTableRepo.findOne({
      where: { code: tableCode },
      relations: ['inputs', 'rows'],
    });
    if (!table) {
      throw new BadRequestException(`Decision Table '${tableCode}' not found`);
    }
    if (table.status !== 'published') {
      throw new BadRequestException(
        `Decision Table '${tableCode}' is in status '${table.status}' — only published tables can be evaluated.`,
      );
    }
    const dto: DecisionTableDto = {
      id: table.id,
      code: table.code,
      name: table.name,
      collectionId: table.collectionId,
      status: table.status,
      hitPolicy: table.hitPolicy,
      answerCollectionCode: table.answerCollectionCode ?? null,
      inputs: (table.inputs ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        defaultValue: i.defaultValue,
      })),
      rows: (table.rows ?? []).map((r) => ({
        id: r.id,
        position: r.position,
        isActive: r.isActive,
        conditions: r.conditions ?? [],
        answerLiteral: r.answerLiteral,
        answerRecordId: r.answerRecordId ?? null,
      })),
    };
    const result = evaluateDecisionTable(dto, tableInputs);
    // Catalog output spec: { matched: boolean, answer?: json }. The
    // shared evaluator returns more (rowId, rowPosition, matches[])
    // — drop those for the action's typed return so downstream
    // canvas bindings see only what the catalog promises.
    return { matched: result.matched, answer: result.answer ?? null };
  }

  // ─────────────────────────────────────────────────────────────────
  // Integration
  // ─────────────────────────────────────────────────────────────────

  private async handleHttpRequest(inputs: Record<string, unknown>) {
    const connectorCode = inputs.connectorCode as string;
    const connector = await this.connectorRepo.findOne({
      where: { code: connectorCode, kind: 'http' },
    });
    if (!connector) {
      throw new BadRequestException(`HTTP Connector '${connectorCode}' not found`);
    }
    if (connector.status !== 'active') {
      throw new BadRequestException(
        `HTTP Connector '${connectorCode}' is in status '${connector.status}'`,
      );
    }
    if (connector.credentialRef) {
      // Authenticated connectors require the platform-vault client,
      // which lives in svc-data. Surfacing this as an explicit error
      // beats issuing the call without the auth header — a silent
      // 401 from the upstream would look like an availability bug.
      throw new NotImplementedException(
        `Connector '${connectorCode}' has credentialRef set; vault-resolved auth ships with the cross-service credential client (deferred).`,
      );
    }
    const config = (connector.config ?? {}) as { baseUrl?: string; defaultHeaders?: Record<string, string>; timeoutMs?: number };
    const baseUrl = config.baseUrl?.replace(/\/$/, '') ?? '';
    const path = (inputs.path as string).startsWith('/')
      ? (inputs.path as string)
      : `/${inputs.path as string}`;
    const url = `${baseUrl}${path}`;

    const response = await axios.request({
      url,
      method: inputs.method as string,
      headers: { ...config.defaultHeaders },
      data: inputs.body,
      timeout: config.timeoutMs ?? 30_000,
      validateStatus: () => true,
    });
    return { status: response.status, body: response.data };
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  private asObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private readActor(context: Record<string, unknown>): string | null {
    const value = context.actorId;
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private uuid(): string {
    return globalThis.crypto?.randomUUID?.() ?? this.fallbackUuid();
  }

  private fallbackUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Thrown by WaitForApproval when the named approval is still pending.
 * The workflow outbox processor catches this and transitions the
 * flow instance to `waiting_approval` instead of treating the wait
 * as a synchronous failure.
 */
export class ApprovalPendingException extends Error {
  readonly approvalId: string;
  constructor(approvalId: string) {
    super(`Approval ${approvalId} is still pending — flow paused.`);
    this.name = 'ApprovalPendingException';
    this.approvalId = approvalId;
  }
}
