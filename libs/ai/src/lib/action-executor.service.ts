import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AVAAction, AVAContext } from './ava.service';
import { AVAGovernanceService, PermissionCheckResult, AuditEntry } from './ava-governance.service';
import { AVAActionStatus } from '@eam-platform/tenant-db';

/**
 * Action Executor Service
 * Executes platform actions on behalf of AVA with proper authorization
 * Integrates with AVAGovernanceService for permission checks and auditing
 */

export interface ActionRequest {
  action: AVAAction;
  context: AVAContext;
  confirmationRequired?: boolean;
  reason?: string;
  userMessage?: string;
  avaResponse?: string;
  conversationId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
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
    private governanceService: AVAGovernanceService
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
   */
  canExecute(action: AVAAction, context: AVAContext): boolean {
    const permission = this.findPermission(action);

    if (!permission) {
      return false;
    }

    // Check role
    if (permission.roles.includes('*')) {
      return true;
    }

    return permission.roles.includes(context.userRole || 'user');
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

    // If confirmation required but not confirmed, return early
    if (permissionCheck.requiresConfirmation && !request.confirmationRequired) {
      return {
        success: false,
        message: 'This action requires confirmation before execution.',
        error: 'CONFIRMATION_REQUIRED',
        requiresConfirmation: true,
      };
    }

    // Record action as pending
    const auditEntry = this.createAuditEntry(request);
    const audit = await this.governanceService.recordAction(
      dataSource,
      auditEntry,
      'pending' as AVAActionStatus
    );

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
      targetCollection: collection || undefined,
      targetRecordId: recordId || undefined,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      sessionId: request.sessionId,
    };
  }

  private extractCollection(target: string): string | null {
    const match = target.match(/^\/?([a-z_-]+)/i);
    return match?.[1] || null;
  }

  private extractRecordId(target: string): string | null {
    const match = target.match(/^\/?[a-z_-]+\/([a-z0-9-]+)/i);
    return match?.[1] === 'new' ? null : match?.[1] || null;
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
    // Execute actions are for workflows, automations, etc.
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
