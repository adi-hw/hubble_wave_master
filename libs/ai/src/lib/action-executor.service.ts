import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AVAAction, AVAContext } from './ava.service';
import { AVAGovernanceService, PermissionCheckResult, AuditEntry } from './ava-governance.service';
import { AVAAuditTrail, AVAActionStatus, CollectionDefinition } from '@hubblewave/instance-db';
import { AuthorizationService } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';

/**
 * Action types the executor knows how to dispatch. Any action.type not in this
 * set is rejected before authorization is even attempted. Keep this in lock-step
 * with the switch statement in execute().
 */
const KNOWN_ACTION_TYPES: ReadonlySet<AVAAction['type']> = new Set([
  'navigate',
  'create',
  'update',
  'execute',
]);

/**
 * Stable JSON stringification: sorts object keys recursively so semantically
 * identical params hash to the same digest regardless of property order.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => stableStringify(item)).join(',') + ']';
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        JSON.stringify(key) + ':' + stableStringify((value as Record<string, unknown>)[key]),
    );
  return '{' + entries.join(',') + '}';
}

function hashParams(params: unknown): string {
  return createHash('sha256').update(stableStringify(params ?? {})).digest('hex');
}

/**
 * Action Executor Service
 * Executes platform actions on behalf of AVA with proper authorization
 * Integrates with AVAGovernanceService for permission checks and auditing
 */

export interface ActionRequest {
  action: AVAAction;
  context: AVAContext;
  previewId?: string;
  confirmationRequired?: boolean;
  reason?: string;
  userMessage?: string;
  avaResponse?: string;
  conversationId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestContext?: RequestContext;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  redirectUrl?: string;
  error?: string;
  auditId?: string;
  requiresConfirmation?: boolean;
}

export interface ActionPermission {
  actionType: string;
  collection?: string;
  roles: string[];
  requiresConfirmation: boolean;
}

@Injectable()
export class ActionExecutorService {
  private readonly logger = new Logger(ActionExecutorService.name);

  // Fallback permissions when database config not available
  private readonly fallbackPermissions: ActionPermission[] = [
    { actionType: 'navigate', roles: ['*'], requiresConfirmation: false },
    { actionType: 'create', collection: 'incidents', roles: ['user', 'admin', 'itil_admin'], requiresConfirmation: false },
    { actionType: 'create', collection: 'requests', roles: ['user', 'admin'], requiresConfirmation: false },
    { actionType: 'update', collection: 'incidents', roles: ['user', 'admin', 'itil_admin'], requiresConfirmation: true },
    { actionType: 'update', collection: 'requests', roles: ['user', 'admin'], requiresConfirmation: true },
    { actionType: 'execute', roles: ['admin', 'itil_admin'], requiresConfirmation: true },
  ];

  constructor(
    private eventEmitter: EventEmitter2,
    private governanceService: AVAGovernanceService,
    private authorizationService: AuthorizationService
  ) {}

  /**
   * Check if an action can be executed by the user (uses governance service)
   */
  async canExecuteWithGovernance(
    dataSource: DataSource,
    action: AVAAction,
    context: AVAContext
  ): Promise<PermissionCheckResult> {
    return this.governanceService.checkPermission(dataSource, action, context);
  }

  /**
   * Simple permission check (fallback when no dataSource)
   * SECURITY: This is a fallback method - prefer canExecuteWithGovernance when dataSource is available
   */
  canExecute(action: AVAAction, context: AVAContext): boolean {
    // SECURITY: Require valid context with userId
    if (!context || !context.userId) {
      this.logger.warn('canExecute denied: missing userId in context');
      return false;
    }

    // SECURITY: Validate action type is known
    if (!KNOWN_ACTION_TYPES.has(action.type)) {
      this.logger.warn(`canExecute denied: unknown action type ${action.type}`);
      return false;
    }

    const permission = this.findPermission(action);

    if (!permission) {
      // SECURITY: Default to DENY if no matching permission found
      this.logger.debug(`canExecute denied: no permission found for ${action.type} -> ${action.target}`);
      return false;
    }

    // SECURITY: Only allow wildcard roles for safe actions (navigate)
    if (permission.roles.includes('*')) {
      if (action.type !== 'navigate') {
        this.logger.warn(`canExecute denied: wildcard role not allowed for ${action.type}`);
        return false;
      }
      return true;
    }

    // Check if user's role is in the allowed roles list
    const userRole = context.userRole || 'user';
    const allowed = permission.roles.includes(userRole);

    if (!allowed) {
      this.logger.debug(`canExecute denied: role ${userRole} not in ${permission.roles.join(', ')}`);
    }

    return allowed;
  }

