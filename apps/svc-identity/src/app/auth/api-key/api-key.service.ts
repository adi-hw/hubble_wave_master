import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ApiKey } from '@eam-platform/platform-db';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface ValidatedApiKey {
  id: string;
  name: string;
  tenantId: string;
  scopes: string[];
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  /**
   * Create a new API key for a tenant
   * Returns the plain key (only shown once) and the stored API key record
   */
  async createKey(
    tenantId: string,
    name: string,
    scopes: string[] = [],
    expiresAt?: Date,
  ): Promise<{ key: string; apiKey: ApiKey }> {
    const prefix = 'sk_live_';
    const randomPart = crypto.randomBytes(24).toString('hex');
    const plainKey = `${prefix}${randomPart}`;

    const keyHash = await bcrypt.hash(plainKey, 10);
    const keyPrefix = plainKey.substring(0, 12); // Store prefix for lookup optimization

    const apiKey = this.apiKeyRepo.create({
      name,
      keyPrefix,
      keyHash,
      scopes,
      tenantId,
      expiresAt,
      isActive: true,
    });

    await this.apiKeyRepo.save(apiKey);
    this.logger.log(`API key created: ${name} for tenant ${tenantId}`);

    return { key: plainKey, apiKey };
  }

  /**
   * Validate an API key and return the associated metadata
   * Uses prefix-based lookup for efficiency, then bcrypt comparison
   */
  async validateKey(plainKey: string): Promise<ValidatedApiKey | null> {
    if (!plainKey || !plainKey.startsWith('sk_live_')) {
      return null;
    }

    const keyPrefix = plainKey.substring(0, 12);

    // Find candidate keys by prefix (optimized lookup)
    const candidates = await this.apiKeyRepo.find({
      where: {
        keyPrefix,
        isActive: true,
        deletedAt: IsNull(),
      },
    });

    // Check each candidate against the provided key
    for (const candidate of candidates) {
      // Check expiration
      if (candidate.expiresAt && candidate.expiresAt < new Date()) {
        continue;
      }

      // Compare hash
      const isValid = await bcrypt.compare(plainKey, candidate.keyHash);
      if (isValid) {
        // Update last used timestamp (fire and forget)
        this.apiKeyRepo.update({ id: candidate.id }, { lastUsedAt: new Date() }).catch((err) => {
          this.logger.warn(`Failed to update lastUsedAt for API key ${candidate.id}: ${err.message}`);
        });

        return {
          id: candidate.id,
          name: candidate.name,
          tenantId: candidate.tenantId,
          scopes: candidate.scopes,
        };
      }
    }

    return null;
  }

  /**
   * Revoke an API key (soft disable)
   */
  async revokeKey(id: string, tenantId: string): Promise<boolean> {
    const result = await this.apiKeyRepo.update(
      { id, tenantId },
      { isActive: false },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`API key revoked: ${id} for tenant ${tenantId}`);
      return true;
    }
    return false;
  }

  /**
   * List all API keys for a tenant (excluding the hash)
   */
  async listKeys(tenantId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const keys = await this.apiKeyRepo.find({
      where: { tenantId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      select: ['id', 'name', 'keyPrefix', 'scopes', 'tenantId', 'expiresAt', 'lastUsedAt', 'isActive', 'createdAt', 'updatedAt'],
    });
    return keys;
  }

  /**
   * Get a single API key by ID (for details view)
   */
  async getKey(id: string, tenantId: string): Promise<Omit<ApiKey, 'keyHash'> | null> {
    const key = await this.apiKeyRepo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
      select: ['id', 'name', 'keyPrefix', 'scopes', 'tenantId', 'expiresAt', 'lastUsedAt', 'isActive', 'createdAt', 'updatedAt'],
    });
    return key;
  }

  /**
   * Permanently delete an API key
   */
  async deleteKey(id: string, tenantId: string): Promise<boolean> {
    const result = await this.apiKeyRepo.update(
      { id, tenantId },
      { deletedAt: new Date(), isActive: false },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`API key deleted: ${id} for tenant ${tenantId}`);
      return true;
    }
    return false;
  }

  /**
   * Update API key scopes
   */
  async updateScopes(id: string, tenantId: string, scopes: string[]): Promise<boolean> {
    const result = await this.apiKeyRepo.update(
      { id, tenantId, deletedAt: IsNull() },
      { scopes },
    );
    return (result.affected ?? 0) > 0;
  }
}
