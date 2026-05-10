/**
 * AutomationRateLimiterService
 *
 * Per-automation concurrency and rate-window limiter for the BullMQ scheduler.
 *
 * BullMQ open-source (5.x) supports a flat queue-wide limiter only; per-key
 * grouping is a Pro feature. This service implements per-automation limits on
 * top of the queue-wide worker by tracking two counters per automationId in
 * Redis:
 *
 *   - active:<automationId>  -> in-flight job count (incremented on tryAcquire,
 *                               decremented on release). No TTL; bounded by job
 *                               lifetime. A safety TTL is set so leaked counters
 *                               cannot accumulate forever.
 *   - rate:<automationId>    -> jobs admitted in the current rolling window;
 *                               TTL set on first INCR equal to the window length.
 *
 * If either limit is exceeded, tryAcquire returns retryAfterMs so the worker
 * can park the job via job.moveToDelayed(...). When Redis is unavailable, the
 * limiter is a no-op (allows everything) so single-instance development without
 * Redis remains functional.
 *
 * Defaults (overridable via env):
 *   AUTOMATION_PER_AUTOMATION_CONCURRENCY        = 3
 *   AUTOMATION_PER_AUTOMATION_RATE_MAX           = 100
 *   AUTOMATION_PER_AUTOMATION_RATE_DURATION_MS   = 60000
 *
 * Refs Part 2 Fix 14 of the architectural remediation plan (Wave 7 / W7.C).
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@hubblewave/redis';

const KEY_PREFIX = 'automation:rate-limit';
// Safety TTL for the active counter. If a job crashes the process between
// tryAcquire and release, the counter must eventually drop to zero so the
// automation is not permanently blocked. Sized at 10x the default lock
// timeout (60s) to comfortably exceed any in-flight job.
const ACTIVE_TTL_SECONDS = 600;

export interface RateLimiterDecision {
  allowed: boolean;
  /** When `allowed` is false, milliseconds the caller should defer before retrying. */
  retryAfterMs?: number;
  /** Reason for refusal (for logging). */
  reason?: 'concurrency' | 'rate-window';
}

@Injectable()
export class AutomationRateLimiterService {
  private readonly logger = new Logger(AutomationRateLimiterService.name);

  private readonly concurrencyCap: number;
  private readonly rateMax: number;
  private readonly rateDurationMs: number;

  constructor(
    @Optional() @Inject(RedisService) private readonly redis: RedisService | null = null,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService,
  ) {
    this.concurrencyCap = this.readNumberConfig(
      'AUTOMATION_PER_AUTOMATION_CONCURRENCY',
      3,
    );
    this.rateMax = this.readNumberConfig(
      'AUTOMATION_PER_AUTOMATION_RATE_MAX',
      100,
    );
    this.rateDurationMs = this.readNumberConfig(
      'AUTOMATION_PER_AUTOMATION_RATE_DURATION_MS',
      60_000,
    );
  }

  isEnabled(): boolean {
    return !!this.redis;
  }

  getConcurrencyCap(): number {
    return this.concurrencyCap;
  }

  getRateMax(): number {
    return this.rateMax;
  }

  getRateDurationMs(): number {
    return this.rateDurationMs;
  }

  /**
   * Atomically check and reserve a slot for `automationId`. Increments both the
   * concurrency counter and the rate-window counter; if either limit is
   * breached, the reservation is rolled back and the caller is told how long
   * to defer.
   */
  async tryAcquire(automationId: string): Promise<RateLimiterDecision> {
    if (!this.redis || !automationId) {
      return { allowed: true };
    }

    const activeKey = this.activeKey(automationId);
    const rateKey = this.rateKey(automationId);

    // Step 1 — admit by rate window. INCR with TTL on first hit.
    let rateCount: number;
    try {
      const rateTtlSeconds = Math.max(1, Math.ceil(this.rateDurationMs / 1000));
      rateCount = await this.redis.incrWithExpiry(rateKey, rateTtlSeconds);
    } catch (error) {
      this.logger.warn(
        `Rate-window check failed for ${automationId}; allowing job: ${(error as Error).message}`,
      );
      return { allowed: true };
    }

    if (rateCount > this.rateMax) {
      // Window limit breached. The increment cannot be safely rolled back
      // (other processes may have observed the higher value), but the TTL
      // ensures the counter resets at the end of the window. Tell the caller
      // to defer until the window rolls.
      const ttlSeconds = await this.safeTtl(rateKey);
      const retryAfterMs =
        ttlSeconds > 0 ? ttlSeconds * 1000 : this.rateDurationMs;
      return {
        allowed: false,
        retryAfterMs,
        reason: 'rate-window',
      };
    }

    // Step 2 — admit by concurrency. INCR; if over cap, DECR to release.
    let activeCount: number;
    try {
      activeCount = await this.redis.incr(activeKey);
      // Refresh safety TTL on every increment so a long-lived steady state
      // does not eventually expire the counter mid-flight.
      await this.redis.expire(activeKey, ACTIVE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        `Concurrency check failed for ${automationId}; allowing job: ${(error as Error).message}`,
      );
      return { allowed: true };
    }

    if (activeCount > this.concurrencyCap) {
      // Roll back the active counter; defer for a short interval.
      try {
        await this.redis.decr(activeKey);
      } catch {
        // Best-effort; safety TTL will reclaim the slot.
      }
      // Concurrency caps clear as soon as another job in this group finishes.
      // Defer briefly rather than waiting the full rate window.
      return {
        allowed: false,
        retryAfterMs: 1_000,
        reason: 'concurrency',
      };
    }

    return { allowed: true };
  }

  /**
   * Decrement the in-flight counter for an automation. Always pairs with a
   * successful `tryAcquire`. Safe to call after Redis errors — DECR clamps at
   * zero implicitly via the safety TTL.
   */
  async release(automationId: string): Promise<void> {
    if (!this.redis || !automationId) {
      return;
    }

    try {
      const activeKey = this.activeKey(automationId);
      const value = await this.redis.decr(activeKey);
      if (value <= 0) {
        // Clean up so an idle automation does not leave keys in Redis.
        await this.redis.del(activeKey);
      }
    } catch (error) {
      this.logger.warn(
        `Release failed for ${automationId}: ${(error as Error).message}`,
      );
    }
  }

  private activeKey(automationId: string): string {
    return `${KEY_PREFIX}:active:${automationId}`;
  }

  private rateKey(automationId: string): string {
    return `${KEY_PREFIX}:rate:${automationId}`;
  }

  private async safeTtl(key: string): Promise<number> {
    if (!this.redis) {
      return -2;
    }
    try {
      return await this.redis.ttl(key);
    } catch {
      return -2;
    }
  }

  private readNumberConfig(key: string, fallback: number): number {
    const raw =
      this.configService?.get<string>(key) ?? process.env[key] ?? `${fallback}`;
    const parsed = parseInt(`${raw}`, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
