import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ProcessFlowConnection,
  ProcessFlowDefinition,
  ProcessFlowDefinitionRevision,
  ProcessFlowRunAs,
  User,
} from '@hubblewave/instance-db';
import { BUILT_IN_ACTIONS } from '@hubblewave/shared-types';
import { ProcessFlowEngineService } from '@hubblewave/automation';

// Engine-specific node types that are NOT executable actions —
// they have dedicated branches in the runtime engine (approval
// lifecycle, wait timers, condition evaluation, start/end markers,
// sub-flow invocation). Every other catalog code falls into the
// generic action dispatcher.
// Engine node types are the ones the engine state machine handles
// directly (lifecycle, wait timers, condition evaluation, start/end
// markers, sub-flow invocation). The `create_approval` and
// `approval` aliases preserve the simpler one-step "node pauses
// itself" approval semantics; the explicit two-step
// `CreateApproval` + `WaitForApproval` pattern is the canonical
// shape going forward.
//
// `CreateApproval` (canonical PascalCase from BUILT_IN_ACTIONS) is
// deliberately NOT in this set — it routes through the catalog
// dispatcher so it returns `{ approvalId }` to stepOutputs, which
// downstream `WaitForApproval` nodes bind to. The pause-until-resolved
// semantics are split into the explicit two-step pattern.
const ENGINE_NODE_TYPES: ReadonlySet<string> = new Set([
  'start',
  'end',
  'condition',
  'wait',
  'approval',
  'create_approval',
  'subflow',
]);

const SNAKE_CASE_ACTION_ALIASES: ReadonlyArray<string> = [
  'update_record',
  'create_record',
  'delete_record',
  'send_email',
  'send_notification',
  'set_field_value',
  'http_request',
  'make_decision',
  'lookup_record',
];

const ACTION_NODE_TYPES: ReadonlySet<string> = new Set([
  ...BUILT_IN_ACTIONS.map((a) => a.code).filter((code) => !ENGINE_NODE_TYPES.has(code)),
  ...SNAKE_CASE_ACTION_ALIASES,
]);
import {
  CreateWorkflowDefinitionRequest,
  UpdateWorkflowDefinitionRequest,
  WorkflowListQuery,
} from './workflow.types';
import { WorkflowAuditService } from './workflow-audit.service';

// Permissions that allow elevating a workflow's runAs to 'system'.
// 'system' execution bypasses the invoking user's authorization, so creators
// must hold an explicit privilege to assign it.
const SYSTEM_RUN_AS_PERMISSIONS = new Set(['system.admin', 'workflow.run-as-system']);

export interface TestRunStep {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  actionType: string | null;
  resolvedConfig: Record<string, unknown>;
  wouldExecute: string;
}

export interface TestRunResult {
  flowId: string;
  flowCode: string;
  mode: 'dry_run' | 'wet_run';
  steps: TestRunStep[];
  warning?: string;
  /** Set on wet-run only — the engine instance id created by the test. */
  instanceId?: string;
  /** Set on wet-run only — the instance's initial state. */
  instanceState?: string;
}

export interface WorkflowDefinitionActor {
  id?: string;
  isAdmin?: boolean;
  permissions?: string[];
  roles?: string[];
}

@Injectable()
export class WorkflowDefinitionService {
  constructor(
    @InjectRepository(ProcessFlowDefinition)
    private readonly definitionRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(ProcessFlowDefinitionRevision)
    private readonly revisionRepo: Repository<ProcessFlowDefinitionRevision>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditService: WorkflowAuditService,
    private readonly dataSource: DataSource,
    private readonly engine: ProcessFlowEngineService,
  ) {}

