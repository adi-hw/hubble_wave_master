import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProcessFlowDefinition,
  ProcessFlowInstance,
  ProcessFlowExecutionHistory,
} from '@hubblewave/instance-db';
import { ProcessFlowQueueService } from './process-flow-queue.service';
import { SafeExpressionEvaluator, SafeExpressionError } from './safe-expression-evaluator';

export interface ProcessFlowStep {
  id: string;
  type: StepType;
  name: string;
  config: StepConfig;
  next?: string | ConditionalNext[];
  onError?: string;
}

export type StepType =
  | 'start'
  | 'end'
  | 'action'
  | 'condition'
  | 'approval'
  | 'wait'
  | 'subflow';

export interface StepConfig {
  // For 'action' type
  actionType?: string;
  actionConfig?: Record<string, unknown>;

  // For 'condition' type
  expression?: Record<string, unknown>;
  trueNext?: string;
  falseNext?: string;

  // For 'approval' type
  approvers?: string[] | string;
  approvalType?: 'any' | 'all' | 'majority';
  timeoutMinutes?: number;
  escalationConfig?: Record<string, unknown>;

  // For 'wait' type
  waitType?: 'duration' | 'until' | 'event';
  duration?: number;
  durationUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  untilExpression?: string;
  eventPattern?: string;

  // For 'subflow' type
  processFlowCode?: string;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
}

export interface ConditionalNext {
  condition: Record<string, unknown>;
  next: string;
}

export interface ProcessFlowContext {
  userId: string;
  instanceId: string;
  processFlowId: string;
  triggeredBy?: string;
  input: Record<string, unknown>;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
  /**
   * Plan §8.1.4 — author-facing namespaces injected so DataPillPicker
   * tokens (`{{trigger.x}}`, `{{user.x}}`, `{{system.now}}`)
   * actually resolve. `trigger` is an alias of `input` (the trigger
   * record); `user` carries id + loaded profile fields where
   * available; `system` exposes platform values. Without these,
   * picker-emitted pills would resolve to undefined at runtime.
   */
  trigger?: Record<string, unknown>;
  user?: Record<string, unknown>;
  system?: Record<string, unknown>;
}

@Injectable()
export class ProcessFlowEngineService {
  private readonly logger = new Logger(ProcessFlowEngineService.name);
  // F027 (W1 task 8): the previous `new Parser()` had no validation,
  // no AST cap, no timeout. A flow author could write
  // `constructor.constructor('return process')()` and crash the
  // worker. SafeExpressionEvaluator wraps expr-eval with the same
  // five-layer defense pattern used in
  // apps/svc-automation/src/app/runtime/script-sandbox.service.ts:
  // length cap, NFKC normalization + defanged-copy pattern check,
  // AST depth cap, wall-clock timeout.
  private readonly expressionEvaluator = new SafeExpressionEvaluator();

