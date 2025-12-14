import { Injectable, Logger } from '@nestjs/common';
import { DataSource, MoreThan, LessThan, And, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AVAAuditTrail,
  AVAPermissionConfig,
  AVAGlobalSettings,
  AVAActionType,
  AVAActionStatus,
} from '@eam-platform/tenant-db';
import { AVAAction, AVAContext } from './ava.service';

/**
 * AVA Governance Service
 * Manages auditing, permissions, and revert capabilities for all AVA actions
 */

export interface PermissionCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  rejectionReason?: string;
  permissionRuleId?: string;
}

export interface AuditEntry {
  userId: string;
  userName?: string;
  userRole?: string;
  conversationId?: string;
  userMessage?: string;
  avaResponse?: string;
  action: AVAAction;
  targetCollection?: string;
  targetRecordId?: string;
  targetDisplayValue?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface RevertResult {
  success: boolean;
  message: string;
  revertedData?: Record<string, unknown>;
}

export interface AuditQueryOptions {
  userId?: string;
  actionType?: AVAActionType;
  status?: AVAActionStatus;
  targetCollection?: string;
  fromDate?: Date;
  toDate?: Date;
  isRevertible?: boolean;
  limit?: number;
  offset?: number;
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

@Injectable()
export class AVAGovernanceService {
  private readonly logger = new Logger(AVAGovernanceService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * Check if an action is permitted based on governance rules
   */
  async checkPermission(
    dataSource: DataSource,
    action: AVAAction,
    context: AVAContext
  ): Promise<PermissionCheckResult> {
    try {
      // Get global settings
      const globalSettings = await this.getGlobalSettings(dataSource);

      // Check if AVA is enabled at all
      if (!globalSettings?.avaEnabled) {
        return {
          allowed: false,
          requiresConfirmation: false,
          rejectionReason: 'AVA is disabled for this tenant',
        };
      }

      // Check read-only mode
      if (globalSettings.readOnlyMode && action.type !== 'navigate') {
        return {
          allowed: false,
          requiresConfirmation: false,
          rejectionReason: 'AVA is in read-only mode',
        };
      }

      // Check action type global settings
      if (!this.isActionTypeAllowed(globalSettings, action.type)) {
        return {
          allowed: false,
          requiresConfirmation: false,
          rejectionReason: `${action.type} actions are disabled globally`,
        };
      }

      // Check if collection is read-only
      const collection = this.extractCollection(action.target);
      if (collection && this.isCollectionReadOnly(globalSettings, collection)) {
        return {
          allowed: false,
          requiresConfirmation: false,
          rejectionReason: `Collection '${collection}' is read-only for AVA`,
        };
      }

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimit(dataSource, context.userId, globalSettings);
      if (!rateLimitCheck.allowed) {
        return {
          allowed: false,
          requiresConfirmation: false,
          rejectionReason: `Rate limit exceeded. Resets at ${rateLimitCheck.resetAt.toISOString()}`,
        };
      }

      // Get specific permission config
      const permissionConfig = await this.getPermissionConfig(dataSource, collection, action.type);

      if (permissionConfig) {
        // Check if action is enabled
        if (!permissionConfig.isEnabled) {
          return {
            allowed: false,
            requiresConfirmation: false,
            rejectionReason: `${action.type} actions are disabled for ${collection || 'global'}`,
            permissionRuleId: permissionConfig.id,
          };
        }

        // Check role restrictions
        const userRole = context.userRole || 'user';

        if (permissionConfig.excludedRoles.includes(userRole)) {
          return {
            allowed: false,
            requiresConfirmation: false,
            rejectionReason: `Your role '${userRole}' is excluded from this action`,
            permissionRuleId: permissionConfig.id,
          };
        }

        if (permissionConfig.allowedRoles.length > 0 && !permissionConfig.allowedRoles.includes(userRole)) {
          return {
            allowed: false,
            requiresConfirmation: false,
            rejectionReason: `Your role '${userRole}' is not permitted for this action`,
            permissionRuleId: permissionConfig.id,
          };
        }

        return {
          allowed: true,
          requiresConfirmation: permissionConfig.requiresConfirmation,
          permissionRuleId: permissionConfig.id,
        };
      }

      // Default: allowed with confirmation based on global settings
      return {
        allowed: true,
        requiresConfirmation: globalSettings.defaultRequiresConfirmation,
      };
    } catch (error) {
      this.logger.error('Permission check failed', error);
      return {
        allowed: false,
        requiresConfirmation: false,
        rejectionReason: 'Permission check failed due to an internal error',
      };
    }
  }

  /**
   * Record an action to the audit trail
   */
  async recordAction(
    dataSource: DataSource,
    entry: AuditEntry,
    status: AVAActionStatus = 'pending'
  ): Promise<AVAAuditTrail> {
    const auditRepo = dataSource.getRepository(AVAAuditTrail);

    const audit = auditRepo.create({
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      conversationId: entry.conversationId,
      userMessage: entry.userMessage,
      avaResponse: entry.avaResponse,
      actionType: entry.action.type as AVAActionType,
      status,
      actionLabel: entry.action.label,
      actionTarget: entry.action.target,
      targetCollection: entry.targetCollection,
      targetRecordId: entry.targetRecordId,
      targetDisplayValue: entry.targetDisplayValue,
      beforeData: entry.beforeData,
      afterData: entry.afterData,
      actionParams: entry.action.params,
      isRevertible: this.isActionRevertible(entry.action.type as AVAActionType, entry.beforeData),
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      sessionId: entry.sessionId,
    });

    const saved = await auditRepo.save(audit);

    this.eventEmitter.emit('ava.action.recorded', {
      auditId: saved.id,
      userId: entry.userId,
      actionType: entry.action.type,
    });

    return saved;
  }

  /**
   * Update audit entry status after action completes
   */
  async updateAuditStatus(
    dataSource: DataSource,
    auditId: string,
    status: AVAActionStatus,
    details?: {
      afterData?: Record<string, unknown>;
      errorMessage?: string;
      errorCode?: string;
      durationMs?: number;
    }
  ): Promise<void> {
    const auditRepo = dataSource.getRepository(AVAAuditTrail);
    const audit = await auditRepo.findOne({ where: { id: auditId } });

    if (audit) {
      audit.status = status;
      audit.completedAt = new Date();
      if (details?.errorMessage) audit.errorMessage = details.errorMessage;
      if (details?.errorCode) audit.errorCode = details.errorCode;
      if (details?.durationMs) audit.durationMs = details.durationMs;
      if (details?.afterData) audit.afterData = details.afterData;
      audit.isRevertible = status === 'completed' && details?.afterData !== undefined;

      await auditRepo.save(audit);
    }

    if (status === 'failed') {
      this.eventEmitter.emit('ava.action.failed', { auditId, status, details });
    }
  }

  /**
   * Revert a previously executed action
   */
  async revertAction(
    dataSource: DataSource,
    auditId: string,
    revertedBy: string,
    reason?: string
  ): Promise<RevertResult> {
    const auditRepo = dataSource.getRepository(AVAAuditTrail);
    const audit = await auditRepo.findOne({ where: { id: auditId } });

    if (!audit) {
      return { success: false, message: 'Audit record not found' };
    }

    if (!audit.isRevertible) {
      return { success: false, message: 'This action cannot be reverted' };
    }

    if (audit.status === 'reverted') {
      return { success: false, message: 'This action has already been reverted' };
    }

    if (!audit.beforeData) {
      return { success: false, message: 'No before data available for revert' };
    }

    try {
      // Perform the actual revert based on action type
      const revertedData = await this.performRevert(
        dataSource,
        audit.actionType,
        audit.targetCollection,
        audit.targetRecordId,
        audit.beforeData
      );

      // Update audit record
      await auditRepo.update(auditId, {
        status: 'reverted',
        revertedAt: new Date(),
        revertedBy,
        revertReason: reason,
      });

      this.eventEmitter.emit('ava.action.reverted', {
        auditId,
        revertedBy,
        reason,
        collection: audit.targetCollection,
        recordId: audit.targetRecordId,
      });

      return {
        success: true,
        message: `Action reverted successfully. ${audit.targetCollection}/${audit.targetRecordId} restored to previous state.`,
        revertedData,
      };
    } catch (error) {
      this.logger.error(`Failed to revert action ${auditId}`, error);
      return {
        success: false,
        message: `Revert failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get audit trail entries
   */
  async getAuditTrail(
    dataSource: DataSource,
    options: AuditQueryOptions = {}
  ): Promise<{ entries: AVAAuditTrail[]; total: number }> {
    const auditRepo = dataSource.getRepository(AVAAuditTrail);
    const where: FindOptionsWhere<AVAAuditTrail> = {};

    if (options.userId) where.userId = options.userId;
    if (options.actionType) where.actionType = options.actionType;
    if (options.status) where.status = options.status;
    if (options.targetCollection) where.targetCollection = options.targetCollection;
    if (options.isRevertible !== undefined) where.isRevertible = options.isRevertible;

    if (options.fromDate && options.toDate) {
      where.createdAt = And(MoreThan(options.fromDate), LessThan(options.toDate));
    } else if (options.fromDate) {
      where.createdAt = MoreThan(options.fromDate);
    } else if (options.toDate) {
      where.createdAt = LessThan(options.toDate);
    }

    const [entries, total] = await auditRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return { entries, total };
  }

  /**
   * Get audit trail for a specific user
   */
  async getUserAuditTrail(
    dataSource: DataSource,
    userId: string,
    limit = 20
  ): Promise<AVAAuditTrail[]> {
    const result = await this.getAuditTrail(dataSource, { userId, limit });
    return result.entries;
  }

  /**
   * Get revertible actions
   */
  async getRevertibleActions(
    dataSource: DataSource,
    options?: { userId?: string; limit?: number }
  ): Promise<AVAAuditTrail[]> {
    const result = await this.getAuditTrail(dataSource, {
      userId: options?.userId,
      isRevertible: true,
      status: 'completed' as AVAActionStatus,
      limit: options?.limit || 20,
    });
    return result.entries;
  }

  /**
   * Get global settings
   */
  async getGlobalSettings(dataSource: DataSource): Promise<AVAGlobalSettings | null> {
    const repo = dataSource.getRepository(AVAGlobalSettings);
    return repo.findOne({ where: {} });
  }

  /**
   * Update global settings
   */
  async updateGlobalSettings(
    dataSource: DataSource,
    settings: Partial<AVAGlobalSettings>,
    updatedBy: string
  ): Promise<AVAGlobalSettings> {
    const repo = dataSource.getRepository(AVAGlobalSettings);
    let existing = await repo.findOne({ where: {} });

    if (!existing) {
      existing = repo.create({ ...settings, updatedBy, updatedAt: new Date() });
    } else {
      Object.assign(existing, settings, { updatedBy, updatedAt: new Date() });
    }

    return repo.save(existing);
  }

  /**
   * Get permission configurations
   */
  async getPermissionConfigs(dataSource: DataSource): Promise<AVAPermissionConfig[]> {
    const repo = dataSource.getRepository(AVAPermissionConfig);
    return repo.find({ order: { collectionCode: 'ASC', actionType: 'ASC' } });
  }

  /**
   * Update permission configuration
   */
  async updatePermissionConfig(
    dataSource: DataSource,
    id: string,
    config: Partial<AVAPermissionConfig>,
    updatedBy: string
  ): Promise<AVAPermissionConfig | null> {
    const repo = dataSource.getRepository(AVAPermissionConfig);
    const existing = await repo.findOne({ where: { id } });

    if (!existing) return null;

    Object.assign(existing, config, { updatedBy, updatedAt: new Date() });
    return repo.save(existing);
  }

  /**
   * Create permission configuration
   */
  async createPermissionConfig(
    dataSource: DataSource,
    config: Partial<AVAPermissionConfig>,
    createdBy: string
  ): Promise<AVAPermissionConfig> {
    const repo = dataSource.getRepository(AVAPermissionConfig);
    const newConfig = repo.create({ ...config, createdBy });
    return repo.save(newConfig);
  }

  /**
   * Delete permission configuration
   */
  async deletePermissionConfig(dataSource: DataSource, id: string): Promise<boolean> {
    const repo = dataSource.getRepository(AVAPermissionConfig);
    const result = await repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(
    dataSource: DataSource,
    fromDate?: Date
  ): Promise<{
    totalActions: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    revertedCount: number;
    failedCount: number;
  }> {
    const auditRepo = dataSource.getRepository(AVAAuditTrail);
    const since = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

    const totalActions = await auditRepo.count({
      where: { createdAt: MoreThan(since) },
    });

    const byTypeRaw = await auditRepo
      .createQueryBuilder('audit')
      .select('audit.action_type', 'actionType')
      .addSelect('COUNT(*)', 'count')
      .where('audit.created_at > :since', { since })
      .groupBy('audit.action_type')
      .getRawMany();

    const byStatusRaw = await auditRepo
      .createQueryBuilder('audit')
      .select('audit.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('audit.created_at > :since', { since })
      .groupBy('audit.status')
      .getRawMany();

    const byType: Record<string, number> = {};
    byTypeRaw.forEach((r) => (byType[r.actionType] = parseInt(r.count)));

    const byStatus: Record<string, number> = {};
    byStatusRaw.forEach((r) => (byStatus[r.status] = parseInt(r.count)));

    return {
      totalActions,
      byType,
      byStatus,
      revertedCount: byStatus['reverted'] || 0,
      failedCount: byStatus['failed'] || 0,
    };
  }

  // Private helper methods

  private async getPermissionConfig(
    dataSource: DataSource,
    collection: string | null,
    actionType: string
  ): Promise<AVAPermissionConfig | null> {
    const repo = dataSource.getRepository(AVAPermissionConfig);

    // First try collection-specific config
    if (collection) {
      const specific = await repo.findOne({
        where: { collectionCode: collection, actionType: actionType as AVAActionType },
      });
      if (specific) return specific;
    }

    // Fall back to global config for this action type
    return repo.findOne({
      where: { collectionCode: undefined as unknown as string, actionType: actionType as AVAActionType },
    });
  }

  private isActionTypeAllowed(settings: AVAGlobalSettings, actionType: string): boolean {
    switch (actionType) {
      case 'create':
        return settings.allowCreateActions;
      case 'update':
        return settings.allowUpdateActions;
      case 'delete':
        return settings.allowDeleteActions;
      case 'execute':
        return settings.allowExecuteActions;
      case 'navigate':
        return true; // Always allowed
      default:
        return false;
    }
  }

  private isCollectionReadOnly(settings: AVAGlobalSettings, collection: string): boolean {
    return settings.systemReadOnlyCollections.includes(collection);
  }

  private extractCollection(target: string): string | null {
    // Extract collection from paths like /incidents/new or /incidents/123
    const match = target.match(/^\/?([a-z_-]+)/i);
    return match?.[1] || null;
  }

  private isActionRevertible(actionType: AVAActionType, beforeData?: Record<string, unknown>): boolean {
    // Only update and delete actions with before data can be reverted
    if (actionType === 'update' || actionType === 'delete') {
      return beforeData !== undefined && Object.keys(beforeData).length > 0;
    }
    // Create actions can be reverted by deleting
    if (actionType === 'create') {
      return true;
    }
    return false;
  }

  private async checkRateLimit(
    dataSource: DataSource,
    userId: string,
    settings: AVAGlobalSettings
  ): Promise<RateLimitCheck> {
    const auditRepo = dataSource.getRepository(AVAAuditTrail);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const resetAt = new Date(oneHourAgo.getTime() + 60 * 60 * 1000);

    // Check user rate limit
    const userActionCount = await auditRepo.count({
      where: {
        userId,
        createdAt: MoreThan(oneHourAgo),
      },
    });

    if (userActionCount >= settings.userRateLimitPerHour) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Check global rate limit
    const globalActionCount = await auditRepo.count({
      where: {
        createdAt: MoreThan(oneHourAgo),
      },
    });

    if (globalActionCount >= settings.globalRateLimitPerHour) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(
        settings.userRateLimitPerHour - userActionCount,
        settings.globalRateLimitPerHour - globalActionCount
      ),
      resetAt,
    };
  }

  private async performRevert(
    dataSource: DataSource,
    actionType: AVAActionType,
    targetCollection: string | null,
    targetRecordId: string | null,
    beforeData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!targetCollection || !targetRecordId) {
      throw new Error('Cannot revert: missing target collection or record ID');
    }

    // Get the table name from collection code
    const tableName = this.collectionToTable(targetCollection);

    switch (actionType) {
      case 'update':
        // Restore original values
        const setClauses = Object.keys(beforeData)
          .filter((k) => k !== 'id')
          .map((k, i) => `"${this.camelToSnake(k)}" = $${i + 2}`)
          .join(', ');

        const values = Object.keys(beforeData)
          .filter((k) => k !== 'id')
          .map((k) => beforeData[k]);

        await dataSource.query(
          `UPDATE "${tableName}" SET ${setClauses} WHERE id = $1`,
          [targetRecordId, ...values]
        );

        return beforeData;

      case 'create':
        // Delete the created record
        await dataSource.query(`DELETE FROM "${tableName}" WHERE id = $1`, [targetRecordId]);
        return { deleted: true, id: targetRecordId };

      case 'delete':
        // Re-insert the deleted record
        const columns = Object.keys(beforeData).map((k) => `"${this.camelToSnake(k)}"`).join(', ');
        const placeholders = Object.keys(beforeData).map((_, i) => `$${i + 1}`).join(', ');
        const insertValues = Object.values(beforeData);

        await dataSource.query(
          `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`,
          insertValues
        );

        return beforeData;

      default:
        throw new Error(`Cannot revert action type: ${actionType}`);
    }
  }

  private collectionToTable(collection: string): string {
    // Map collection codes to table names
    // This would ideally come from collection definitions
    const mapping: Record<string, string> = {
      incidents: 'incidents',
      requests: 'service_requests',
      tasks: 'tasks',
      changes: 'change_requests',
      problems: 'problems',
      knowledge: 'knowledge_articles',
      assets: 'assets',
      users: 'users',
    };

    return mapping[collection] || collection;
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