  /**
   * Plan §8.1.8 — flow test runner.
   *
   * Two modes:
   *
   *  - **dry-run** (default): walks the canvas locally without the
   *    engine. Each action's `actionConfig` is interpolated against
   *    the mock input and returned in the trace; no SQL writes, no
   *    automation triggers, no instance row. Useful for verifying a
   *    flow's binding shape without exercising side effects.
   *
   *  - **wet-run** (`dryRun: false`): provisions a real instance via
   *    the engine using the same path manual triggers use. The
   *    instance ID is returned alongside the trace so the canvas-side
   *    log can correlate with the engine's `processFlow.step_completed`
   *    events. Wet-run honors the flow's runAs setting AND the
   *    caller's `metadata.flows.edit` gate (controller-level), so a
   *    delegated flow editor cannot escalate by test-running a
   *    `runAs:'system'` flow they wouldn't otherwise be permitted to
   *    invoke. The actor's id is recorded as the workflow starter.
   */
  async testRun(
    id: string,
    options: { input: Record<string, unknown>; recordId?: string; dryRun: boolean },
    actor: WorkflowDefinitionActor | undefined,
  ): Promise<TestRunResult> {
    const definition = await this.getById(id);

    const nodes = definition.canvas?.nodes ?? [];
    const connections = definition.canvas?.connections ?? [];
    const startNode = nodes.find((n) => (n as { type?: string }).type === 'start') ?? nodes[0];

    if (!startNode) {
      return {
        flowId: id,
        flowCode: definition.code,
        mode: options.dryRun ? 'dry_run' : 'wet_run',
        steps: [],
        warning: 'Flow has no start node — nothing to simulate.',
      };
    }

    const trace = this.buildDryRunTrace(nodes, connections, startNode.id, options, actor);

    if (options.dryRun) {
      return {
        flowId: id,
        flowCode: definition.code,
        mode: 'dry_run',
        steps: trace,
      };
    }

    // Wet run — refuse to dispatch a flow that isn't in a runnable
    // state. Without this the engine would emit a clear error from
    // its own status gate, but failing fast at the test runner
    // surface gives a better author-side message.
    if (!definition.isActive || definition.status !== 'published') {
      return {
        flowId: id,
        flowCode: definition.code,
        mode: 'wet_run',
        steps: trace,
        warning: `Cannot wet-run: flow is ${definition.status}${definition.isActive ? '' : ', inactive'}. Publish + activate before running with real side effects.`,
      };
    }

    const instance = await this.engine.startProcessFlow(
      definition.code,
      options.input,
      actor?.id,
      options.recordId,
    );

    return {
      flowId: id,
      flowCode: definition.code,
      mode: 'wet_run',
      steps: trace,
      instanceId: instance.id,
      instanceState: instance.state,
    };
  }