  /**
   * Check if action requires confirmation (fallback)
   */
  requiresConfirmation(action: AVAAction): boolean {
    const permission = this.findPermission(action);
    return permission?.requiresConfirmation ?? true;
  }

  /**
   * Execute an action with full governance integration
   */
  async execute(
    dataSource: DataSource,
    request: ActionRequest
  ): Promise<ActionResult> {
    const { action, context } = request;
    const startTime = Date.now();

    // Reject any action.type the executor does not explicitly dispatch. This
    // hardens against forged actions whose type is not handled by the switch
    // below; the dispatch table itself is never echoed back to the caller.
    if (!KNOWN_ACTION_TYPES.has(action.type)) {
      this.logger.warn(`execute denied: unknown action type ${action.type}`);
      return {
        success: false,
        message: 'Unknown action type.',
        error: 'UNKNOWN_ACTION',
      };
    }

    if (action.type !== 'navigate' && !request.previewId) {
      return {
        success: false,
        message: 'Preview is required before execution.',
        error: 'PREVIEW_REQUIRED',
      };
    }
    const authzResult = await this.checkAuthorization(dataSource, request);

    if (!authzResult.allowed) {
      await this.governanceService.recordAction(
        dataSource,
        this.createAuditEntry(request),
        'rejected' as AVAActionStatus
      );

      return {
        success: false,
        message: authzResult.reason || 'You do not have permission to perform this action.',
        error: 'PERMISSION_DENIED',
      };
    }

    // Check permission using governance service
    const permissionCheck = await this.governanceService.checkPermission(
      dataSource,
      action,
      context
    );

    if (!permissionCheck.allowed) {
      // Record rejected action to audit trail
      await this.governanceService.recordAction(
        dataSource,
        this.createAuditEntry(request),
        'rejected' as AVAActionStatus
      );

      return {
        success: false,
        message: permissionCheck.rejectionReason || 'You do not have permission to perform this action.',
        error: 'PERMISSION_DENIED',
      };
    }

    const auditRepo = dataSource.getRepository(AVAAuditTrail);
    let audit = null as AVAAuditTrail | null;

    // Confirmation gate: actions flagged as requiring confirmation MUST be
    // accompanied by a server-resolvable previewId. The client-provided
    // `confirmationRequired` flag is ignored — confirmation is proven by
    // the preview row's ownership + status + params hash matching the
    // submitted action below. Without a previewId, fail closed even if
    // the client claimed confirmation.
    if (permissionCheck.requiresConfirmation && !request.previewId) {
      return {
        success: false,
        message: 'This action requires preview approval before execution.',
        error: 'CONFIRMATION_REQUIRED',
        requiresConfirmation: true,
      };
    }

    if (request.previewId) {
      audit = await auditRepo.findOne({ where: { id: request.previewId } });
      if (!audit) {
        return {
          success: false,
          message: 'Preview not found.',
          error: 'PREVIEW_NOT_FOUND',
        };
      }
      if (audit.userId !== context.userId) {
        return {
          success: false,
          message: 'Preview does not belong to this user.',
          error: 'PREVIEW_ACCESS_DENIED',
        };
      }
      if (audit.status !== 'pending' && audit.status !== 'confirmed') {
        return {
          success: false,
          message: 'Preview is not in an executable state.',
          error: 'PREVIEW_INVALID_STATE',
        };
      }

      // Bind execution to the previewed action: the action.type, target, and
      // params at execute-time MUST match what was recorded on the preview.
      // Otherwise an attacker who obtains a previewId could swap params after
      // approval (e.g. change a target record id, escalate field values).
      const previewType = audit.actionType;
      const previewTarget = audit.actionTarget;
      const expectedParamsHash = hashParams(audit.actionParams);
      const submittedParamsHash = hashParams(action.params);

      if (
        previewType !== action.type ||
        previewTarget !== action.target ||
        expectedParamsHash !== submittedParamsHash
      ) {
        this.logger.warn(
          `execute denied: preview/action mismatch (preview=${audit.id}, expectedType=${previewType}, gotType=${action.type})`,
        );
        await this.governanceService.recordAction(
          dataSource,
          this.createAuditEntry(request),
          'rejected' as AVAActionStatus,
        );
        return {
          success: false,
          message: 'Action parameters do not match approved preview',
          error: 'PREVIEW_PARAMS_MISMATCH',
        };
      }

      if (permissionCheck.requiresConfirmation) {
        await this.governanceService.updateAuditStatus(
          dataSource,
          audit.id,
          'confirmed' as AVAActionStatus,
          {
            approvalPayload: {
              approvedBy: context.userId,
              approvedAt: new Date().toISOString(),
              reason: request.reason,
            },
          }
        );
      }
    } else {
      const auditEntry = this.createAuditEntry(request);
      audit = await this.governanceService.recordAction(
        dataSource,
        auditEntry,
        'pending' as AVAActionStatus
      );
    }

    this.logger.log(
      `Executing action: ${action.type} -> ${action.target} for user ${context.userId} (audit: ${audit.id})`
    );

    try {
      let result: ActionResult;

      switch (action.type) {
        case 'navigate':
          result = this.handleNavigate(action);
          break;

        case 'create':
          result = await this.handleCreate(dataSource, action, context);
          break;

        case 'update':
          result = await this.handleUpdate(dataSource, action, context);
          break;

        case 'execute':
          result = await this.handleExecute(dataSource, action, context);
          break;

        default:
          result = {
            success: false,
            message: `Unknown action type: ${action.type}`,
            error: 'UNKNOWN_ACTION',
          };
      }

      // Update audit with result
      const durationMs = Date.now() - startTime;
      await this.governanceService.updateAuditStatus(
        dataSource,
        audit.id,
        result.success ? 'completed' as AVAActionStatus : 'failed' as AVAActionStatus,
        {
          afterData: result.data,
          errorMessage: result.error,
          durationMs,
          executionPayload: {
            success: result.success,
            message: result.message,
            error: result.error,
            data: result.data,
            redirectUrl: result.redirectUrl,
            completedAt: new Date().toISOString(),
          },
        }
      );

      return { ...result, auditId: audit.id };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Update audit with failure
      await this.governanceService.updateAuditStatus(
        dataSource,
        audit.id,
        'failed' as AVAActionStatus,
        {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorCode: 'EXECUTION_ERROR',
          durationMs,
          executionPayload: {
            success: false,
            message: 'Execution failed',
            error: error instanceof Error ? error.message : 'EXECUTION_ERROR',
            completedAt: new Date().toISOString(),
          },
        }
      );

      this.logger.error(`Action execution failed: ${error}`);
      return {
        success: false,
        message: 'An error occurred while executing the action.',
        error: error instanceof Error ? error.message : 'EXECUTION_ERROR',
        auditId: audit.id,
      };
    }
  }

