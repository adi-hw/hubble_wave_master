import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { ipInCidr } from './url-validator';

export type WebhookSignatureAlgorithm = 'sha256' | 'sha512';

const SUPPORTED_SIGNATURE_ALGORITHMS: readonly WebhookSignatureAlgorithm[] = ['sha256', 'sha512'];

export interface WebhookConfig {
  id: string;
  name: string;
  secret?: string;
  signatureHeader?: string;
  /**
   * HMAC algorithm used to verify inbound webhook signatures. Only modern,
   * collision-resistant algorithms are accepted; legacy 'sha1' and 'md5'
   * configurations must be rotated on the sender side and re-registered.
   */
  signatureAlgorithm?: WebhookSignatureAlgorithm;
  events: string[];
  targetType: 'process_flow' | 'script' | 'record_operation' | 'custom';
  targetConfig: {
    processFlowCode?: string;
    scriptCode?: string;
    collectionCode?: string;
    operation?: 'create' | 'update' | 'upsert';
    propertyMapping?: Record<string, string>;
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
    private readonly eventEmitter: EventEmitter2
  ) {
    this.logger.debug(`WebhookService initialized`);
  }

  /**
   * Register a webhook configuration. Rejects legacy or unsupported signature
   * algorithms at registration time; operators must update the sender to a
   * modern HMAC (sha256 or sha512) before retrying.
   */
  registerWebhook(config: WebhookConfig): string {
    if (
      config.signatureAlgorithm !== undefined &&
      !SUPPORTED_SIGNATURE_ALGORITHMS.includes(config.signatureAlgorithm)
    ) {
      throw new Error(
        `Webhook signature algorithm '${config.signatureAlgorithm}' is not supported. ` +
          `Use one of: ${SUPPORTED_SIGNATURE_ALGORITHMS.join(', ')}.`,
      );
    }

    const webhookId = config.id || this.generateWebhookId();
    config.id = webhookId;
    this.webhookConfigs.set(webhookId, config);

    this.logger.log(`Registered webhook: ${webhookId}`);

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
        case 'process_flow':
          response = await this.triggerProcessFlow(payload, config);
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

    // Strip the algorithm prefix that some senders include (`sha256=...`,
    // `sha512=...`). Legacy prefixes are not accepted because the underlying
    // algorithms are no longer supported.
    const cleanSignature = signature.replace(/^sha256=/, '').replace(/^sha512=/, '');

    const expected = Buffer.from(expectedSignature, 'utf8');
    const provided = Buffer.from(cleanSignature, 'utf8');
    if (expected.length !== provided.length) {
      return false;
    }
    return crypto.timingSafeEqual(provided, expected);
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
   * Check if a source IP matches an allowlist entry. Each entry may be:
   *   - `*` (match-all)
   *   - a literal IPv4 or IPv6 address
   *   - a CIDR block (`192.168.1.0/24`, `2001:db8::/32`)
   */
  private isIpAllowed(ip: string, allowedIps: string[]): boolean {
    return allowedIps.some((allowed) => {
      if (allowed === '*') {
        return true;
      }
      if (allowed.includes('/')) {
        return ipInCidr(ip, allowed);
      }
      return ip === allowed;
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
   * Trigger a process flow
   */
  private async triggerProcessFlow(
    payload: WebhookPayload,
    config: WebhookConfig
  ): Promise<WebhookResponse> {
    if (!config.targetConfig.processFlowCode) {
      return { success: false, statusCode: 400, message: 'No process flow code configured' };
    }

    this.eventEmitter.emit('processFlow.trigger', {
      processFlowCode: config.targetConfig.processFlowCode,
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
      message: 'Process flow triggered',
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
    const { collectionCode, operation, propertyMapping } = config.targetConfig;

    if (!collectionCode || !operation) {
      return { success: false, statusCode: 400, message: 'Missing collection or operation' };
    }

    // Map properties from payload to record
    const record = this.mapProperties(payload.body, propertyMapping || {});

    return new Promise((resolve) => {
      this.eventEmitter.emit('record.operation', {
        operation,
        collectionCode,
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
   * Map properties from source to target
   */
  private mapProperties(
    source: unknown,
    mapping: Record<string, string>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (!source || typeof source !== 'object') {
      return result;
    }

    const sourceObj = source as Record<string, unknown>;

    // Apply explicit mapping
    for (const [targetProperty, sourcePath] of Object.entries(mapping)) {
      result[targetProperty] = this.getNestedValue(sourceObj, sourcePath);
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
   * Generate webhook ID using a CSPRNG so identifiers are unguessable.
   */
  private generateWebhookId(): string {
    return `wh_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate request ID using a CSPRNG.
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate webhook URL for an instance
   */
  generateWebhookUrl(webhookId: string, baseUrl: string): string {
    return `${baseUrl}/api/webhooks/${webhookId}`;
  }

  /**
   * Generate webhook secret
   */
  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