  private buildDryRunTrace(
    nodes: ProcessFlowDefinition['canvas']['nodes'],
    connections: ProcessFlowDefinition['canvas']['connections'],
    startNodeId: string,
    options: { input: Record<string, unknown>; recordId?: string; dryRun: boolean },
    actor: WorkflowDefinitionActor | undefined,
  ): TestRunStep[] {
    // Plan §8.1.4 — dry-run scope must mirror the engine's
    // ProcessFlowContext shape so picker-authored bindings resolve
    // to the same values in test as in real execution. Engine
    // injects: input, variables, stepOutputs, userId, triggeredBy,
    // trigger (alias of input), user (`{id, email, username}`),
    // system (`{now, today, instanceCode}`). The dry-run trace
    // doesn't have step outputs (we never execute actions), but it
    // CAN seed the rest from the mock input + the platform env.
    //
    // The actor identity (caller's user id) flows through both
    // dry-run and wet-run identically — wet-run passes `actor?.id`
    // into `engine.startProcessFlow`, and dry-run seeds the same id
    // into `userId` / `triggeredBy` / `user.id`. A flow that binds
    // `{{user.id}}` resolves to the SAME value in both modes for
    // the same caller.
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const callerId = actor?.id ?? 'test-user';
    const dryRunScope: Record<string, unknown> = {
      input: options.input,
      // `record` mirrors `input` so authored flows can bind
      // `{{record.x}}` consistently with the record-scoped event
      // shape exposed by the runtime context.
      record: options.input,
      variables: {},
      stepOutputs: {},
      userId: callerId,
      triggeredBy: callerId,
      trigger: options.input,
      user: { id: callerId, email: undefined, username: undefined },
      system: {
        now: now.toISOString(),
        today: today.toISOString().slice(0, 10),
        instanceCode: process.env.INSTANCE_CODE ?? 'default',
      },
    };

    const trace: TestRunStep[] = [];
    const visited = new Set<string>();
    let cursor: string | undefined = startNodeId;
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor);
      const node = nodes.find((n) => n.id === cursor);
      if (!node) break;
      const nodeType = (node as { type?: string }).type ?? 'unknown';
      const interpolated = this.interpolateNodeConfig(node.config ?? {}, dryRunScope);
      trace.push({
        nodeId: node.id,
        nodeName: node.name ?? '',
        nodeType,
        actionType: ((node.config as { actionType?: string } | undefined)?.actionType) ?? null,
        resolvedConfig: interpolated,
        wouldExecute: options.dryRun ? 'simulated (no DB writes)' : 'dispatched via engine',
      });
      const nextEdge = connections.find((c) => c.fromNode === cursor);
      cursor = nextEdge?.toNode;
    }
    return trace;
  }

  /**
   * Recursive interpolation for the trace runner. Distinct from the
   * engine's `interpolateObject` (which lives in `libs/automation`)
   * — duplicated minimally here so the test runner doesn't need the
   * full engine import surface. Bindings: `{{path.to.value}}` resolves
   * against the supplied scope; everything else passes through.
   */
  private interpolateNodeConfig(
    config: Record<string, unknown>,
    scope: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.interpolateAny(config, scope) as Record<string, unknown>;
  }

  private interpolateAny(value: unknown, scope: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      return value.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
        const resolved = this.resolvePath(scope, path);
        if (resolved === undefined || resolved === null) return `{{${path}}}`;
        return typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
      });
    }
    if (Array.isArray(value)) return value.map((v) => this.interpolateAny(v, scope));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = this.interpolateAny(v, scope);
      return out;
    }
    return value;
  }

  private resolvePath(scope: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = scope;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  async list(query: WorkflowListQuery) {
    const qb = this.definitionRepo.createQueryBuilder('definition');
    if (query.collectionId) {
      qb.andWhere('definition.collectionId = :collectionId', { collectionId: query.collectionId });
    }
    if (query.code) {
      qb.andWhere('definition.code = :code', { code: query.code });
    }
    if (query.active !== undefined) {
      qb.andWhere('definition.isActive = :active', { active: query.active });
    }
    qb.orderBy('definition.updatedAt', 'DESC');
    return qb.getMany();
  }

  async getById(id: string) {
    const definition = await this.definitionRepo.findOne({ where: { id } });
    if (!definition) {
      throw new NotFoundException('Workflow definition not found');
    }
    return definition;
  }

  async create(request: CreateWorkflowDefinitionRequest, actor?: WorkflowDefinitionActor | string) {
    const actorObj = this.normalizeActor(actor);
    if (!request.code || !this.isValidCode(request.code)) {
      throw new BadRequestException('workflow.code must be lowercase letters, numbers, or underscore');
    }
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('workflow.name is required');
    }

    const existing = await this.definitionRepo.findOne({ where: { code: request.code } });
    if (existing) {
      throw new ConflictException('Workflow code already exists');
    }

    await this.validateCanvasApprovers(request.canvas);
    this.assertNodeCountWithinLimit(request.canvas);
    const resolvedRunAs = this.resolveRunAs(request.runAs, actorObj);

    const applicationId = await this.resolveApplicationId(request.collectionId);

    const definition = this.definitionRepo.create({
      code: request.code,
      name: request.name.trim(),
      description: request.description?.trim() || undefined,
      collectionId: request.collectionId || undefined,
      applicationId,
      triggerType: request.triggerType || 'manual',
      triggerConditions: request.triggerConditions || undefined,
      triggerSchedule: request.triggerSchedule || undefined,
      triggerFilter: request.triggerFilter || undefined,
      runAs: resolvedRunAs,
      timeoutMinutes: request.timeoutMinutes ?? 60,
      maxRetries: request.maxRetries ?? 3,
      canvas: this.normalizeCanvas(request.canvas),
      version: 1,
      isActive: false,
      status: 'draft',
      createdBy: actorObj.id || undefined,
      updatedBy: actorObj.id || undefined,
    } as Partial<ProcessFlowDefinition>);

    const saved = await this.definitionRepo.save(definition);

    // Seed revision 1 (draft) so currentRevisionId is non-null from creation.
    const savedRevision = await this.revisionRepo.save(
      this.revisionRepo.create({
        processFlowId: saved.id,
        revision: 1,
        status: 'draft',
        payload: this.snapshot(saved),
        createdBy: actorObj.id ?? null,
      }),
    );
    saved.currentRevisionId = savedRevision.id;
    await this.definitionRepo.save(saved);

    await this.auditService.record({
      actorId: actorObj.id,
      action: 'workflow.create',
      recordId: saved.id,
      newValues: this.auditValues(saved),
    });
    return saved;
  }

  async update(id: string, request: UpdateWorkflowDefinitionRequest, actor?: WorkflowDefinitionActor | string) {
    const actorObj = this.normalizeActor(actor);
    const definition = await this.getById(id);

    if (request.name !== undefined && request.name.trim().length === 0) {
      throw new BadRequestException('workflow.name is required');
    }

    if (request.canvas) {
      await this.validateCanvasApprovers(request.canvas);
      this.assertNodeCountWithinLimit(request.canvas);
    }

    const previous = this.auditValues(definition);

    definition.name = request.name?.trim() ?? definition.name;
    definition.description = request.description?.trim() || undefined;
    definition.collectionId = request.collectionId ?? definition.collectionId;
    definition.triggerType = request.triggerType ?? definition.triggerType;
    definition.triggerConditions = request.triggerConditions ?? definition.triggerConditions;
    definition.triggerSchedule = request.triggerSchedule ?? definition.triggerSchedule;
    definition.triggerFilter = request.triggerFilter ?? definition.triggerFilter;
    if (request.runAs !== undefined) {
      definition.runAs = this.resolveRunAs(request.runAs, actorObj);
    }
    definition.timeoutMinutes = request.timeoutMinutes ?? definition.timeoutMinutes;
    definition.maxRetries = request.maxRetries ?? definition.maxRetries;
    if (request.canvas) {
      definition.canvas = this.normalizeCanvas(request.canvas);
    }
    definition.version = definition.version + 1;
    definition.updatedBy = actorObj.id || undefined;

    // Per ADR-5 every edit returns the parent to draft and appends a
    // new draft revision. Publishing the new revision flips both back.
    definition.status = 'draft';
    // Runtime lookup is `code + isActive` only — leaving isActive=true
    // here would let the engine execute the unreviewed draft canvas
    // on the next matching event. Force operators to re-publish AND
    // re-activate so a new pair of permission checks gates the change.
    definition.isActive = false;

    const saved = await this.definitionRepo.save(definition);

    const nextRev = await this.nextRevisionNumber(saved.id);
    const savedRevision = await this.revisionRepo.save(
      this.revisionRepo.create({
        processFlowId: saved.id,
        revision: nextRev,
        status: 'draft',
        payload: this.snapshot(saved),
        createdBy: actorObj.id ?? null,
      }),
    );
    saved.currentRevisionId = savedRevision.id;
    await this.definitionRepo.save(saved);

    await this.auditService.record({
      actorId: actorObj.id,
      action: 'workflow.update',
      recordId: saved.id,
      oldValues: previous,
      newValues: this.auditValues(saved),
    });
    return saved;
  }

  /**
   * Publish the current draft revision of a workflow. Sets the revision
   * status to `published`, stamps publishedBy/publishedAt, and bumps
   * the parent ProcessFlowDefinition to `published`.
   *
   * Note: lifecycle status is orthogonal to operational `is_active`.
   * Publishing a flow does NOT auto-activate it; a separate `activate`
   * call is required for runtime triggers to fire.
   */
  async publish(id: string, actorId?: string) {
    const definition = await this.getById(id);
    const previous = this.auditValues(definition);

    if (!definition.currentRevisionId) {
      throw new NotFoundException(
        `Workflow ${id} has no current revision to publish`,
      );
    }
    const revision = await this.revisionRepo.findOne({
      where: { id: definition.currentRevisionId },
    });
    if (!revision) {
      throw new NotFoundException(
        `Current revision ${definition.currentRevisionId} missing`,
      );
    }

    if (revision.status !== 'published') {
      revision.status = 'published';
      revision.publishedBy = actorId ?? null;
      revision.publishedAt = new Date();
      await this.revisionRepo.save(revision);
    }

    if (definition.status !== 'published') {
      definition.status = 'published';
      definition.publishedAt = new Date();
      definition.updatedBy = actorId || undefined;
      await this.definitionRepo.save(definition);
    }

    await this.auditService.record({
      actorId,
      action: 'workflow.publish',
      recordId: definition.id,
      oldValues: previous,
      newValues: this.auditValues(definition),
    });
    return definition;
  }

  /** Soft-deprecate a workflow definition. */
  async deprecate(id: string, actorId?: string) {
    const definition = await this.getById(id);
    const previous = this.auditValues(definition);
    definition.status = 'deprecated';
    // Deprecation is end-of-life; the runtime must stop matching this
    // flow even if a prior activate() left isActive=true.
    definition.isActive = false;
    definition.updatedBy = actorId || undefined;
    const saved = await this.definitionRepo.save(definition);
    await this.auditService.record({
      actorId,
      action: 'workflow.deprecate',
      recordId: saved.id,
      oldValues: previous,
      newValues: this.auditValues(saved),
    });
    return saved;
  }

  /** List revisions for a workflow definition, newest first. */
  listRevisions(id: string) {
    return this.revisionRepo.find({
      where: { processFlowId: id },
      order: { revision: 'DESC' },
    });
  }

  async delete(id: string, actorId?: string) {
    const definition = await this.getById(id);
    if (definition.isActive) {
      throw new ConflictException('Active workflow definitions must be deactivated before delete');
    }

    await this.definitionRepo.delete(id);
    await this.auditService.record({
      actorId,
      action: 'workflow.delete',
      recordId: definition.id,
      oldValues: this.auditValues(definition),
    });

    return { id: definition.id, deleted: true };
  }

  async activate(id: string, actorId?: string) {
    const definition = await this.getById(id);
    // Activation puts a flow into the runtime trigger pool. Only published
    // revisions have passed publish-time validation (canvas wiring,
    // approver existence, action contracts). Allowing draft activation
    // would let a malformed flow fire on the first matching record event.
    if (definition.status !== 'published') {
      throw new BadRequestException(
        `Process Flow ${definition.code} is in status "${definition.status}". Publish before activating.`,
      );
    }
    if (!definition.isActive) {
      const previous = this.auditValues(definition);
      definition.isActive = true;
      definition.updatedBy = actorId || undefined;
      const saved = await this.definitionRepo.save(definition);
      await this.auditService.record({
        actorId,
        action: 'workflow.activate',
        recordId: saved.id,
        oldValues: previous,
        newValues: this.auditValues(saved),
      });
      return saved;
    }
    return definition;
  }

  async deactivate(id: string, actorId?: string) {
    const definition = await this.getById(id);
    if (definition.isActive) {
      const previous = this.auditValues(definition);
      definition.isActive = false;
      definition.updatedBy = actorId || undefined;
      const saved = await this.definitionRepo.save(definition);
      await this.auditService.record({
        actorId,
        action: 'workflow.deactivate',
        recordId: saved.id,
        oldValues: previous,
        newValues: this.auditValues(saved),
      });
      return saved;
    }
    return definition;
  }

  async duplicate(id: string, newCode: string, actor?: WorkflowDefinitionActor | string) {
    const actorObj = this.normalizeActor(actor);
    if (!newCode || !this.isValidCode(newCode)) {
      throw new BadRequestException('workflow.code must be lowercase letters, numbers, or underscore');
    }

    const source = await this.getById(id);
    const existing = await this.definitionRepo.findOne({ where: { code: newCode } });
    if (existing) {
      throw new ConflictException('Workflow code already exists');
    }

    // Duplicating preserves the source's runAs only if the actor is allowed to set it.
    const sourceRunAs: ProcessFlowRunAs = source.runAs;
    const resolvedRunAs =
      sourceRunAs === 'system' && !this.actorCanRunAsSystem(actorObj) ? 'triggering_user' : sourceRunAs;

    const copy = this.definitionRepo.create({
      code: newCode,
      name: `${source.name} Copy`,
      description: source.description,
      collectionId: source.collectionId,
      applicationId: source.applicationId,
      triggerType: source.triggerType,
      triggerConditions: source.triggerConditions,
      triggerSchedule: source.triggerSchedule,
      triggerFilter: source.triggerFilter,
      runAs: resolvedRunAs,
      timeoutMinutes: source.timeoutMinutes,
      maxRetries: source.maxRetries,
      canvas: source.canvas,
      version: 1,
      isActive: false,
      status: 'draft',
      createdBy: actorObj.id || undefined,
      updatedBy: actorObj.id || undefined,
    } as Partial<ProcessFlowDefinition>);

    const saved = await this.definitionRepo.save(copy);

    // Seed revision 1 (draft) for the duplicated workflow as well.
    const savedRevision = await this.revisionRepo.save(
      this.revisionRepo.create({
        processFlowId: saved.id,
        revision: 1,
        status: 'draft',
        payload: this.snapshot(saved),
        createdBy: actorObj.id ?? null,
      }),
    );
    saved.currentRevisionId = savedRevision.id;
    await this.definitionRepo.save(saved);

    await this.auditService.record({
      actorId: actorObj.id,
      action: 'workflow.duplicate',
      recordId: saved.id,
      newValues: this.auditValues(saved),
    });

    return saved;
  }

  /**
   * Resolve the Application a workflow should belong to. When bound to
   * a collection, inherit that collection's applicationId; otherwise
   * fall back to the `default` Application created in Slice A.
   */
  private async resolveApplicationId(collectionId?: string | null): Promise<string> {
    if (collectionId) {
      const result: Array<{ application_id: string | null }> = await this.dataSource.query(
        `SELECT application_id FROM collection_definitions WHERE id = $1 LIMIT 1`,
        [collectionId],
      );
      const fromCollection = result[0]?.application_id;
      if (fromCollection) {
        return fromCollection;
      }
    }
    const fallback: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM applications WHERE code = 'default' LIMIT 1`,
    );
    if (fallback.length === 0) {
      throw new NotFoundException(
        'Default Application missing — applications-registry migration must run first.',
      );
    }
    return fallback[0].id;
  }

  /** Authoring snapshot persisted on every ProcessFlowDefinitionRevision row. */
  private snapshot(d: ProcessFlowDefinition): Record<string, unknown> {
    return {
      name: d.name,
      code: d.code,
      description: d.description,
      collectionId: d.collectionId,
      applicationId: d.applicationId,
      version: d.version,
      isActive: d.isActive,
      canvas: d.canvas,
      triggerType: d.triggerType,
      triggerConditions: d.triggerConditions,
      triggerSchedule: d.triggerSchedule,
      triggerFilter: d.triggerFilter,
      runAs: d.runAs,
      timeoutMinutes: d.timeoutMinutes,
      maxRetries: d.maxRetries,
    };
  }

  private async nextRevisionNumber(processFlowId: string): Promise<number> {
    const result: Array<{ max: number | string | null }> = await this.revisionRepo
      .createQueryBuilder('rev')
      .select('MAX(rev.revision)', 'max')
      .where('rev.process_flow_id = :processFlowId', { processFlowId })
      .getRawMany();
    const current = Number(result[0]?.max ?? 0);
    return Number.isFinite(current) ? current + 1 : 1;
  }

  private normalizeActor(actor?: WorkflowDefinitionActor | string): WorkflowDefinitionActor {
    if (!actor) {
      return {};
    }
    if (typeof actor === 'string') {
      return { id: actor };
    }
    return actor;
  }

  private actorCanRunAsSystem(actor: WorkflowDefinitionActor): boolean {
    if (actor.isAdmin) {
      return true;
    }
    if (actor.roles?.includes('admin')) {
      return true;
    }
    if (!actor.permissions) {
      return false;
    }
    return actor.permissions.some((perm) => SYSTEM_RUN_AS_PERMISSIONS.has(perm));
  }

  private resolveRunAs(
    requested: ProcessFlowRunAs | undefined,
    actor: WorkflowDefinitionActor,
  ): ProcessFlowRunAs {
    // Default execution context is the user who triggered the workflow.
    // Promoting to 'system' bypasses invoker authorization, so it is gated by
    // an explicit permission held by the workflow's creator.
    if (!requested) {
      return 'triggering_user';
    }
    if (requested === 'system' && !this.actorCanRunAsSystem(actor)) {
      throw new ForbiddenException(
        "Setting runAs='system' requires the 'system.admin' or 'workflow.run-as-system' permission",
      );
    }
    return requested;
  }

  /**
   * Plan §8.1.7 — guardrail on the number of nodes per flow. Authors
   * past this point lose the visual canvas (it stops being readable)
   * and the engine's recursion-prevention guard becomes the only thing
   * standing between a runaway flow and a runaway worker queue. Default
   * 50; configurable via `FLOW_MAX_NODES` env var.
   */
  private readonly defaultMaxNodes = 50;

  private assertNodeCountWithinLimit(
    canvas: ProcessFlowDefinition['canvas'] | undefined,
  ): void {
    const limit = this.resolveMaxNodes();
    const count = canvas?.nodes?.length ?? 0;
    if (count > limit) {
      throw new BadRequestException(
        `Process Flow has ${count} nodes; the per-flow limit is ${limit}. Split into sub-flows or raise FLOW_MAX_NODES.`,
      );
    }
  }

  private resolveMaxNodes(): number {
    const raw = process.env.FLOW_MAX_NODES;
    if (!raw) return this.defaultMaxNodes;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return this.defaultMaxNodes;
    return Math.floor(parsed);
  }

  /**
   * Authoring soft-warning threshold (75% of FLOW_MAX_NODES, plan §8.1.7
   * specifies "admin warning at 40" with a default cap of 50). Surfaced
   * by the publish-preview endpoint so the editor can show a banner
   * before the hard limit fires.
   */
  warnNodeCountBand(count: number): { warn: boolean; limit: number; threshold: number } {
    const limit = this.resolveMaxNodes();
    const threshold = Math.floor(limit * 0.8);
    return { warn: count >= threshold, limit, threshold };
  }

  private async validateCanvasApprovers(
    canvas: ProcessFlowDefinition['canvas'] | undefined,
  ): Promise<void> {
    if (!canvas?.nodes?.length) {
      return;
    }
    const approverIds = new Set<string>();
    for (const node of canvas.nodes) {
      if (!node || typeof node !== 'object') continue;
      const nodeType = (node as ProcessFlowDefinition['canvas']['nodes'][number]).type as string;
      if (nodeType !== 'create_approval' && nodeType !== 'approval') continue;
      const approvers = this.parseApprovers(node.config?.approvers);
      for (const id of approvers) {
        approverIds.add(id);
      }
    }
    if (approverIds.size === 0) {
      return;
    }
    const ids = Array.from(approverIds);
    const users = await this.userRepo.find({
      where: ids.map((id) => ({ id })),
      select: ['id', 'status', 'deletedAt'],
    });
    const activeIds = new Set(
      users.filter((u) => u.status === 'active' && !u.deletedAt).map((u) => u.id),
    );
    const missing = ids.filter((id) => !activeIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown or inactive approver(s): ${missing.join(', ')}`);
    }
  }

  private isValidCode(code: string): boolean {
    return /^[a-z0-9_]+$/.test(code) && code.length <= 120;
  }

  private normalizeCanvas(
    canvas: ProcessFlowDefinition['canvas'] | undefined
  ): ProcessFlowDefinition['canvas'] {
    if (!canvas) {
      return { nodes: [], connections: [] };
    }

    const nodes = (canvas.nodes || []).map((node) => {
      if (!node || typeof node !== 'object') {
        return node;
      }

      const nodeType = (node as ProcessFlowDefinition['canvas']['nodes'][number]).type as string;
      // Any catalog-typed node (legacy snake_case OR canonical
      // PascalCase from BUILT_IN_ACTIONS) is wrapped into an action
      // node so the engine dispatches it through WorkflowActionService.
      // Without this branch the engine's default switch logs a
      // warning and silently skips the node — flow stalls without
      // an error trail.
      if (ACTION_NODE_TYPES.has(nodeType)) {
        return {
          ...node,
          type: 'action',
          config: {
            actionType: nodeType,
            actionConfig: node.config || {},
          },
        };
      }

      if (nodeType === 'create_approval') {
        const approvers = this.parseApprovers(node.config?.approvers);
        const approvalType = node.config?.approvalType || 'sequential';
        const dueDays = Number(node.config?.dueDays || 0);
        const timeoutMinutes = Number.isFinite(dueDays) && dueDays > 0 ? dueDays * 24 * 60 : undefined;
        return {
          ...node,
          type: 'approval',
          config: {
            ...node.config,
            approvers,
            approvalType,
            timeoutMinutes,
          },
        };
      }

      if (nodeType === 'wait') {
        const waitType = node.config?.waitType || 'duration';
        const durationValue = Number(node.config?.durationValue || node.config?.duration || 0);
        const durationUnit = node.config?.durationUnit || 'minutes';
        return {
          ...node,
          config: {
            ...node.config,
            waitType,
            duration: durationValue,
            durationUnit,
          },
        };
      }

      return node;
    });

    const connections = (canvas.connections || []).map((conn, index) => {
      if (!conn || typeof conn !== 'object') return conn;
      // The visual designer historically wrote { from, to } but the
      // runtime engine (process-flow-engine.findNextNode) and the
      // canonical ProcessFlowConnection contract use { fromNode, toNode }.
      // Translate at the wire boundary so authored flows can advance
      // past Start.
      const c = conn as Partial<ProcessFlowConnection> & { from?: string; to?: string };
      const fromNode = c.fromNode ?? c.from;
      const toNode = c.toNode ?? c.to;
      return {
        ...conn,
        id: c.id ?? `conn_${index}_${fromNode}_${toNode}`,
        fromNode,
        toNode,
      } as ProcessFlowConnection;
    });

    return {
      nodes,
      connections,
    } as ProcessFlowDefinition['canvas'];
  }

  private parseApprovers(value: unknown): string[] {
    let entries: string[] = [];
    if (Array.isArray(value)) {
      entries = value.map((entry) => String(entry).trim()).filter(Boolean);
    } else if (typeof value === 'string') {
      entries = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    // Dedupe — duplicate approverIds in canvas configuration would create
    // redundant Approval rows with conflicting sequence numbers at runtime.
    return Array.from(new Set(entries));
  }

  private auditValues(definition: ProcessFlowDefinition) {
    return {
      id: definition.id,
      code: definition.code,
      name: definition.name,
      description: definition.description,
      collectionId: definition.collectionId,
      triggerType: definition.triggerType,
      triggerSchedule: definition.triggerSchedule,
      isActive: definition.isActive,
      version: definition.version,
    };
  }
}
