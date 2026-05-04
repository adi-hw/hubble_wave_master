import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@hubblewave/redis';
import { AutomationRateLimiterService } from './automation-rate-limiter.service';

/**
 * In-memory Redis double tailored to the surface AutomationRateLimiterService
 * uses (incr / decr / del / expire / ttl / incrWithExpiry). Faithful enough
 * to verify the limiter's atomicity assumptions without a Redis container.
 */
class InMemoryRedisDouble {
  counters = new Map<string, number>();
  ttls = new Map<string, number>();

  async incr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }

  async decr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) - 1;
    this.counters.set(key, next);
    return next;
  }

  async del(key: string): Promise<boolean> {
    this.counters.delete(key);
    this.ttls.delete(key);
    return true;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    this.ttls.set(key, ttlSeconds);
    return true;
  }

  async ttl(key: string): Promise<number> {
    return this.ttls.get(key) ?? -1;
  }

  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const next = await this.incr(key);
    if (next === 1) {
      await this.expire(key, ttlSeconds);
    }
    return next;
  }

  /** Test helper — simulates the rate window expiring. */
  resetWindow(prefix = ''): void {
    for (const key of [...this.counters.keys()]) {
      if (key.startsWith(prefix)) {
        this.counters.delete(key);
        this.ttls.delete(key);
      }
    }
  }
}

