import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Redis service wrapper providing common Redis operations
 * with proper error handling and logging
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }

  /**
   * Get the raw Redis client for advanced operations
   */
  getClient(): Redis {
    return this.redis;
  }

  // ─────────────────────────────────────────────────────────────────
  // String Operations
  // ─────────────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, value);
      } else {
        await this.redis.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    return this.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      await this.redis.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      this.logger.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`Redis TTL error for key ${key}:`, error);
      return -2; // Key doesn't exist
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // JSON Operations (using strings with JSON serialization)
  // ─────────────────────────────────────────────────────────────────

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      this.logger.error(`Failed to parse JSON for key ${key}`);
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      return this.set(key, serialized, ttlSeconds);
    } catch (error) {
      this.logger.error(`Failed to serialize JSON for key ${key}:`, error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Set Operations
  // ─────────────────────────────────────────────────────────────────

  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Redis SADD error for key ${key}:`, error);
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.srem(key, ...members);
    } catch (error) {
      this.logger.error(`Redis SREM error for key ${key}:`, error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key);
    } catch (error) {
      this.logger.error(`Redis SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const result = await this.redis.sismember(key, member);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis SISMEMBER error for key ${key}:`, error);
      return false;
    }
  }

  async scard(key: string): Promise<number> {
    try {
      return await this.redis.scard(key);
    } catch (error) {
      this.logger.error(`Redis SCARD error for key ${key}:`, error);
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Hash Operations
  // ─────────────────────────────────────────────────────────────────

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.redis.hget(key, field);
    } catch (error) {
      this.logger.error(`Redis HGET error for key ${key}:`, error);
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.redis.hset(key, field, value);
      return true;
    } catch (error) {
      this.logger.error(`Redis HSET error for key ${key}:`, error);
      return false;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.redis.hgetall(key);
    } catch (error) {
      this.logger.error(`Redis HGETALL error for key ${key}:`, error);
      return {};
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      return await this.redis.hdel(key, ...fields);
    } catch (error) {
      this.logger.error(`Redis HDEL error for key ${key}:`, error);
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Counter Operations (for rate limiting)
  // ─────────────────────────────────────────────────────────────────

  async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (error) {
      this.logger.error(`Redis INCR error for key ${key}:`, error);
      return 0;
    }
  }

  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    try {
      const count = await this.redis.incr(key);
      // Only set expiry on first increment (when count is 1)
      if (count === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      return count;
    } catch (error) {
      this.logger.error(`Redis INCR with expiry error for key ${key}:`, error);
      return 0;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      return await this.redis.decr(key);
    } catch (error) {
      this.logger.error(`Redis DECR error for key ${key}:`, error);
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Pattern Operations
  // ─────────────────────────────────────────────────────────────────

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      this.logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
      return [];
    }
  }

  async scan(pattern: string, count = 100): Promise<string[]> {
    try {
      const results: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', count);
        cursor = nextCursor;
        results.push(...keys);
      } while (cursor !== '0');

      return results;
    } catch (error) {
      this.logger.error(`Redis SCAN error for pattern ${pattern}:`, error);
      return [];
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.scan(pattern);
      if (keys.length === 0) return 0;
      return await this.redis.del(...keys);
    } catch (error) {
      this.logger.error(`Redis DELETE pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Health Check
  // ─────────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis PING error:', error);
      return false;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      const result = await this.redis.ping();
      const latency = Date.now() - start;

      if (result === 'PONG') {
        return { healthy: true, latency };
      }
      return { healthy: false, error: 'Unexpected PING response' };
    } catch (error) {
      return { healthy: false, error: (error as Error).message };
    }
  }
}
