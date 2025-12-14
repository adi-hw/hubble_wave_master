import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  TenantDbService,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStepExecution,
} from '@eam-platform/tenant-db';
import { IsNull } from 'typeorm';

export interface WorkflowStep {
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
  | 'parallel'
  | 'loop'
  | 'sub_workflow'
  | 'script'
  | 'http'
  | 'notification'
  | 'record_operation'
  | 'set_variable';

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

  // For 'parallel' type
  branches?: WorkflowStep[][];
  joinType?: 'all' | 'any' | 'count';
  joinCount?: number;

  // For 'loop' type
  loopType?: 'for_each' | 'while' | 'count';
  collection?: string;
  condition?: Record<string, unknown>;
  count?: number;
  maxIterations?: number;

  // For 'sub_workflow' type
  workflowCode?: string;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;

  // For 'script' type
  script?: string;
  timeout?: number;

  // For 'http' type
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  responseMapping?: Record<string, string>;

  // For 'notification' type
  templateCode?: string;
  recipients?: string[] | string;
  channels?: ('email' | 'sms' | 'push' | 'in_app')[];

  // For 'record_operation' type
  operation?: 'create' | 'update' | 'delete' | 'lookup';
  tableName?: string;
  fieldMapping?: Record<string, unknown>;
  lookupQuery?: Record<string, unknown>;

  // For 'set_variable' type
  variables?: Record<string, unknown>;
}

export interface ConditionalNext {
  condition: Record<string, unknown>;
  next: string;
}