  constructor(
    @InjectRepository(ProcessFlowDefinition)
    private readonly processFlowRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(ProcessFlowInstance)
    private readonly instanceRepo: Repository<ProcessFlowInstance>,
    @InjectRepository(ProcessFlowExecutionHistory)
    private readonly historyRepo: Repository<ProcessFlowExecutionHistory>,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => ProcessFlowQueueService))
    private readonly processFlowQueue: ProcessFlowQueueService
  ) {}

  /**
   * Start a new process flow instance
   */
  async startProcessFlow(
    processFlowCode: string,
    input: Record<string, unknown>,
    triggeredBy?: string,
    correlationId?: string
  ): Promise<ProcessFlowInstance> {
    // Runtime enforces both flags. `isActive` is the operational
    // switch; `status='published'` is the lifecycle gate. Either alone
    // is insufficient — a stale `isActive=true` from a seed, import,
    // or direct data correction must not let an unreviewed draft or
    // a retired deprecated definition fire.
    const processFlow = await this.processFlowRepo.findOne({
      where: { code: processFlowCode, isActive: true, status: 'published' },
    });

    if (!processFlow) {
      throw new Error(`Process flow not found or not in a runnable state: ${processFlowCode}`);
    }

    // Create process flow instance
    const instance = this.instanceRepo.create({
      processFlowId: processFlow.id,
      recordId: correlationId || 'manual',
      state: 'running',
      context: {
        input,
        variables: {},
        triggeredBy,
      },
    });

    await this.instanceRepo.save(instance);

    this.logger.log(`Started process flow instance ${instance.id} for ${processFlowCode}`);

    // Emit event
    this.eventEmitter.emit('processFlow.started', {
      instanceId: instance.id,
      processFlowCode,
      input,
    });

    // Execute process flow
    setImmediate(() => this.executeProcessFlow(instance.id));

    return instance;
  }

  /**
   * Execute a process flow instance
   */
  async executeProcessFlow(instanceId: string): Promise<void> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance) {
      throw new Error(`Process flow instance not found: ${instanceId}`);
    }

    const processFlow = await this.processFlowRepo.findOne({ where: { id: instance.processFlowId } });
    if (!processFlow) {
      throw new Error(`Process flow definition not found: ${instance.processFlowId}`);
    }

    // ADR-5 lifecycle gate, re-checked here. `startProcessFlow` already
    // gated `status='published' AND isActive=true` at instance creation,
    // but a deprecation between create and execute (mid-`setImmediate`
    // dispatch) could otherwise let the engine run a deprecated
    // definition. Re-validating after the reload closes that race.
    if (processFlow.status !== 'published' || !processFlow.isActive) {
      throw new Error(
        `Process flow ${processFlow.code} is not published or active; refusing to execute.`,
      );
    }

    // Update instance state
    instance.state = 'running';
    instance.startedAt = new Date();
    await this.instanceRepo.save(instance);

    // Build process flow context
    const triggerInput = ((instance.context as any)?.input ?? {}) as Record<string, unknown>;
    const triggeredById = (instance.context as any)?.triggeredBy as string | undefined;
    const context: ProcessFlowContext = {
      userId: triggeredById || 'system',
      instanceId,
      processFlowId: processFlow.id,
      triggeredBy: triggeredById,
      input: triggerInput,
      variables: (instance.context as any)?.variables || {},
      stepOutputs: {},
      // Author-facing namespaces (plan §8.1.4). `trigger` aliases
      // `input` so {{trigger.x}} resolves to the trigger record's
      // x. `user` carries id (and profile fields if loaded). `system`
      // exposes deterministic-at-instance-start now/today/instanceCode.
      trigger: triggerInput,
      user: this.buildUserNamespace(triggeredById),
      system: this.buildSystemNamespace(),
    };

    try {
      // Get nodes from process flow definition
      const nodes = processFlow.canvas?.nodes || [];

      // Find start node
      const startNode = nodes.find((n) => n.type === 'start') || nodes[0];
      if (!startNode) {
        throw new Error('No start node found in process flow');
      }

      // Execute from start node
      await this.executeNode(instance, processFlow, startNode.id, context);

      // Reload instance to get final state
      const finalInstance = await this.instanceRepo.findOne({ where: { id: instanceId } });
      if (finalInstance && finalInstance.state === 'running') {
        finalInstance.state = 'completed';
        finalInstance.completedAt = new Date();
        finalInstance.durationMs = Date.now() - finalInstance.startedAt!.getTime();
        await this.instanceRepo.save(finalInstance);

        this.eventEmitter.emit('processFlow.completed', {
          instanceId,
          output: context.variables,
        });
      }
    } catch (error: any) {
      this.logger.error(`Process flow ${instanceId} failed: ${error.message}`, error.stack);

      instance.state = 'failed';
      instance.errorMessage = error.message;
      instance.errorStack = error.stack;
      instance.completedAt = new Date();
      await this.instanceRepo.save(instance);

      this.eventEmitter.emit('processFlow.failed', {
        instanceId,
        error: error.message,
      });
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    instance: ProcessFlowInstance,
    processFlow: ProcessFlowDefinition,
    nodeId: string,
    context: ProcessFlowContext
  ): Promise<void> {
    const nodes = processFlow.canvas?.nodes || [];
    const connections = processFlow.canvas?.connections || [];
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Create execution history record
    const history = this.historyRepo.create({
      instanceId: instance.id,
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.name,
      action: 'execute',
      status: 'started',
      inputData: { context: context.variables, input: context.input },
    });
    await this.historyRepo.save(history);

    // Update instance current node
    instance.currentNodeId = nodeId;
    await this.instanceRepo.save(instance);

    try {
      let nextNodeId: string | undefined;

      // Execute node based on type
      const nodeType: string = (node as unknown as { type: string }).type;
      switch (nodeType) {
        case 'start':
          nextNodeId = this.findNextNode(nodeId, connections);
          break;

        case 'end':
          // Process flow complete
          history.status = 'completed';
          await this.historyRepo.save(history);
          return;

        case 'action': {
          const actionResult = await this.executeAction(node, context);
          context.stepOutputs[nodeId] = actionResult;
          nextNodeId = this.findNextNode(nodeId, connections);
          break;
        }

        case 'update_record':
        case 'create_record':
        case 'send_email':
        case 'send_notification': {
          const actionNode = {
            ...node,
            config: {
              actionType: nodeType,
              actionConfig: node.config || {},
            },
          };
          const actionResult = await this.executeAction(actionNode, context);
          context.stepOutputs[nodeId] = actionResult;
          nextNodeId = this.findNextNode(nodeId, connections);
          break;
        }

        case 'condition': {
          const conditionResult = await this.evaluateCondition(
            node.config.expression as Record<string, unknown>,
            context
          );
          const condConnection = connections.find(c =>
            c.fromNode === nodeId &&
            (conditionResult ? c.label === 'true' || c.fromPort === 'true' : c.label === 'false' || c.fromPort === 'false')
          );
          nextNodeId = condConnection?.toNode || this.findNextNode(nodeId, connections);
          break;
        }

        case 'approval':
          await this.createApprovalTask(node, instance, context);
          history.status = 'waiting';
          await this.historyRepo.save(history);

          // Update instance state to waiting
          instance.state = 'waiting_approval';
          await this.instanceRepo.save(instance);

          // Schedule approval timeout if configured
          if (node.config.timeoutMinutes && this.processFlowQueue.isQueueEnabled()) {
            await this.processFlowQueue.scheduleApprovalTimeout(instance.id, node.id, node.config.timeoutMinutes as number);
          }
          return; // Process flow paused until approval

        case 'wait':
          await this.executeWait(node, history, instance);
          return; // Process flow paused until wait complete

        case 'subflow': {
          const subResult = await this.executeSubProcessFlow(node, context);
          context.stepOutputs[nodeId] = subResult;
          nextNodeId = this.findNextNode(nodeId, connections);
          break;
        }

        default:
          this.logger.warn(`Unknown node type: ${nodeType}`);
          nextNodeId = this.findNextNode(nodeId, connections);
      }

      // Update history
      history.status = 'completed';
      history.outputData = context.stepOutputs[nodeId] as Record<string, any>;
      history.executionTimeMs = Date.now() - history.createdAt.getTime();
      await this.historyRepo.save(history);

      // Persist stepOutputs to instance.context after every node so a
      // subsequent pause+resume preserves the bindings authors wired
      // (e.g. WaitForApproval reading `{{stepOutputs.<createApproval>.approvalId}}`).
      // Without this every resume path rebuilds context with an empty
      // stepOutputs map and any cross-node binding resolves to undefined.
      if (context.stepOutputs[nodeId] !== undefined) {
        await this.persistStepOutputs(instance.id, context.stepOutputs);
      }

      // Emit step completed event
      this.eventEmitter.emit('processFlow.step_completed', {
        instanceId: instance.id,
        nodeId,
        nodeType: nodeType,
        output: context.stepOutputs[nodeId],
      });

      // Continue to next node
      if (nextNodeId) {
        await this.executeNode(instance, processFlow, nextNodeId, context);
      }
    } catch (error: any) {
      // The catalog's WaitForApproval handler throws an
      // `ApprovalPendingException` (name-tagged across the
      // event-bus boundary; we can't `instanceof` across the
      // package split, so we match by `error.name`) when the
      // referenced approval is still pending. That isn't a flow
      // failure — it's the *normal* park-until-resolved path.
      // Mark the history step as `waiting`, flip the instance to
      // `waiting_approval`, and return without rethrowing so the
      // caller doesn't cascade into the failed-instance handler.
      // Resolution is driven by `resumeFromApproval` when the
      // Approval row transitions out of `pending`.
      if (error?.name === 'ApprovalPendingException') {
        history.status = 'waiting';
        await this.historyRepo.save(history);

        const instanceState = await this.instanceRepo.findOne({ where: { id: instance.id } });
        if (instanceState) {
          instanceState.state = 'waiting_approval';
          // currentNodeId is the field `resumeProcessFlow` looks at
          // when an approval response arrives.
          instanceState.currentNodeId = nodeId;
          await this.instanceRepo.save(instanceState);
        }

        this.eventEmitter.emit('processFlow.waiting_approval', {
          instanceId: instance.id,
          nodeId,
          approvalId: error.approvalId,
        });
        return;
      }

      history.status = 'failed';
      history.errorMessage = error.message;
      history.errorStack = error.stack;
      await this.historyRepo.save(history);

      throw error;
    }
  }

  /**
   * Find the next node from connections
   */
  private findNextNode(fromNodeId: string, connections: { fromNode: string; toNode: string }[]): string | undefined {
    const connection = connections.find(c => c.fromNode === fromNodeId);
    return connection?.toNode;
  }

  /**
   * Execute an action node
   */
  private async executeAction(
    node: { id: string; config: Record<string, unknown> },
    context: ProcessFlowContext
  ): Promise<unknown> {
    // Resolve {{path.to.value}} bindings against the runtime context
    // before the dispatcher sees the config. Without this, every
    // action that exposes bindings to authors (MakeDecision inputs,
    // UpdateRecord values, SendNotification recipientUserId,
    // HTTPRequest body, …) ends up comparing literal `{{record.x}}`
    // strings to real data — flows look authored correctly but
    // never match.
    const rawActionConfig = (node.config.actionConfig ?? {}) as Record<string, unknown>;
    const resolvedConfig = this.interpolateObject(rawActionConfig, context);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Action timeout'));
      }, 30000);

      this.eventEmitter.emit('processFlow.action', {
        instanceId: context.instanceId,
        nodeId: node.id,
        actionType: node.config.actionType,
        config: resolvedConfig,
        context: context.variables,
        callback: (error: Error | null, result: unknown) => {
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve(result);
        },
      });
    });
  }

  /**
   * Evaluate a condition expression
   */
  private async evaluateCondition(
    expression: Record<string, unknown> | undefined,
    context: ProcessFlowContext
  ): Promise<boolean> {
    if (!expression) return true;

    if (typeof expression === 'string') {
      return this.evaluateExpressionString(expression, context);
    }

    const { property, operator, value } = expression as any;
    const propertyValue = this.resolveValue(property, context);

    switch (operator) {
      case 'eq': return propertyValue === value;
      case 'ne': return propertyValue !== value;
      case 'gt': return Number(propertyValue) > Number(value);
      case 'gte': return Number(propertyValue) >= Number(value);
      case 'lt': return Number(propertyValue) < Number(value);
      case 'lte': return Number(propertyValue) <= Number(value);
      case 'contains': return String(propertyValue).includes(String(value));
      case 'in': return Array.isArray(value) && value.includes(propertyValue);
      default: return true;
    }
  }

  private evaluateExpressionString(expression: string, context: ProcessFlowContext): boolean {
    const scope = {
      input: context.input || {},
      variables: context.variables || {},
      steps: context.stepOutputs || {},
      record: context.input || {},
      context: {
        input: context.input || {},
        variables: context.variables || {},
        steps: context.stepOutputs || {},
      },
    };

    try {
      const result = this.expressionEvaluator.evaluateSync(
        expression,
        scope as unknown as Record<string, unknown>,
      );
      return Boolean(result);
    } catch (error) {
      // SafeExpressionError carries a structured `reason` field; surface
      // it in the log so the operator can distinguish "expression
      // syntax error" (parse) from "expression rejected by deny list"
      // (pattern) from "expression too deep / too long" (depth/length).
      // All cases fail-closed: the condition returns false, which means
      // the conditional branch does NOT take the truthy edge.
      const reason = error instanceof SafeExpressionError ? error.reason : 'unknown';
      this.logger.warn(
        `Condition expression rejected (${reason}): ${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Create an approval task
   */
  private async createApprovalTask(
    node: { id: string; config: Record<string, unknown> },
    instance: ProcessFlowInstance,
    context: ProcessFlowContext
  ): Promise<void> {
    const approvers = this.resolveApprovers(node.config.approvers as string[] | string, context);

    this.eventEmitter.emit('approval.create', {
      processFlowInstanceId: instance.id,
      nodeId: node.id,
      approvers,
      approvalType: node.config.approvalType || 'any',
      timeoutMinutes: node.config.timeoutMinutes,
      context: context.variables,
    });
  }

  /**
   * Execute wait node
   */
  private async executeWait(
    node: { id: string; config: Record<string, unknown> },
    history: ProcessFlowExecutionHistory,
    instance: ProcessFlowInstance
  ): Promise<void> {
    history.status = 'waiting';
    await this.historyRepo.save(history);

    instance.state = 'waiting_condition';
    await this.instanceRepo.save(instance);

    // Schedule resume based on wait type
    if (node.config.waitType === 'duration' && node.config.duration) {
      const ms = this.durationToMs(node.config.duration as number, (node.config.durationUnit as string) || 'seconds');

      // Schedule process flow resume after duration using BullMQ for persistence
      if (this.processFlowQueue.isQueueEnabled()) {
        await this.processFlowQueue.scheduleWaitComplete(instance.id, node.id, ms);
      } else {
        // Fallback to in-process timer when Redis unavailable
        setTimeout(() => {
          this.resumeProcessFlow(instance.id, node.id);
        }, ms);
      }
    }
  }

  /**
   * Execute sub-process-flow node
   */
  private async executeSubProcessFlow(
    node: { id: string; config: Record<string, unknown> },
    context: ProcessFlowContext
  ): Promise<unknown> {
    if (!node.config.processFlowCode) {
      throw new Error('Sub-process flow code not specified');
    }

    const input = node.config.inputMapping
      ? this.interpolateObject(node.config.inputMapping as Record<string, unknown>, context)
      : context.variables;

    const subInstance = await this.startProcessFlow(
      node.config.processFlowCode as string,
      input as Record<string, unknown>,
      context.triggeredBy,
      context.instanceId
    );

    return subInstance.context;
  }

  /**
   * Resume a paused process flow.
   *
   * `fromNodeId` is the node the resume advances *past* — the next
   * node from this id is what executes. `seedStepOutputs` pre-populates
   * `stepOutputs[fromNodeId]` so the resumed-from node's outputs are
   * available to downstream bindings (used by the approval-response
   * path to seed the WaitForApproval node's `decision` / `comment`).
   */
  async resumeProcessFlow(
    instanceId: string,
    fromNodeId: string,
    resumeData?: Record<string, unknown>,
    seedStepOutputs?: Record<string, unknown>,
  ): Promise<void> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance || (instance.state !== 'waiting_approval' && instance.state !== 'waiting_condition')) {
      this.logger.warn(`Cannot resume process flow ${instanceId}: not in waiting state`);
      return;
    }

    const processFlow = await this.processFlowRepo.findOne({ where: { id: instance.processFlowId } });
    if (!processFlow) return;

    // Update waiting history
    const history = await this.historyRepo.findOne({
      where: { instanceId, nodeId: fromNodeId, status: 'waiting' },
    });

    if (history) {
      history.status = 'completed';
      history.outputData = resumeData;
      await this.historyRepo.save(history);
    }

    // Update instance state
    instance.state = 'running';
    await this.instanceRepo.save(instance);

    // Build context — restore stepOutputs persisted across the pause
    // so cross-node bindings (e.g. CreateApproval → WaitForApproval's
    // approvalId) survive. The resumed-from node's own outputs are
    // seeded from the resolution payload (decision/comment for an
    // approval response).
    const instanceContext = instance.context as Record<string, unknown> | null;
    const restoredStepOutputs = this.toRecord(instanceContext?.stepOutputs);
    if (seedStepOutputs) {
      restoredStepOutputs[fromNodeId] = seedStepOutputs;
      // Persist the seeded outputs so a re-resume hits the same state.
      await this.persistStepOutputs(instanceId, restoredStepOutputs);
    }
    const resumedInput = this.toRecord(instanceContext?.input);
    const resumedTriggeredBy = instanceContext?.triggeredBy as string | undefined;
    const context: ProcessFlowContext = {
      userId: resumedTriggeredBy || 'system',
      instanceId,
      processFlowId: processFlow.id,
      triggeredBy: resumedTriggeredBy,
      input: resumedInput,
      variables: { ...this.toRecord(instanceContext?.variables), ...(resumeData ?? {}) },
      stepOutputs: restoredStepOutputs,
      // Plan §8.1.4 — same author-facing namespace injection as the
      // initial-start path; resume must reproduce the same scope so
      // post-pause bindings keep resolving.
      trigger: resumedInput,
      user: this.buildUserNamespace(resumedTriggeredBy),
      system: this.buildSystemNamespace(),
    };

    // Find next node
    const connections = processFlow.canvas?.connections || [];
    const nextNodeId = this.findNextNode(fromNodeId, connections);

    if (nextNodeId) {
      await this.executeNode(instance, processFlow, nextNodeId, context);
    }
  }

  /**
   * Merge stepOutputs into `instance.context` and save. Called from
   * executeNode after a node completes and from resumeProcessFlow
   * when seeding a resumed node's outputs.
   */
  private async persistStepOutputs(
    instanceId: string,
    stepOutputs: Record<string, unknown>,
  ): Promise<void> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance) return;
    const existing = (instance.context as Record<string, unknown> | null) ?? {};
    instance.context = { ...existing, stepOutputs } as Record<string, unknown>;
    await this.instanceRepo.save(instance);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  /**
   * Plan §8.1.4 — author-facing `user` namespace. The engine keeps
   * the user id as a single string field (`userId`); the namespace
   * shape mirrors the DataPillPicker contract (`user.id`,
   * `user.email`, `user.username`). Profile fields are populated
   * from the loaded user record when available; missing fields stay
   * undefined and resolve to '' in the engine's `interpolateString`.
   */
  private buildUserNamespace(userId: string | undefined): Record<string, unknown> {
    return {
      id: userId ?? null,
      // Email / username could be looked up via UserRepository here.
      // We don't fetch synchronously inside context-build because
      // engine startup is on the hot path; downstream actions that
      // need the full user record can call LookUpRecord against
      // `users` with `{{userId}}`.
      email: undefined,
      username: undefined,
    };
  }

  /**
   * Plan §8.1.4 — author-facing `system` namespace. `now` is captured
   * at context-build time so all bindings inside one flow execution
   * see the SAME timestamp (no drift across nodes that take measurable
   * time). `instanceCode` reads the platform env so authors can
   * route on which instance is running the flow.
   */
  private buildSystemNamespace(): Record<string, unknown> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      now: now.toISOString(),
      today: today.toISOString().slice(0, 10),
      instanceCode: process.env.INSTANCE_CODE ?? 'default',
    };
  }

  // ============ Helper Methods ============

  private resolveValue(value: unknown, context: ProcessFlowContext): unknown {
    if (typeof value !== 'string') return value;

    // Variable reference: {{variable_name}}
    if (value.startsWith('{{') && value.endsWith('}}')) {
      const path = value.slice(2, -2).trim();
      return this.getNestedValue(context as unknown as Record<string, unknown>, path);
    }

    return this.interpolateString(value, context);
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private interpolateString(str: string, context: ProcessFlowContext): string {
    return str.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
      const value = this.getNestedValue(context as unknown as Record<string, unknown>, path);
      return value !== undefined ? String(value) : '';
    });
  }

  private interpolateObject(
    obj: Record<string, unknown>,
    context: ProcessFlowContext
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.interpolateAny(value, context);
    }

    return result;
  }

  /**
   * Walks any JSON-like value, interpolating {{...}} bindings while
   * preserving the original shape. Arrays must round-trip as arrays;
   * routing them through interpolateObject would Object.entries them
   * into `{0, 1, ...}` and corrupt list-valued action inputs (decision
   * table multi-value inputs, HTTP request bodies, notification data).
   */
  private interpolateAny(value: unknown, context: ProcessFlowContext): unknown {
    if (typeof value === 'string') return this.resolveValue(value, context);
    if (Array.isArray(value)) return value.map((entry) => this.interpolateAny(entry, context));
    if (value && typeof value === 'object') {
      return this.interpolateObject(value as Record<string, unknown>, context);
    }
    return value;
  }

  private resolveApprovers(
    approvers: string[] | string | undefined,
    context: ProcessFlowContext
  ): string[] {
    if (!approvers) return [];

    if (Array.isArray(approvers)) {
      return approvers.map((a) => String(this.resolveValue(a, context)));
    }

    const resolved = this.resolveValue(approvers, context);
    return Array.isArray(resolved) ? resolved.map(String) : [String(resolved)];
  }

  private durationToMs(duration: number, unit: string): number {
    switch (unit) {
      case 'seconds': return duration * 1000;
      case 'minutes': return duration * 60 * 1000;
      case 'hours': return duration * 60 * 60 * 1000;
      case 'days': return duration * 24 * 60 * 60 * 1000;
      default: return duration * 1000;
    }
  }

  // ============ Event Handlers ============

  @OnEvent('processFlow.start')
  async handleProcessFlowStart(payload: any): Promise<void> {
    await this.startProcessFlow(
      payload.processFlowCode,
      payload.input || {},
      payload.triggeredBy,
      payload.correlationId
    );
  }

  @OnEvent('approval.response')
  async handleApprovalResponse(payload: any): Promise<void> {
    // The Approval row stores the CreateApproval node id (the action
    // that authored it), but the parked node — the one we actually
    // need to resume past — is the WaitForApproval downstream of it.
    // The engine writes that node id to `instance.currentNodeId`
    // when the catalog's WaitForApproval handler throws
    // ApprovalPendingException. Prefer that over the Approval row's
    // nodeId so resume targets the parked node, not the
    // already-completed CreateApproval. Falls back to the legacy
    // engine `approval` node (which IS the parked node) when
    // currentNodeId isn't set.
    const instance = await this.instanceRepo.findOne({
      where: { id: payload.processFlowInstanceId },
    });
    const resumeFromNodeId = instance?.currentNodeId ?? payload.nodeId;

    // Translate the runtime approval-response shape into the
    // catalog WaitForApproval output shape so downstream bindings
    // see what the catalog declares (`decision` / `comment`).
    const seedOutputs = {
      decision: payload.approved ? 'approved' : 'rejected',
      comment: payload.comments,
    };

    await this.resumeProcessFlow(
      payload.processFlowInstanceId,
      resumeFromNodeId,
      { approved: payload.approved, approver: payload.approver, comments: payload.comments },
      seedOutputs,
    );
  }

  // ============ Queue Event Handlers ============

  @OnEvent('processFlow.queue.execute')
  async handleQueueExecute(payload: { instanceId: string; data?: Record<string, unknown> }): Promise<void> {
    await this.executeProcessFlow(payload.instanceId);
  }

  @OnEvent('processFlow.queue.resume')
  async handleQueueResume(payload: { instanceId: string; nodeId: string; data?: Record<string, unknown> }): Promise<void> {
    await this.resumeProcessFlow(payload.instanceId, payload.nodeId, payload.data);
  }

  @OnEvent('processFlow.queue.wait_complete')
  async handleQueueWaitComplete(payload: { instanceId: string; nodeId: string }): Promise<void> {
    await this.resumeProcessFlow(payload.instanceId, payload.nodeId);
  }

  @OnEvent('processFlow.queue.approval_timeout')
  async handleQueueApprovalTimeout(payload: { instanceId: string; nodeId: string }): Promise<void> {
    const instance = await this.instanceRepo.findOne({ where: { id: payload.instanceId } });
    if (!instance || instance.state !== 'waiting_approval') return;

    const processFlow = await this.processFlowRepo.findOne({ where: { id: instance.processFlowId } });
    if (!processFlow) return;

    const nodes = processFlow.canvas?.nodes || [];
    const node = nodes.find((n) => n.id === payload.nodeId);

    if (node?.config.escalationConfig) {
      this.eventEmitter.emit('approval.escalate', {
        instanceId: payload.instanceId,
        nodeId: payload.nodeId,
        escalationConfig: node.config.escalationConfig,
      });
    } else {
      await this.resumeProcessFlow(payload.instanceId, payload.nodeId, { approved: false, timedOut: true });
    }
  }
}
