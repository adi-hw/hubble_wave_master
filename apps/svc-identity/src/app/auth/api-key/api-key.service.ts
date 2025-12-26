import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '@hubblewave/instance-db';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface ValidatedApiKey {
  id: string;
  name: string;
  userId: string;
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
   * Create a new API key for a user (instance-scoped)
   * Returns the plain key (only shown once) and the stored API key record
   */
  async createKey(
    userId: string,
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
      userId,
      expiresAt,
      isActive: true,
    });

    await this.apiKeyRepo.save(apiKey);
    this.logger.log(`API key created: ${name} for user ${userId}`);

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
          userId: candidate.userId,
          scopes: candidate.scopes,
        };
      }
    }

    return null;
  }

  /**
   * Revoke an API key (soft disable)
   */
  async revokeKey(id: string, userId: string): Promise<boolean> {
    const result = await this.apiKeyRepo.update(
      { id, userId },
      { isActive: false },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`API key revoked: ${id} for user ${userId}`);
      return true;
    }
    return false;
  }

  /**
   * List all API keys for a tenant (excluding the hash)
   */
  async listKeys(userId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const keys = await this.apiKeyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: ['id', 'name', 'keyPrefix', 'scopes', 'userId', 'expiresAt', 'lastUsedAt', 'isActive', 'createdAt'],
    });
    return keys;
  }

  /**
   * Get a single API key by ID (for details view)
   */
  async getKey(id: string, userId: string): Promise<Omit<ApiKey, 'keyHash'> | null> {
    const key = await this.apiKeyRepo.findOne({
      where: { id, userId },
      select: ['id', 'name', 'keyPrefix', 'scopes', 'userId', 'expiresAt', 'lastUsedAt', 'isActive', 'createdAt'],
    });
    return key;
  }

  /**
   * Permanently delete an API key
   */
  async deleteKey(id: string, userId: string): Promise<boolean> {
    const result = await this.apiKeyRepo.update(
      { id, userId },
      { isActive: false, expiresAt: new Date() },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`API key deleted: ${id} for user ${userId}`);
      return true;
    }
    return false;
  }

  /**
   * Update API key scopes
   */
  async updateScopes(id: string, userId: string, scopes: string[]): Promise<boolean> {
    const result = await this.apiKeyRepo.update(
      { id, userId },
      { scopes },
    );
    return (result.affected ?? 0) > 0;
  }
}