  /**
   * Create audit entry from action request
   */
  private createAuditEntry(request: ActionRequest): AuditEntry {
    const collection = this.extractCollection(request.action.target);
    const recordId = this.extractRecordId(request.action.target);

    return {
      userId: request.context.userId,
      userName: request.context.userName,
      userRole: request.context.userRole,
      conversationId: request.conversationId,
      userMessage: request.userMessage,
      avaResponse: request.avaResponse,
      action: request.action,
      suggestedActions: [request.action as unknown as Record<string, unknown>],
      targetCollection: collection || undefined,
      targetRecordId: recordId || undefined,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      sessionId: request.sessionId,
    };
  }

  private async checkAuthorization(
    dataSource: DataSource,
    request: ActionRequest,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const { action, requestContext } = request;

    if (action.type === 'create' || action.type === 'update') {
      if (!requestContext) {
        return { allowed: false, reason: 'Authorization context missing' };
      }

      const collection = this.extractCollection(action.target);
      if (!collection) {
        return { allowed: false, reason: 'Invalid action target' };
      }

      try {
        const collectionRepo = dataSource.getRepository(CollectionDefinition);
        const definition = await collectionRepo.findOne({
          where: [{ code: collection }, { tableName: collection }],
        });
        const target = definition?.tableName || collection;
        const operation = action.type === 'create' ? 'create' : 'update';
        await this.authorizationService.ensureTableAccess(requestContext, target, operation);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Authorization check failed';
        return { allowed: false, reason: message };
      }
    }

    return { allowed: true };
  }