export interface WorkflowContext {
  tenantId: string;
  runId: string;
  workflowId: string;
  triggeredBy?: string;
  input: Record<string, unknown>;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Start a new workflow run
   */
  async startWorkflow(
    tenantId: string,
    workflowCode: string,
    input: Record<string, unknown>,
    triggeredBy?: string,
    correlationId?: string
  ): Promise<WorkflowRun> {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    const workflowRepo = dataSource.getRepository(WorkflowDefinition);
    const runRepo = dataSource.getRepository(WorkflowRun);

    // Find workflow definition
    const workflow = await workflowRepo.findOne({
      where: [
        { tenantId, code: workflowCode, isActive: true, deletedAt: IsNull() },
        { tenantId: undefined, code: workflowCode, isActive: true, deletedAt: IsNull() },
      ],
    });

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowCode}`);
    }

    // Create workflow run
    const run = runRepo.create({
      workflowId: workflow.id,
      tenantId,
      triggerType: workflow.triggerType,
      triggeredBy,
      status: 'pending',
      inputData: input,
      contextData: workflow.variables || {},
      correlationId,
      executionPath: [],
    });

    await runRepo.save(run);

    this.logger.log(`Started workflow run ${run.id} for ${workflowCode}`);

    // Emit event
    this.eventEmitter.emit('workflow.started', {
      tenantId,
      runId: run.id,
      workflowCode,
      input,
    });

    // Execute workflow based on mode
    if (workflow.executionMode === 'sync') {
      await this.executeWorkflow(tenantId, run.id);
    } else {
      // Async execution - queue for processing
      setImmediate(() => this.executeWorkflow(tenantId, run.id));
    }

    return run;
  }

  /**
   * Execute a workflow run
   */
  async executeWorkflow(tenantId: string, runId: string): Promise<void> {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    const runRepo = dataSource.getRepository(WorkflowRun);
    const workflowRepo = dataSource.getRepository(WorkflowDefinition);

    const run = await runRepo.findOne({ where: { id: runId } });
    if (!run) {
      throw new Error(`Workflow run not found: ${runId}`);
    }

    const workflow = await workflowRepo.findOne({ where: { id: run.workflowId } });
    if (!workflow) {
      throw new Error(`Workflow definition not found: ${run.workflowId}`);
    }

    // Update run status
    run.status = 'running';
    run.startedAt = new Date();
    await runRepo.save(run);

    // Build workflow context
    const context: WorkflowContext = {
      tenantId,
      runId,
      workflowId: workflow.id,
      triggeredBy: run.triggeredBy,
      input: run.inputData || {},
      variables: run.contextData || {},
      stepOutputs: {},
    };

    try {
      // Get steps from workflow definition
      const steps: WorkflowStep[] = workflow.steps || [];

      // Find start step
      const startStep = steps.find((s) => s.type === 'start') || steps[0];
      if (!startStep) {
        throw new Error('No start step found in workflow');
      }

      // Execute from start step
      await this.executeStep(tenantId, run, workflow, startStep.id, context);

      // Reload run to get final state
      const finalRun = await runRepo.findOne({ where: { id: runId } });
      if (finalRun && finalRun.status === 'running') {
        finalRun.status = 'completed';
        finalRun.completedAt = new Date();
        finalRun.outputData = context.variables;
        await runRepo.save(finalRun);

        this.eventEmitter.emit('workflow.completed', {
          tenantId,
          runId,
          output: context.variables,
        });
      }
    } catch (error: any) {
      this.logger.error(`Workflow ${runId} failed: ${error.message}`, error.stack);

      run.status = 'failed';
      run.errorMessage = error.message;
      run.completedAt = new Date();
      await runRepo.save(run);

      this.eventEmitter.emit('workflow.failed', {
        tenantId,
        runId,
        error: error.message,
      });

      // Handle error based on workflow config
      if (workflow.errorHandling === 'notify_admin') {
        this.eventEmitter.emit('notification.send', {
          tenantId,
          templateCode: 'workflow_error',
          recipients: ['admin'],
          data: { workflowCode: workflow.code, runId, error: error.message },
        });
      }
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    tenantId: string,
    run: WorkflowRun,
    workflow: WorkflowDefinition,
    stepId: string,
    context: WorkflowContext
  ): Promise<void> {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    const runRepo = dataSource.getRepository(WorkflowRun);
    const stepExecRepo = dataSource.getRepository(WorkflowStepExecution);

    const steps: WorkflowStep[] = workflow.steps || [];
    const step = steps.find((s) => s.id === stepId);

    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    // Create step execution record
    const stepExec = stepExecRepo.create({
      runId: run.id,
      stepId: step.id,
      stepType: step.type,
      status: 'running',
      inputData: { context: context.variables, input: context.input },
      startedAt: new Date(),
    });
    await stepExecRepo.save(stepExec);

    // Update run current step
    run.currentStepId = stepId;
    run.executionPath = [...(run.executionPath || []), { stepId, timestamp: new Date() }];
    await runRepo.save(run);

    try {
      let nextStepId: string | undefined;

      // Execute step based on type
      switch (step.type) {
        case 'start':
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
          break;

        case 'end':
          // Workflow complete
          stepExec.status = 'completed';
          stepExec.completedAt = new Date();
          await stepExecRepo.save(stepExec);
          return;

        case 'action':
          const actionResult = await this.executeAction(step, context);
          context.stepOutputs[stepId] = actionResult;
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
          break;

        case 'condition':
          const conditionResult = await this.evaluateCondition(step.config.expression, context);
          nextStepId = conditionResult ? step.config.trueNext : step.config.falseNext;
          break;

        case 'approval':
          await this.createApprovalTask(step, run, context);
          stepExec.status = 'waiting';
          stepExec.waitingFor = { type: 'approval', approvers: step.config.approvers };
          await stepExecRepo.save(stepExec);

          // Update run status to waiting
          run.status = 'waiting';
          await runRepo.save(run);
          return; // Workflow paused until approval

        case 'wait':
          await this.executeWait(step, stepExec, run, context);
          return; // Workflow paused until wait complete

        case 'parallel':
          await this.executeParallel(step, run, workflow, context);
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
          break;

        case 'script':
          const scriptResult = await this.executeScript(step.config.script || '', context);
          context.stepOutputs[stepId] = scriptResult;
          if (typeof scriptResult === 'object' && scriptResult !== null) {
            context.variables = { ...context.variables, ...scriptResult };
          }
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
          break;

        case 'http':
          const httpResult = await this.executeHttpCall(step, context);
          context.stepOutputs[stepId] = httpResult;
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
          break;

        case 'notification':
          await this.executeNotification(step, context);
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
          break;

        case 'record_operation':
          const recordResult = await this.executeRecordOperation(step, context);
          context.stepOutputs[stepId] = recordResult;
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
          break;

        case 'set_variable':
          await this.executeSetVariable(step, context);
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
          break;

        case 'sub_workflow':
          const subResult = await this.executeSubWorkflow(step, context);
          context.stepOutputs[stepId] = subResult;
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
          break;

        default:
          this.logger.warn(`Unknown step type: ${step.type}`);
          nextStepId = typeof step.next === 'string' ? step.next : undefined;
      }

      // Update step execution
      stepExec.status = 'completed';
      stepExec.completedAt = new Date();
      stepExec.durationMs = Date.now() - stepExec.startedAt!.getTime();
      stepExec.outputData = context.stepOutputs[stepId] as Record<string, any>;
      await stepExecRepo.save(stepExec);

      // Emit step completed event
      this.eventEmitter.emit('workflow.step_completed', {
        tenantId,
        runId: run.id,
        stepId,
        stepType: step.type,
        output: context.stepOutputs[stepId],
      });

      // Continue to next step
      if (nextStepId) {
        await this.executeStep(tenantId, run, workflow, nextStepId, context);
      }
    } catch (error: any) {
      stepExec.status = 'failed';
      stepExec.errorMessage = error.message;
      stepExec.completedAt = new Date();
      await stepExecRepo.save(stepExec);

      // Check for error handling step
      if (step.onError) {
        await this.executeStep(tenantId, run, workflow, step.onError, context);
      } else {
        throw error;
      }
    }
  }

  /**
   * Execute an action step
   */
  private async executeAction(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<unknown> {
    // Emit event for action handlers
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Action timeout'));
      }, 30000);

      this.eventEmitter.emit('workflow.action', {
        tenantId: context.tenantId,
        runId: context.runId,
        stepId: step.id,
        actionType: step.config.actionType,
        config: step.config.actionConfig,
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
    context: WorkflowContext
  ): Promise<boolean> {
    if (!expression) return true;

    // Simple expression evaluation
    // TODO: Use a proper expression evaluator
    const { field, operator, value } = expression as any;
    const fieldValue = this.resolveValue(field, context);

    switch (operator) {
      case 'eq': return fieldValue === value;
      case 'ne': return fieldValue !== value;
      case 'gt': return Number(fieldValue) > Number(value);
      case 'gte': return Number(fieldValue) >= Number(value);
      case 'lt': return Number(fieldValue) < Number(value);
      case 'lte': return Number(fieldValue) <= Number(value);
      case 'contains': return String(fieldValue).includes(String(value));
      case 'in': return Array.isArray(value) && value.includes(fieldValue);
      default: return true;
    }
  }

  /**
   * Create an approval task
   */
  private async createApprovalTask(
    step: WorkflowStep,
    run: WorkflowRun,
    context: WorkflowContext
  ): Promise<void> {
    const approvers = this.resolveApprovers(step.config.approvers, context);

    this.eventEmitter.emit('approval.create', {
      tenantId: context.tenantId,
      workflowRunId: run.id,
      stepId: step.id,
      approvers,
      approvalType: step.config.approvalType || 'any',
      timeoutMinutes: step.config.timeoutMinutes,
      context: context.variables,
    });
  }

  /**
   * Execute wait step
   */
  private async executeWait(
    step: WorkflowStep,
    stepExec: WorkflowStepExecution,
    run: WorkflowRun,
    context: WorkflowContext
  ): Promise<void> {
    const dataSource = await this.tenantDb.getDataSource(context.tenantId);
    const runRepo = dataSource.getRepository(WorkflowRun);
    const stepExecRepo = dataSource.getRepository(WorkflowStepExecution);

    stepExec.status = 'waiting';
    stepExec.waitingFor = {
      type: step.config.waitType,
      duration: step.config.duration,
      unit: step.config.durationUnit,
    };
    await stepExecRepo.save(stepExec);

    run.status = 'waiting';
    await runRepo.save(run);

    // Schedule resume based on wait type
    if (step.config.waitType === 'duration' && step.config.duration) {
      const ms = this.durationToMs(step.config.duration, step.config.durationUnit || 'seconds');

      // In production, use a job queue
      setTimeout(() => {
        this.resumeWorkflow(context.tenantId, run.id, step.id);
      }, ms);
    }
  }

  /**
   * Execute parallel branches
   */
  private async executeParallel(
    step: WorkflowStep,
    run: WorkflowRun,
    workflow: WorkflowDefinition,
    context: WorkflowContext
  ): Promise<void> {
    if (!step.config.branches || step.config.branches.length === 0) return;

    const branchResults = await Promise.all(
      step.config.branches.map(async (branch, index) => {
        const branchContext = { ...context };
        for (const branchStep of branch) {
          await this.executeStep(context.tenantId, run, workflow, branchStep.id, branchContext);
        }
        return { index, output: branchContext.stepOutputs };
      })
    );

    context.stepOutputs[step.id] = branchResults;
  }

  /**
   * Execute script step
   */
  private async executeScript(
    script: string,
    context: WorkflowContext
  ): Promise<unknown> {
    try {
      const fn = new Function(
        'input', 'variables', 'stepOutputs',
        `"use strict"; return (async () => { ${script} })();`
      );
      return await fn(context.input, context.variables, context.stepOutputs);
    } catch (error: any) {
      throw new Error(`Script execution failed: ${error.message}`);
    }
  }

  /**
   * Execute HTTP call step
   */
  private async executeHttpCall(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<unknown> {
    const url = this.interpolateString(step.config.url || '', context);
    const method = step.config.method || 'GET';
    const headers = step.config.headers || {};
    const body = step.config.body ? this.interpolateObject(step.config.body, context) : undefined;

    // Emit event for HTTP handler
    return new Promise((resolve, reject) => {
      this.eventEmitter.emit('http.request', {
        url,
        method,
        headers,
        body,
        callback: (error: Error | null, result: unknown) => {
          if (error) reject(error);
          else resolve(result);
        },
      });
    });
  }

  /**
   * Execute notification step
   */
  private async executeNotification(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<void> {
    const recipients = this.resolveApprovers(step.config.recipients, context);

    this.eventEmitter.emit('notification.send', {
      tenantId: context.tenantId,
      templateCode: step.config.templateCode,
      recipients,
      channels: step.config.channels || ['email'],
      data: context.variables,
    });
  }

  /**
   * Execute record operation step
   */
  private async executeRecordOperation(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<unknown> {
    const operation = step.config.operation;
    const tableName = step.config.tableName;

    // Emit event for data service to handle
    return new Promise((resolve, reject) => {
      this.eventEmitter.emit('record.operation', {
        tenantId: context.tenantId,
        operation,
        tableName,
        data: this.interpolateObject(step.config.fieldMapping || {}, context),
        query: step.config.lookupQuery,
        callback: (error: Error | null, result: unknown) => {
          if (error) reject(error);
          else resolve(result);
        },
      });
    });
  }

  /**
   * Execute set variable step
   */
  private async executeSetVariable(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<void> {
    if (!step.config.variables) return;

    for (const [key, value] of Object.entries(step.config.variables)) {
      context.variables[key] = this.resolveValue(value, context);
    }
  }

  /**
   * Execute sub-workflow step
   */
  private async executeSubWorkflow(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<unknown> {
    if (!step.config.workflowCode) {
      throw new Error('Sub-workflow code not specified');
    }

    const input = step.config.inputMapping
      ? this.interpolateObject(step.config.inputMapping as Record<string, unknown>, context)
      : context.variables;

    const subRun = await this.startWorkflow(
      context.tenantId,
      step.config.workflowCode,
      input as Record<string, unknown>,
      context.triggeredBy,
      context.runId
    );

    // Wait for sub-workflow to complete
    // In production, this would be event-driven
    return subRun.outputData;
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(
    tenantId: string,
    runId: string,
    fromStepId: string,
    resumeData?: Record<string, unknown>
  ): Promise<void> {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    const runRepo = dataSource.getRepository(WorkflowRun);
    const workflowRepo = dataSource.getRepository(WorkflowDefinition);
    const stepExecRepo = dataSource.getRepository(WorkflowStepExecution);

    const run = await runRepo.findOne({ where: { id: runId } });
    if (!run || run.status !== 'waiting') {
      this.logger.warn(`Cannot resume workflow ${runId}: not in waiting state`);
      return;
    }

    const workflow = await workflowRepo.findOne({ where: { id: run.workflowId } });
    if (!workflow) return;

    // Update waiting step
    const stepExec = await stepExecRepo.findOne({
      where: { runId, stepId: fromStepId, status: 'waiting' },
    });

    if (stepExec) {
      stepExec.status = 'completed';
      stepExec.completedAt = new Date();
      stepExec.outputData = resumeData;
      await stepExecRepo.save(stepExec);
    }

    // Update run status
    run.status = 'running';
    await runRepo.save(run);

    // Build context
    const context: WorkflowContext = {
      tenantId,
      runId,
      workflowId: workflow.id,
      triggeredBy: run.triggeredBy,
      input: run.inputData || {},
      variables: { ...run.contextData, ...resumeData },
      stepOutputs: {},
    };

    // Find next step
    const steps: WorkflowStep[] = workflow.steps || [];
    const currentStep = steps.find((s) => s.id === fromStepId);

    if (currentStep && typeof currentStep.next === 'string') {
      await this.executeStep(tenantId, run, workflow, currentStep.next, context);
    }
  }

  // ============ Helper Methods ============

  private resolveValue(value: unknown, context: WorkflowContext): unknown {
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

  private interpolateString(str: string, context: WorkflowContext): string {
    return str.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
      const value = this.getNestedValue(context as unknown as Record<string, unknown>, path);
      return value !== undefined ? String(value) : '';
    });
  }

  private interpolateObject(
    obj: Record<string, unknown>,
    context: WorkflowContext
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.resolveValue(value, context);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateObject(value as Record<string, unknown>, context);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private resolveApprovers(
    approvers: string[] | string | undefined,
    context: WorkflowContext
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

  @OnEvent('workflow.start')
  async handleWorkflowStart(payload: any): Promise<void> {
    await this.startWorkflow(
      payload.tenantId,
      payload.workflowCode,
      payload.input || {},
      payload.triggeredBy
    );
  }

  @OnEvent('approval.response')
  async handleApprovalResponse(payload: any): Promise<void> {
    await this.resumeWorkflow(
      payload.tenantId,
      payload.workflowRunId,
      payload.stepId,
      { approved: payload.approved, approver: payload.approver, comments: payload.comments }
    );
  }
}