describe('AutomationRateLimiterService', () => {
  let limiter: AutomationRateLimiterService;
  let redis: InMemoryRedisDouble;

  const buildLimiter = async (overrides: Record<string, string> = {}) => {
    redis = new InMemoryRedisDouble();
    const configValues: Record<string, string> = {
      AUTOMATION_PER_AUTOMATION_CONCURRENCY: '3',
      AUTOMATION_PER_AUTOMATION_RATE_MAX: '5',
      AUTOMATION_PER_AUTOMATION_RATE_DURATION_MS: '60000',
      ...overrides,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationRateLimiterService,
        { provide: RedisService, useValue: redis },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => configValues[key],
          },
        },
      ],
    }).compile();

    limiter = module.get(AutomationRateLimiterService);
  };

  describe('configuration', () => {
    it('reads concurrency / rate / duration from config with defaults', async () => {
      await buildLimiter();
      expect(limiter.getConcurrencyCap()).toBe(3);
      expect(limiter.getRateMax()).toBe(5);
      expect(limiter.getRateDurationMs()).toBe(60_000);
      expect(limiter.isEnabled()).toBe(true);
    });

    it('falls back to documented defaults when env / config absent', async () => {
      const noConfigLimiter = new AutomationRateLimiterService(null, undefined);
      expect(noConfigLimiter.getConcurrencyCap()).toBe(3);
      expect(noConfigLimiter.getRateMax()).toBe(100);
      expect(noConfigLimiter.getRateDurationMs()).toBe(60_000);
      expect(noConfigLimiter.isEnabled()).toBe(false);
    });
  });

  describe('without Redis', () => {
    it('always allows when Redis is not wired (degrades to current behavior)', async () => {
      const noRedisLimiter = new AutomationRateLimiterService(null);
      const decision = await noRedisLimiter.tryAcquire('rule-1');
      expect(decision.allowed).toBe(true);
      await noRedisLimiter.release('rule-1');
    });
  });

  describe('per-automation concurrency', () => {
    it('admits up to the cap of concurrent jobs for one automation', async () => {
      await buildLimiter();
      const decisions = await Promise.all([
        limiter.tryAcquire('rule-A'),
        limiter.tryAcquire('rule-A'),
        limiter.tryAcquire('rule-A'),
      ]);
      expect(decisions.every((d) => d.allowed)).toBe(true);
    });

    it('refuses the next concurrent job once the cap is reached', async () => {
      await buildLimiter();
      await limiter.tryAcquire('rule-A');
      await limiter.tryAcquire('rule-A');
      await limiter.tryAcquire('rule-A');

      const fourth = await limiter.tryAcquire('rule-A');
      expect(fourth.allowed).toBe(false);
      expect(fourth.reason).toBe('concurrency');
      expect(fourth.retryAfterMs).toBeGreaterThan(0);
    });

    it('frees the slot on release and admits the next job', async () => {
      await buildLimiter();
      await limiter.tryAcquire('rule-A');
      await limiter.tryAcquire('rule-A');
      await limiter.tryAcquire('rule-A');
      expect((await limiter.tryAcquire('rule-A')).allowed).toBe(false);

      await limiter.release('rule-A');
      const next = await limiter.tryAcquire('rule-A');
      expect(next.allowed).toBe(true);
    });

    it('schedules 10 jobs for the same automation; only N execute concurrently', async () => {
      await buildLimiter({
        AUTOMATION_PER_AUTOMATION_CONCURRENCY: '4',
        AUTOMATION_PER_AUTOMATION_RATE_MAX: '1000',
      });
      const decisions = await Promise.all(
        Array.from({ length: 10 }, () => limiter.tryAcquire('rule-loopy')),
      );
      const admitted = decisions.filter((d) => d.allowed).length;
      const deferred = decisions.filter((d) => !d.allowed && d.reason === 'concurrency').length;
      expect(admitted).toBe(4);
      expect(deferred).toBe(6);
    });

    it('schedules 10 jobs for different automations; all start concurrently', async () => {
      await buildLimiter({
        AUTOMATION_PER_AUTOMATION_CONCURRENCY: '2',
        AUTOMATION_PER_AUTOMATION_RATE_MAX: '1000',
      });
      const decisions = await Promise.all(
        Array.from({ length: 10 }, (_, i) => limiter.tryAcquire(`rule-${i}`)),
      );
      expect(decisions.every((d) => d.allowed)).toBe(true);
    });

    it('isolates concurrency caps between automations (one runaway does not block others)', async () => {
      await buildLimiter({
        AUTOMATION_PER_AUTOMATION_CONCURRENCY: '2',
        AUTOMATION_PER_AUTOMATION_RATE_MAX: '1000',
      });
      await limiter.tryAcquire('runaway');
      await limiter.tryAcquire('runaway');
      const runawayBlocked = await limiter.tryAcquire('runaway');
      expect(runawayBlocked.allowed).toBe(false);

      const innocent = await limiter.tryAcquire('innocent');
      expect(innocent.allowed).toBe(true);
    });
  });

  describe('per-automation rate window', () => {
    it('admits up to the rate-max within the window', async () => {
      await buildLimiter({
        AUTOMATION_PER_AUTOMATION_CONCURRENCY: '1000',
        AUTOMATION_PER_AUTOMATION_RATE_MAX: '5',
      });
      for (let i = 0; i < 5; i++) {
        const decision = await limiter.tryAcquire('rule-bursty');
        expect(decision.allowed).toBe(true);
        await limiter.release('rule-bursty');
      }
    });

    it('rate limit kicks in after the per-window max', async () => {
      await buildLimiter({
        AUTOMATION_PER_AUTOMATION_CONCURRENCY: '1000',
        AUTOMATION_PER_AUTOMATION_RATE_MAX: '5',
      });
      for (let i = 0; i < 5; i++) {
        await limiter.tryAcquire('rule-bursty');
        await limiter.release('rule-bursty');
      }

      const sixth = await limiter.tryAcquire('rule-bursty');
      expect(sixth.allowed).toBe(false);
      expect(sixth.reason).toBe('rate-window');
      expect(sixth.retryAfterMs).toBeGreaterThan(0);
    });

    it('admits again once the window resets', async () => {
      await buildLimiter({
        AUTOMATION_PER_AUTOMATION_CONCURRENCY: '1000',
        AUTOMATION_PER_AUTOMATION_RATE_MAX: '2',
      });
      await limiter.tryAcquire('rule-bursty');
      await limiter.release('rule-bursty');
      await limiter.tryAcquire('rule-bursty');
      await limiter.release('rule-bursty');
      expect((await limiter.tryAcquire('rule-bursty')).allowed).toBe(false);

      // Simulate window expiry.
      redis.resetWindow('automation:rate-limit:rate:');
      const decision = await limiter.tryAcquire('rule-bursty');
      expect(decision.allowed).toBe(true);
    });

    it('isolates rate windows between automations', async () => {
      await buildLimiter({
        AUTOMATION_PER_AUTOMATION_CONCURRENCY: '1000',
        AUTOMATION_PER_AUTOMATION_RATE_MAX: '2',
      });
      await limiter.tryAcquire('chatty');
      await limiter.release('chatty');
      await limiter.tryAcquire('chatty');
      await limiter.release('chatty');
      expect((await limiter.tryAcquire('chatty')).allowed).toBe(false);

      const quiet = await limiter.tryAcquire('quiet');
      expect(quiet.allowed).toBe(true);
    });
  });

  describe('release', () => {
    it('cleans up the active counter when it reaches zero', async () => {
      await buildLimiter();
      await limiter.tryAcquire('rule-A');
      await limiter.release('rule-A');
      expect(redis.counters.get('automation:rate-limit:active:rule-A')).toBeUndefined();
    });

    it('is a no-op when automationId is empty', async () => {
      await buildLimiter();
      await expect(limiter.release('')).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('allows the job when Redis errors during rate-window check', async () => {
      await buildLimiter();
      jest.spyOn(redis, 'incrWithExpiry').mockRejectedValueOnce(new Error('boom'));
      const decision = await limiter.tryAcquire('rule-A');
      expect(decision.allowed).toBe(true);
    });

    it('allows the job when Redis errors during concurrency check', async () => {
      await buildLimiter();
      jest.spyOn(redis, 'incr').mockRejectedValueOnce(new Error('boom'));
      const decision = await limiter.tryAcquire('rule-A');
      expect(decision.allowed).toBe(true);
    });
  });
});