  /**
   * Normalize and validate a target path before parsing. Rejects path traversal
   * attempts (`..`, `\\`, null bytes) and any string the URL parser refuses.
   * Returns the canonical pathname (no query, no fragment) starting with `/`.
   */
  private normalizeTarget(target: string): string | null {
    if (typeof target !== 'string' || target.length === 0) {
      return null;
    }
    if (
      target.includes('..') ||
      target.includes('\\') ||
      target.includes('\0')
    ) {
      return null;
    }
    try {
      const parsed = new URL(target, 'http://x/');
      const path = parsed.pathname;
      if (!path.startsWith('/') || path.includes('..')) {
        return null;
      }
      return path;
    } catch {
      return null;
    }
  }

  private extractCollection(target: string): string | null {
    const path = this.normalizeTarget(target);
    if (!path) return null;
    const match = path.match(/^\/([a-z_][a-z0-9_-]*)(?:\/.*)?$/i);
    return match?.[1] || null;
  }

  private extractRecordId(target: string): string | null {
    const path = this.normalizeTarget(target);
    if (!path) return null;
    const match = path.match(/^\/[a-z_][a-z0-9_-]*\/([a-z0-9_-]+)(?:\/.*)?$/i);
    if (!match) return null;
    return match[1] === 'new' ? null : match[1];
  }

  /**
   * Execute multiple actions in sequence
   */
  async executeSequence(
    dataSource: DataSource,
    requests: ActionRequest[]
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const request of requests) {
      const result = await this.execute(dataSource, request);
      results.push(result);

      // Stop on first failure if it's a critical action
      if (!result.success && request.action.type !== 'navigate') {
        break;
      }
    }

