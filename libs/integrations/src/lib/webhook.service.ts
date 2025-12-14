import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantDbService } from '@eam-platform/tenant-db';
import * as crypto from 'crypto';

export interface WebhookConfig {
  id: string;
  tenantId: string;
  name: string;
  secret?: string;
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
  events: string[];
  targetType: 'workflow' | 'script' | 'record_operation' | 'custom';
  targetConfig: {
    workflowCode?: string;
    scriptCode?: string;
    collectionCode?: string;
    operation?: 'create' | 'update' | 'upsert';
    fieldMapping?: Record<string, string>;
    handler?: (payload: WebhookPayload) => Promise<WebhookResponse>;
  };
  isActive: boolean;
  allowedIps?: string[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface WebhookPayload {
  tenantId: string;
  webhookId: string;
  event?: string;
  headers: Record<string, string>;
  body: unknown;
  query?: Record<string, string>;
  sourceIp?: string;
  timestamp: Date;
}

export interface WebhookResponse {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: unknown;
}

export interface WebhookLog {
  webhookId: string;
  tenantId: string;
  requestId: string;
  event?: string;
  payload: unknown;
  response: WebhookResponse;
  processingTimeMs: number;
  createdAt: Date;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private webhookConfigs: Map<string, WebhookConfig> = new Map();
  private rateLimitCounters: Map<string, { count: number; resetAt: Date }> = new Map();

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly eventEmitter: EventEmitter2
  ) {
    // tenantDb is available for loading webhook configs from database
    this.logger.debug(`WebhookService initialized with tenantDb: ${!!this.tenantDb}`);
  }

  /**
   * Register a webhook configuration
   */
  registerWebhook(config: WebhookConfig): string {
    const webhookId = config.id || this.generateWebhookId();
    config.id = webhookId;
    this.webhookConfigs.set(webhookId, config);

    this.logger.log(`Registered webhook: ${webhookId} for tenant ${config.tenantId}`);

    return webhookId;
  }

  /**
   * Unregister a webhook
   */
  unregisterWebhook(webhookId: string): void {
    this.webhookConfigs.delete(webhookId);
  }

  /**
   * Get webhook by ID
   */
  getWebhook(webhookId: string): WebhookConfig | undefined {
    return this.webhookConfigs.get(webhookId);
  }

  /**
   * Process an incoming webhook request
   */
  async process(
    webhookId: string,
    headers: Record<string, string>,
    body: unknown,
    query?: Record<string, string>,
    sourceIp?: string
  ): Promise<WebhookResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    const config = this.webhookConfigs.get(webhookId);

    if (!config) {
      return { success: false, statusCode: 404, message: 'Webhook not found' };
    }

    if (!config.isActive) {
      return { success: false, statusCode: 403, message: 'Webhook is disabled' };
    }

    // Check IP allowlist
    if (config.allowedIps && config.allowedIps.length > 0 && sourceIp) {
      if (!this.isIpAllowed(sourceIp, config.allowedIps)) {
        return { success: false, statusCode: 403, message: 'IP not allowed' };
      }
    }

    // Check rate limit
    if (config.rateLimit) {
      const rateLimitResult = this.checkRateLimit(webhookId, config.rateLimit);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          statusCode: 429,
          message: 'Rate limit exceeded',
          data: { retryAfter: rateLimitResult.retryAfter },
        };
      }
    }

    // Verify signature
    if (config.secret) {
      const isValid = this.verifySignature(headers, body, config);
      if (!isValid) {
        return { success: false, statusCode: 401, message: 'Invalid signature' };
      }
    }

    // Build payload
    const payload: WebhookPayload = {
      tenantId: config.tenantId,
      webhookId,
      event: this.extractEvent(headers, body),
      headers,
      body,
      query,
      sourceIp,
      timestamp: new Date(),
    };

    // Check event filter
    if (config.events.length > 0 && payload.event) {
      if (!config.events.includes(payload.event) && !config.events.includes('*')) {
        return { success: true, statusCode: 200, message: 'Event filtered' };
      }
    }

    try {
      // Process based on target type
      let response: WebhookResponse;

      switch (config.targetType) {
        case 'workflow':
          response = await this.triggerWorkflow(payload, config);
          break;

        case 'script':
          response = await this.executeScript(payload, config);
          break;

        case 'record_operation':
          response = await this.performRecordOperation(payload, config);
          break;

        case 'custom':
          if (config.targetConfig.handler) {
            response = await config.targetConfig.handler(payload);
          } else {
            response = { success: false, statusCode: 500, message: 'No handler configured' };
          }
          break;

        default:
          response = { success: false, statusCode: 400, message: 'Unknown target type' };
      }

      // Log webhook execution
      const log: WebhookLog = {
        webhookId,
        tenantId: config.tenantId,
        requestId,
        event: payload.event,
        payload: body,
        response,
        processingTimeMs: Date.now() - startTime,
        createdAt: new Date(),
      };

      this.eventEmitter.emit('webhook.processed', log);

      return response;
    } catch (error: any) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);

      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(
    headers: Record<string, string>,
    body: unknown,
    config: WebhookConfig
  ): boolean {
    if (!config.secret) return true;

    const signatureHeader = config.signatureHeader || 'x-signature';
    const signature = headers[signatureHeader.toLowerCase()];

    if (!signature) {
      this.logger.warn(`Missing signature header: ${signatureHeader}`);
      return false;
    }

    const algorithm = config.signatureAlgorithm || 'sha256';
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

    const expectedSignature = crypto
      .createHmac(algorithm, config.secret)
      .update(bodyString)
      .digest('hex');

    // Handle different signature formats
    const cleanSignature = signature.replace(/^sha256=/, '').replace(/^sha1=/, '');

    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Extract event type from headers or body
   */
  private extractEvent(headers: Record<string, string>, body: unknown): string | undefined {
    // Check common event header locations
    const eventHeaders = ['x-event-type', 'x-github-event', 'x-webhook-event', 'event-type'];

    for (const header of eventHeaders) {
      if (headers[header]) {
        return headers[header];
      }
    }

    // Check body for event field
    if (body && typeof body === 'object') {
      const bodyObj = body as Record<string, unknown>;
      if (bodyObj['event']) return String(bodyObj['event']);
      if (bodyObj['type']) return String(bodyObj['type']);
      if (bodyObj['action']) return String(bodyObj['action']);
    }

    return undefined;
  }

  /**
   * Check if IP is in allowlist
   */
  private isIpAllowed(ip: string, allowedIps: string[]): boolean {
    return allowedIps.some((allowed) => {
      if (allowed.includes('/')) {
        // CIDR notation - basic check
        return ip.startsWith(allowed.split('/')[0].replace(/\.\d+$/, ''));
      }
      return ip === allowed || allowed === '*';
    });
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(
    webhookId: string,
    config: { maxRequests: number; windowMs: number }
  ): { allowed: boolean; retryAfter?: number } {
    const now = new Date();
    const counter = this.rateLimitCounters.get(webhookId);

    if (!counter || counter.resetAt < now) {
      this.rateLimitCounters.set(webhookId, {
        count: 1,
        resetAt: new Date(now.getTime() + config.windowMs),
      });
      return { allowed: true };
    }

    if (counter.count >= config.maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((counter.resetAt.getTime() - now.getTime()) / 1000),
      };
    }

    counter.count++;
    return { allowed: true };
  }

  /**
   * Trigger a workflow
   */
  private async triggerWorkflow(
    payload: WebhookPayload,
    config: WebhookConfig
  ): Promise<WebhookResponse> {
    if (!config.targetConfig.workflowCode) {
      return { success: false, statusCode: 400, message: 'No workflow code configured' };
    }

    this.eventEmitter.emit('workflow.trigger', {
      tenantId: payload.tenantId,
      workflowCode: config.targetConfig.workflowCode,
      input: {
        webhookPayload: payload.body,
        webhookEvent: payload.event,
        webhookHeaders: payload.headers,
      },
      source: 'webhook',
    });

    return {
      success: true,
      statusCode: 202,
      message: 'Workflow triggered',
    };
  }

  /**
   * Execute a script
   */
  private async executeScript(
    payload: WebhookPayload,
    config: WebhookConfig
  ): Promise<WebhookResponse> {
    if (!config.targetConfig.scriptCode) {
      return { success: false, statusCode: 400, message: 'No script code configured' };
    }

    // Emit event for script execution
    return new Promise((resolve) => {
      this.eventEmitter.emit('script.execute', {
        tenantId: payload.tenantId,
        scriptCode: config.targetConfig.scriptCode,
        input: payload.body,
        callback: (error: Error | null, result: unknown) => {
          if (error) {
            resolve({ success: false, statusCode: 500, message: error.message });
          } else {
            resolve({ success: true, statusCode: 200, data: result });
          }
        },
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        resolve({ success: false, statusCode: 504, message: 'Script timeout' });
      }, 30000);
    });
  }

  /**
   * Perform record operation
   */
  private async performRecordOperation(
    payload: WebhookPayload,
    config: WebhookConfig
  ): Promise<WebhookResponse> {
    const { collectionCode, operation, fieldMapping } = config.targetConfig;

    if (!collectionCode || !operation) {
      return { success: false, statusCode: 400, message: 'Missing collection or operation' };
    }

    // Map fields from payload to record
    const record = this.mapFields(payload.body, fieldMapping || {});

    return new Promise((resolve) => {
      this.eventEmitter.emit('record.operation', {
        tenantId: payload.tenantId,
        operation,
        tableName: collectionCode,
        data: record,
        callback: (error: Error | null, result: unknown) => {
          if (error) {
            resolve({ success: false, statusCode: 500, message: error.message });
          } else {
            resolve({ success: true, statusCode: 200, data: result });
          }
        },
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        resolve({ success: false, statusCode: 504, message: 'Operation timeout' });
      }, 30000);
    });
  }

  /**
   * Map fields from source to target
   */
  private mapFields(
    source: unknown,
    mapping: Record<string, string>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (!source || typeof source !== 'object') {
      return result;
    }

    const sourceObj = source as Record<string, unknown>;

    // Apply explicit mapping
    for (const [targetField, sourcePath] of Object.entries(mapping)) {
      result[targetField] = this.getNestedValue(sourceObj, sourcePath);
    }

    // If no mapping, use source directly
    if (Object.keys(mapping).length === 0) {
      return { ...sourceObj };
    }

    return result;
  }

  /**
   * Get nested value from object
   */
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

  /**
   * Generate webhook ID
   */
  private generateWebhookId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate webhook URL for a tenant
   */
  generateWebhookUrl(tenantId: string, webhookId: string, baseUrl: string): string {
    return `${baseUrl}/api/webhooks/${tenantId}/${webhookId}`;
  }

  /**
   * Generate webhook secret
   */
  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
