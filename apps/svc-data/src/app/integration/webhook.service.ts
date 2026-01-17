/**
 * Webhook Service
 * HubbleWave Platform - Phase 5
 *
 * Manages webhook subscriptions and delivery with retry logic.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import {
  WebhookSubscription,
  WebhookDelivery,
  WebhookEvent,
  WebhookDeliveryStatus,
} from '@hubblewave/instance-db';

interface DeliverWebhookOptions {
  subscriptionId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
}

interface CreateWebhookDto {
  name: string;
  endpointUrl: string;
  events: WebhookEvent[];
  collectionId?: string;
  filterConditions?: Record<string, unknown>;
  headers?: Record<string, string>;
  secret?: string;
  retryCount?: number;
  timeoutSeconds?: number;
  verifySsl?: boolean;
  createdBy?: string;
}

interface UpdateWebhookDto {
  name?: string;
  endpointUrl?: string;
  events?: WebhookEvent[];
  filterConditions?: Record<string, unknown>;
  headers?: Record<string, string>;
  isActive?: boolean;
  retryCount?: number;
  timeoutSeconds?: number;
}

@Injectable()
export class WebhookService {
  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepo: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('record.created', (payload: Record<string, unknown>) => {
      this.triggerWebhooks('record.created', payload);
    });
    this.eventEmitter.on('record.updated', (payload: Record<string, unknown>) => {
      this.triggerWebhooks('record.updated', payload);
    });
    this.eventEmitter.on('record.deleted', (payload: Record<string, unknown>) => {
      this.triggerWebhooks('record.deleted', payload);
    });
    this.eventEmitter.on('processFlow.completed', (payload: Record<string, unknown>) => {
      this.triggerWebhooks('processFlow.completed', payload);
    });
    this.eventEmitter.on('approval.pending', (payload: Record<string, unknown>) => {
      this.triggerWebhooks('approval.pending', payload);
    });
    this.eventEmitter.on('approval.completed', (payload: Record<string, unknown>) => {
      this.triggerWebhooks('approval.completed', payload);
    });
    this.eventEmitter.on('sla.breached', (payload: Record<string, unknown>) => {
      this.triggerWebhooks('sla.breached', payload);
    });
  }

  async create(dto: CreateWebhookDto): Promise<WebhookSubscription> {
    const secret = dto.secret || crypto.randomBytes(32).toString('hex');

    const subscription = this.subscriptionRepo.create({
      ...dto,
      secret,
      isActive: true,
      httpMethod: 'POST',
      verifySsl: dto.verifySsl ?? true,
      retryCount: dto.retryCount ?? 5,
      retryDelaySeconds: 30,
      timeoutSeconds: dto.timeoutSeconds ?? 30,
      failureCount: 0,
      successCount: 0,
    });

    return this.subscriptionRepo.save(subscription);
  }

  async findById(id: string): Promise<WebhookSubscription | null> {
    return this.subscriptionRepo.findOne({ where: { id } });
  }

  async findAll(params: {
    isActive?: boolean;
    collectionId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: WebhookSubscription[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.collectionId) where.collectionId = params.collectionId;

    const [items, total] = await this.subscriptionRepo.findAndCount({
      where,
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async update(id: string, dto: UpdateWebhookDto): Promise<WebhookSubscription> {
    const subscription = await this.findById(id);
    if (!subscription) {
      throw new Error('Webhook subscription not found');
    }

    if (dto.name !== undefined) subscription.name = dto.name;
    if (dto.endpointUrl !== undefined) subscription.endpointUrl = dto.endpointUrl;
    if (dto.events !== undefined) subscription.events = dto.events;
    if (dto.filterConditions !== undefined) subscription.filterConditions = dto.filterConditions;
    if (dto.headers !== undefined) subscription.headers = dto.headers;
    if (dto.isActive !== undefined) subscription.isActive = dto.isActive;
    if (dto.retryCount !== undefined) subscription.retryCount = dto.retryCount;
    if (dto.timeoutSeconds !== undefined) subscription.timeoutSeconds = dto.timeoutSeconds;

    return this.subscriptionRepo.save(subscription);
  }

  async delete(id: string): Promise<void> {
    await this.subscriptionRepo.delete(id);
  }

  async activate(id: string): Promise<WebhookSubscription> {
    return this.update(id, { isActive: true });
  }

  async deactivate(id: string): Promise<WebhookSubscription> {
    return this.update(id, { isActive: false });
  }

  async regenerateSecret(id: string): Promise<{ subscription: WebhookSubscription; secret: string }> {
    const secret = crypto.randomBytes(32).toString('hex');
    await this.subscriptionRepo.update(id, { secret });
    const subscription = await this.findById(id);
    if (!subscription) {
      throw new Error('Webhook subscription not found');
    }
    return { subscription, secret };
  }

  async triggerWebhooks(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const subscriptions = await this.subscriptionRepo
      .createQueryBuilder('webhook')
      .where('webhook.is_active = :isActive', { isActive: true })
      .andWhere(':eventType = ANY(webhook.events)', { eventType })
      .getMany();

    for (const subscription of subscriptions) {
      if (this.matchesFilter(subscription.filterConditions, payload)) {
        const eventId = crypto.randomUUID();
        await this.queueDelivery({
          subscriptionId: subscription.id,
          eventType,
          eventId,
          payload,
        });
      }
    }
  }

  private matchesFilter(
    filter: Record<string, unknown> | undefined,
    payload: Record<string, unknown>,
  ): boolean {
    if (!filter || Object.keys(filter).length === 0) return true;

    for (const [key, value] of Object.entries(filter)) {
      const payloadValue = payload[key];
      if (payloadValue !== value) return false;
    }
    return true;
  }

  async queueDelivery(options: DeliverWebhookOptions): Promise<WebhookDelivery> {
    const subscription = await this.findById(options.subscriptionId);
    if (!subscription) {
      throw new Error('Webhook subscription not found');
    }

    const delivery = this.deliveryRepo.create({
      subscriptionId: options.subscriptionId,
      eventType: options.eventType,
      eventId: options.eventId,
      payload: options.payload,
      status: 'pending' as WebhookDeliveryStatus,
      attemptCount: 0,
      maxAttempts: subscription.retryCount || 5,
      scheduledAt: new Date(),
    });

    const savedDelivery = await this.deliveryRepo.save(delivery);

    this.processDelivery(savedDelivery.id);

    return savedDelivery;
  }

  private async processDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: ['subscription'],
    });

    if (!delivery) return;

    const subscription = delivery.subscription;

    try {
      delivery.status = 'delivering';
      delivery.attemptCount += 1;
      await this.deliveryRepo.save(delivery);

      const signature = this.generateSignature(delivery.payload, subscription.secret);

      const startTime = Date.now();
      const response = await this.sendWebhook({
        url: subscription.endpointUrl,
        method: subscription.httpMethod,
        headers: {
          'Content-Type': 'application/json',
          'X-HubbleWave-Signature': signature,
          'X-HubbleWave-Event': delivery.eventType,
          'X-HubbleWave-Delivery': delivery.id,
          ...subscription.headers,
        },
        payload: {
          event: delivery.eventType,
          eventId: delivery.eventId,
          timestamp: new Date().toISOString(),
          data: delivery.payload,
        },
        timeout: subscription.timeoutSeconds * 1000,
        verifySsl: subscription.verifySsl,
      });

      delivery.durationMs = Date.now() - startTime;
      delivery.responseStatus = response.status;
      delivery.responseHeaders = response.headers;
      delivery.responseBody = response.body?.substring(0, 10000);
      delivery.status = 'delivered';
      delivery.deliveredAt = new Date();
      await this.deliveryRepo.save(delivery);

      await this.subscriptionRepo.update(subscription.id, {
        lastTriggeredAt: new Date(),
        lastSuccessAt: new Date(),
        successCount: subscription.successCount + 1,
      });

    } catch (error) {
      const err = error as Error & { status?: number };
      delivery.status = 'failed';
      delivery.errorMessage = err.message;
      delivery.responseStatus = err.status;
      delivery.durationMs = Date.now() - (delivery.scheduledAt?.getTime() || Date.now());

      if (delivery.attemptCount < delivery.maxAttempts) {
        const delay = this.calculateBackoff(delivery.attemptCount, subscription.retryDelaySeconds);
        delivery.status = 'retrying';
        delivery.nextRetryAt = new Date(Date.now() + delay);
      }

      await this.deliveryRepo.save(delivery);

      await this.subscriptionRepo.update(subscription.id, {
        lastTriggeredAt: new Date(),
        lastFailureAt: new Date(),
        failureCount: subscription.failureCount + 1,
      });

      if (delivery.status === 'retrying' && delivery.nextRetryAt) {
        setTimeout(() => this.processDelivery(deliveryId), delivery.nextRetryAt.getTime() - Date.now());
      }
    }
  }

  private generateSignature(payload: Record<string, unknown>, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  private async sendWebhook(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    payload: Record<string, unknown>;
    timeout: number;
    verifySsl: boolean;
  }): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: JSON.stringify(options.payload),
        signal: controller.signal,
      });

      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }

      return { status: response.status, headers, body };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private calculateBackoff(attempt: number, baseDelay: number): number {
    return Math.min(baseDelay * Math.pow(2, attempt - 1) * 1000, 3600000);
  }

  async testWebhook(id: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const subscription = await this.findById(id);
    if (!subscription) {
      throw new Error('Webhook subscription not found');
    }

    const testPayload = {
      event: 'test',
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook delivery from HubbleWave' },
    };

    const signature = this.generateSignature(testPayload, subscription.secret);

    try {
      const response = await this.sendWebhook({
        url: subscription.endpointUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HubbleWave-Signature': signature,
          'X-HubbleWave-Event': 'test',
          'X-HubbleWave-Delivery': crypto.randomUUID(),
          ...subscription.headers,
        },
        payload: testPayload,
        timeout: 10000,
        verifySsl: subscription.verifySsl,
      });

      return { success: true, statusCode: response.status };
    } catch (error) {
      const err = error as Error & { status?: number };
      return { success: false, statusCode: err.status, error: err.message };
    }
  }

  async getDeliveryHistory(subscriptionId: string, params: {
    status?: WebhookDeliveryStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: WebhookDelivery[]; total: number }> {
    const where: Record<string, unknown> = { subscriptionId };
    if (params.status) where.status = params.status;

    const [items, total] = await this.deliveryRepo.findAndCount({
      where,
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async retryDelivery(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
    if (!delivery) {
      throw new Error('Webhook delivery not found');
    }

    delivery.status = 'pending';
    delivery.attemptCount = 0;
    delivery.errorMessage = undefined;
    delivery.scheduledAt = new Date();
    await this.deliveryRepo.save(delivery);

    this.processDelivery(deliveryId);

    return delivery;
  }

  async getStats(subscriptionId?: string): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    successRate: number;
  }> {
    const where = subscriptionId ? { subscriptionId } : {};

    const [total, delivered, failed, pending] = await Promise.all([
      this.deliveryRepo.count({ where }),
      this.deliveryRepo.count({ where: { ...where, status: 'delivered' as WebhookDeliveryStatus } }),
      this.deliveryRepo.count({ where: { ...where, status: 'failed' as WebhookDeliveryStatus } }),
      this.deliveryRepo.count({ where: { ...where, status: In(['pending', 'delivering', 'retrying']) as unknown as WebhookDeliveryStatus } }),
    ]);

    return {
      total,
      delivered,
      failed,
      pending,
      successRate: total > 0 ? (delivered / total) * 100 : 100,
    };
  }
}