    return results;
  }

  /**
   * Get available actions for a context
   */
  getAvailableActions(context: AVAContext): AVAAction[] {
    const actions: AVAAction[] = [];

    // Navigation is always available
    actions.push({
      type: 'navigate',
      label: 'Go to Dashboard',
      target: '/dashboard',
    });

    // Role-based actions
    const role = context.userRole || 'user';

    if (['user', 'admin', 'itil_admin'].includes(role)) {
      actions.push({
        type: 'create',
        label: 'Create Incident',
        target: '/incidents/new',
      });
      actions.push({
        type: 'create',
        label: 'Submit Request',
        target: '/requests/new',
      });
    }

    if (['admin', 'itil_admin'].includes(role)) {
      actions.push({
        type: 'navigate',
        label: 'Admin Console',
        target: '/admin',
      });
    }

    return actions;
  }

  /**
   * Parse action intent from natural language
   */
  async parseActionIntent(
    message: string,
    _context: AVAContext
  ): Promise<AVAAction | null> {
    const lowerMessage = message.toLowerCase();

    // Create intent patterns
    const createPatterns = [
      { pattern: /create\s+(an?\s+)?incident/i, target: '/incidents/new', label: 'Create incident' },
      { pattern: /open\s+(an?\s+)?incident/i, target: '/incidents/new', label: 'Create incident' },
      { pattern: /submit\s+(an?\s+)?request/i, target: '/requests/new', label: 'Submit request' },
      { pattern: /create\s+(an?\s+)?request/i, target: '/requests/new', label: 'Submit request' },
      { pattern: /new\s+knowledge\s+article/i, target: '/knowledge/new', label: 'Create article' },
    ];

    for (const { pattern, target, label } of createPatterns) {
      if (pattern.test(lowerMessage)) {
        return { type: 'create', label, target };
      }
    }

    // Navigate intent patterns
    const navigatePatterns = [
      { pattern: /show\s+(me\s+)?(my\s+)?incidents/i, target: '/incidents?assigned=me', label: 'View my incidents' },
      { pattern: /go\s+to\s+dashboard/i, target: '/dashboard', label: 'Dashboard' },
      { pattern: /open\s+knowledge\s+base/i, target: '/knowledge', label: 'Knowledge base' },
      { pattern: /service\s+catalog/i, target: '/catalog', label: 'Service catalog' },
      { pattern: /admin\s+(panel|console|settings)/i, target: '/admin', label: 'Admin console' },
    ];

    for (const { pattern, target, label } of navigatePatterns) {
      if (pattern.test(lowerMessage)) {
        return { type: 'navigate', label, target };
      }
    }

    return null;
  }

  // Action handlers

  private handleNavigate(action: AVAAction): ActionResult {
    return {
      success: true,
      message: `Navigating to ${action.label}`,
      redirectUrl: action.target,
    };
  }

  private async handleCreate(
    _dataSource: DataSource,
    action: AVAAction,
    context: AVAContext
  ): Promise<ActionResult> {
    // Extract collection from target (e.g., /incidents/new -> incidents)
    const match = action.target.match(/\/(\w+)\/new/);
    const collection = match?.[1];

    if (!collection) {
      return {
        success: false,
        message: 'Invalid create action target.',
        error: 'INVALID_TARGET',
      };
    }

    // For create actions, we typically just navigate to the form
    // The actual creation happens through the regular API
    this.eventEmitter.emit('ava.action.create', {
      collection,
      context,
      params: action.params,
    });

    return {
      success: true,
      message: `Opening form to create new ${collection}`,
      redirectUrl: action.target,
      data: {
        prefillData: action.params,
      },
    };
  }

  private async handleUpdate(
    _dataSource: DataSource,
    action: AVAAction,
    context: AVAContext
  ): Promise<ActionResult> {
    // Extract collection and ID from target
    const match = action.target.match(/\/(\w+)\/([^/]+)/);
    const collection = match?.[1];
    const recordId = match?.[2];

    if (!collection || !recordId) {
      return {
        success: false,
        message: 'Invalid update action target.',
        error: 'INVALID_TARGET',
      };
    }

    // Emit event for the update
    this.eventEmitter.emit('ava.action.update', {
      collection,
      recordId,
      context,
      updates: action.params,
    });

    // Note: Actual update would go through the data service
    // This just signals the intent

    return {
      success: true,
      message: `Update queued for ${collection}/${recordId}`,
      data: {
        collection,
        recordId,
        updates: action.params,
      },
    };
  }

  private async handleExecute(
    _dataSource: DataSource,
    action: AVAAction,
    context: AVAContext
  ): Promise<ActionResult> {
    // Execute actions are for process flows, automations, etc.
    this.eventEmitter.emit('ava.action.execute', {
      target: action.target,
      context,
      params: action.params,
    });

    return {
      success: true,
      message: `Executing: ${action.label}`,
      data: action.params,
    };
  }

  private findPermission(action: AVAAction): ActionPermission | undefined {
    return this.fallbackPermissions.find((p) => {
      if (p.actionType !== action.type) return false;

      if (p.collection) {
        // Check if action target contains the collection
        return action.target.includes(`/${p.collection}`);
      }

      return true;
    });
  }

  /**
   * Revert an action by audit ID
   */
  async revertAction(
    dataSource: DataSource,
    auditId: string,
    revertedBy: string,
    reason?: string
  ): Promise<ActionResult> {
    const result = await this.governanceService.revertAction(
      dataSource,
      auditId,
      revertedBy,
      reason
    );

    return {
      success: result.success,
      message: result.message,
      data: result.revertedData,
    };
  }

  /**
   * Get user's audit trail
   */
  async getUserAuditTrail(dataSource: DataSource, userId: string, limit = 20) {
    return this.governanceService.getUserAuditTrail(dataSource, userId, limit);
  }

  /**
   * Get revertible actions for a user
   */
  async getRevertibleActions(dataSource: DataSource, userId?: string, limit = 20) {
    return this.governanceService.getRevertibleActions(dataSource, { userId, limit });
  }
}
