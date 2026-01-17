/**
 * API Key Service
 * HubbleWave Platform - Phase 5
 *
 * Manages API keys for programmatic access.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import {
  IntegrationApiKey,
  ApiScope,
  ApiRequestLog,
} from '@hubblewave/instance-db';

interface CreateApiKeyDto {
  name: string;
  description?: string;
  scopes: ApiScope[];
  rateLimitPerMinute?: number;
  allowedIps?: string[];
  expiresAt?: Date;
  createdBy?: string;
}

interface UpdateApiKeyDto {
  name?: string;
  description?: string;
  scopes?: ApiScope[];
  rateLimitPerMinute?: number;
  allowedIps?: string[];
  isActive?: boolean;
}

interface ApiKeyValidation {
  valid: boolean;
  apiKey?: IntegrationApiKey;
  error?: string;
}

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(IntegrationApiKey)
    private readonly apiKeyRepo: Repository<IntegrationApiKey>,
    @InjectRepository(ApiRequestLog)
    private readonly requestLogRepo: Repository<ApiRequestLog>,
  ) {}

  async create(dto: CreateApiKeyDto): Promise<{ apiKey: IntegrationApiKey; rawKey: string }> {
    const rawKey = this.generateRawKey();
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = await this.hashKey(rawKey);

    const apiKey = this.apiKeyRepo.create({
      name: dto.name,
      description: dto.description,
      keyPrefix,
      keyHash,
      scopes: dto.scopes,
      rateLimitPerMinute: dto.rateLimitPerMinute ?? 1000,
      allowedIps: dto.allowedIps ?? [],
      expiresAt: dto.expiresAt,
      createdBy: dto.createdBy,
      isActive: true,
      usageCount: 0,
    });

    const savedKey = await this.apiKeyRepo.save(apiKey);

    return { apiKey: savedKey, rawKey };
  }

  private generateRawKey(): string {
    const prefix = 'hw_';
    const key = crypto.randomBytes(32).toString('base64url');
    return `${prefix}${key}`;
  }

  private async hashKey(key: string): Promise<string> {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async validate(rawKey: string): Promise<ApiKeyValidation> {
    if (!rawKey.startsWith('hw_')) {
      return { valid: false, error: 'Invalid API key format' };
    }

    const keyHash = await this.hashKey(rawKey);

    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash },
    });

    if (!apiKey) {
      return { valid: false, error: 'API key not found' };
    }

    if (!apiKey.isActive) {
      return { valid: false, error: 'API key is inactive' };
    }

    if (apiKey.revokedAt) {
      return { valid: false, error: 'API key has been revoked' };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    await this.apiKeyRepo.update(apiKey.id, {
      lastUsedAt: new Date(),
      usageCount: apiKey.usageCount + 1,
    });

    return { valid: true, apiKey };
  }

  async validateWithIp(rawKey: string, ipAddress: string): Promise<ApiKeyValidation> {
    const validation = await this.validate(rawKey);
    if (!validation.valid) return validation;

    const apiKey = validation.apiKey!;
    if (apiKey.allowedIps.length > 0 && !apiKey.allowedIps.includes(ipAddress)) {
      return { valid: false, error: 'IP address not allowed' };
    }

    return validation;
  }

  async findById(id: string): Promise<IntegrationApiKey | null> {
    return this.apiKeyRepo.findOne({ where: { id } });
  }

  async findByPrefix(prefix: string): Promise<IntegrationApiKey | null> {
    return this.apiKeyRepo.findOne({ where: { keyPrefix: prefix } });
  }

  async findAll(params: {
    isActive?: boolean;
    createdBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: IntegrationApiKey[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.createdBy) where.createdBy = params.createdBy;

    const [items, total] = await this.apiKeyRepo.findAndCount({
      where,
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<IntegrationApiKey> {
    await this.apiKeyRepo.update(id, dto);
    const apiKey = await this.findById(id);
    if (!apiKey) {
      throw new Error('API key not found');
    }
    return apiKey;
  }

  async revoke(id: string, revokedBy?: string): Promise<IntegrationApiKey> {
    await this.apiKeyRepo.update(id, {
      isActive: false,
      revokedAt: new Date(),
      revokedBy,
    });
    const apiKey = await this.findById(id);
    if (!apiKey) {
      throw new Error('API key not found');
    }
    return apiKey;
  }

  async delete(id: string): Promise<void> {
    await this.apiKeyRepo.delete(id);
  }

  async rollKey(id: string): Promise<{ apiKey: IntegrationApiKey; rawKey: string }> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('API key not found');
    }

    const rawKey = this.generateRawKey();
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = await this.hashKey(rawKey);

    await this.apiKeyRepo.update(id, {
      keyPrefix,
      keyHash,
    });

    const apiKey = await this.findById(id);
    return { apiKey: apiKey!, rawKey };
  }

  async logRequest(params: {
    apiKeyId: string;
    method: string;
    path: string;
    queryParams?: Record<string, unknown>;
    requestHeaders?: Record<string, string>;
    requestBodySize?: number;
    responseStatus?: number;
    responseBodySize?: number;
    durationMs?: number;
    ipAddress?: string;
    userAgent?: string;
    errorMessage?: string;
  }): Promise<void> {
    const log = this.requestLogRepo.create({
      apiKeyId: params.apiKeyId,
      method: params.method,
      path: params.path,
      queryParams: params.queryParams,
      requestHeaders: params.requestHeaders,
      requestBodySize: params.requestBodySize,
      responseStatus: params.responseStatus,
      responseBodySize: params.responseBodySize,
      durationMs: params.durationMs,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      errorMessage: params.errorMessage,
    });

    await this.requestLogRepo.save(log);
  }

  async getRequestLogs(apiKeyId: string, params: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<{ items: ApiRequestLog[]; total: number }> {
    const qb = this.requestLogRepo.createQueryBuilder('log')
      .where('log.api_key_id = :apiKeyId', { apiKeyId });

    if (params.startDate) {
      qb.andWhere('log.created_at >= :startDate', { startDate: params.startDate });
    }
    if (params.endDate) {
      qb.andWhere('log.created_at <= :endDate', { endDate: params.endDate });
    }

    const [items, total] = await qb
      .take(params.limit || 100)
      .skip(params.offset || 0)
      .orderBy('log.created_at', 'DESC')
      .getManyAndCount();

    return { items, total };
  }

  async getUsageStats(apiKeyId: string, days: number = 30): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    requestsByPath: Record<string, number>;
    requestsByDay: { date: string; count: number }[];
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.requestLogRepo.find({
      where: {
        apiKeyId,
        createdAt: LessThan(since),
      },
    });

    const totalRequests = logs.length;
    const successfulRequests = logs.filter(l => l.responseStatus && l.responseStatus < 400).length;
    const failedRequests = logs.filter(l => l.responseStatus && l.responseStatus >= 400).length;

    const responseTimes = logs.filter(l => l.durationMs).map(l => l.durationMs!);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const requestsByPath: Record<string, number> = {};
    const requestsByDay: Record<string, number> = {};

    for (const log of logs) {
      requestsByPath[log.path] = (requestsByPath[log.path] || 0) + 1;

      const dateKey = log.createdAt.toISOString().split('T')[0];
      requestsByDay[dateKey] = (requestsByDay[dateKey] || 0) + 1;
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      requestsByPath,
      requestsByDay: Object.entries(requestsByDay).map(([date, count]) => ({ date, count })),
    };
  }

  async cleanupExpiredKeys(): Promise<number> {
    const result = await this.apiKeyRepo.update(
      {
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
      {
        isActive: false,
      },
    );

    return result.affected || 0;
  }

  hasScope(apiKey: IntegrationApiKey, requiredScope: string): boolean {
    return apiKey.scopes.some(scope => {
      if (scope.name === '*' || scope.name === requiredScope) return true;

      const scopeParts = requiredScope.split('.');
      const allowedParts = scope.name.split('.');

      if (allowedParts.length > scopeParts.length) return false;

      for (let i = 0; i < allowedParts.length; i++) {
        if (allowedParts[i] === '*') return true;
        if (allowedParts[i] !== scopeParts[i]) return false;
      }

      return true;
    });
  }

  hasResourceAccess(apiKey: IntegrationApiKey, resource: string, action: string): boolean {
    return apiKey.scopes.some(scope => {
      const hasResource = scope.resources.includes('*') || scope.resources.includes(resource);
      const hasAction = scope.actions.includes('*') || scope.actions.includes(action);
      return hasResource && hasAction;
    });
  }
}
