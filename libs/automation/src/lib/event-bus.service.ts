import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { TenantDbService } from '@eam-platform/tenant-db';

export type EventType =
  | 'record.before_insert'
  | 'record.after_insert'
  | 'record.before_update'
  | 'record.after_update'
  | 'record.before_delete'
  | 'record.after_delete'
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.step_completed'
  | 'notification.send'
  | 'api.call'
  | 'rule.error'
  | 'custom';

export interface EventPayload {
  tenantId: string;
  eventType: EventType;
  tableName?: string;
  recordId?: string;
  record?: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
  changedFields?: string[];
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface EventHandler {
  (payload: EventPayload): Promise<void>;
}

interface SubscriptionHandler {
  subscriptionId: string;
  tenantId: string;
  eventPattern: string;
  handler: EventHandler;
}

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);
  private handlers: Map<string, SubscriptionHandler[]> = new Map();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly _tenantDb: TenantDbService
  ) {}

  async onModuleInit() {
    // Load persistent subscriptions from database on startup
    await this.loadPersistentSubscriptions();
  }

  /**
   * Publish an event to all subscribers
   */
  async publish(event: Omit<EventPayload, 'timestamp'>): Promise<void> {
    const payload: EventPayload = {
      ...event,
      timestamp: new Date(),
    };

    const eventName = this.buildEventName(event.eventType, event.tableName);

    this.logger.debug(`Publishing event: ${eventName}`);

    // Emit to NestJS event system
    this.eventEmitter.emit(eventName, payload);

    // Also emit to generic handlers
    this.eventEmitter.emit('event.published', payload);

    // Execute registered handlers
    await this.executeHandlers(eventName, payload);
  }

  /**
   * Subscribe to events matching a pattern
   */
  subscribe(
    tenantId: string,
    eventPattern: string,
    handler: EventHandler
  ): string {
    const subscriptionId = this.generateSubscriptionId();

    const subscription: SubscriptionHandler = {
      subscriptionId,
      tenantId,
      eventPattern,
      handler,
    };

    const existing = this.handlers.get(eventPattern) || [];
    existing.push(subscription);
    this.handlers.set(eventPattern, existing);

    this.logger.debug(`Registered subscription ${subscriptionId} for ${eventPattern}`);

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void {
    for (const [pattern, handlers] of this.handlers.entries()) {
      const filtered = handlers.filter((h) => h.subscriptionId !== subscriptionId);
      if (filtered.length !== handlers.length) {
        this.handlers.set(pattern, filtered);
        this.logger.debug(`Removed subscription ${subscriptionId}`);
        return;
      }
    }
  }

  /**
   * Execute handlers for an event
   */
  private async executeHandlers(eventName: string, payload: EventPayload): Promise<void> {
    const matchingHandlers: SubscriptionHandler[] = [];

    // Find all matching handlers
    for (const [pattern, handlers] of this.handlers.entries()) {
      if (this.matchesPattern(eventName, pattern)) {
        // Filter by tenant
        const tenantHandlers = handlers.filter(
          (h) => h.tenantId === payload.tenantId || h.tenantId === '*'
        );
        matchingHandlers.push(...tenantHandlers);
      }
    }

    // Execute handlers in parallel
    await Promise.all(
      matchingHandlers.map(async (handler) => {
        try {
          await handler.handler(payload);
        } catch (error: any) {
          this.logger.error(
            `Handler ${handler.subscriptionId} failed: ${error.message}`,
            error.stack
          );
        }
      })
    );
  }

  /**
   * Build event name from type and optional table
   */
  private buildEventName(eventType: EventType, tableName?: string): string {
    if (tableName) {
      return `${eventType}:${tableName}`;
    }
    return eventType;
  }

  /**
   * Check if event name matches a pattern
   */
  private matchesPattern(eventName: string, pattern: string): boolean {
    // Support wildcards: record.* matches record.before_insert, etc.
    if (pattern === '*') return true;

    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return eventName.startsWith(prefix);
    }

    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(eventName);
    }

    return eventName === pattern;
  }

  /**
   * Load persistent subscriptions from database
   */
  private async loadPersistentSubscriptions(): Promise<void> {
    // This will be enhanced to load from EventSubscription entity
    // For now, we just log that the service is ready
    this.logger.log(`Loading persistent event subscriptions... (TenantDb: ${this._tenantDb ? 'available' : 'not available'})`);
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============ Built-in Event Handlers ============

  @OnEvent('notification.send')
  async handleNotificationSend(payload: any): Promise<void> {
    this.logger.debug(`Notification requested: ${payload.templateCode} to ${payload.recipients?.length || 0} recipients`);
    // Delegate to notification service
    this.eventEmitter.emit('notification.process', payload);
  }

  @OnEvent('api.call')
  async handleApiCall(payload: any): Promise<void> {
    this.logger.debug(`API call requested: ${payload.method} ${payload.endpoint}`);
    // Delegate to HTTP service (will be implemented)
  }

  @OnEvent('workflow.trigger')
  async handleWorkflowTrigger(payload: any): Promise<void> {
    this.logger.debug(`Workflow trigger: ${payload.workflowCode}`);
    // Delegate to workflow engine
    this.eventEmitter.emit('workflow.start', payload);
  }

  @OnEvent('rule.error')
  async handleRuleError(payload: any): Promise<void> {
    this.logger.error(`Rule error: ${payload.ruleCode} - ${payload.error}`);
    // Log to audit trail and optionally notify admins
  }
}
