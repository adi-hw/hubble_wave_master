import { JwtRevocationAdapter } from './jwt-revocation.adapter';
import { RedisService } from '@hubblewave/redis';

/**
 * Coverage for the F002 JwtRevocationPort implementation. Two surfaces:
 *   - per-session revocation: presence of jwt:revoked:session:{sid}
 *   - per-user revoke-before: iat < jwt:revoke-before:{uid}
 */

function buildRedisMock() {
  const store = new Map<string, string>();
  return {
    store,
    redis: {
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
        return true;
      }),
      exists: jest.fn(async (k: string) => store.has(k)),
    } as unknown as RedisService,
  };
}

describe('JwtRevocationAdapter', () => {
  describe('isRevoked', () => {
    it('returns true when the session has been explicitly revoked', async () => {
      const { redis, store } = buildRedisMock();
      store.set('jwt:revoked:session:sess-1', '1700000000');
      const adapter = new JwtRevocationAdapter(redis);

      await expect(
        adapter.isRevoked({ userId: 'u-1', sessionId: 'sess-1', iat: 1700000010 }),
      ).resolves.toBe(true);
    });

    it('returns false when the session key is absent and no revoke-before is set', async () => {
      const { redis } = buildRedisMock();
      const adapter = new JwtRevocationAdapter(redis);

      await expect(
        adapter.isRevoked({ userId: 'u-1', sessionId: 'sess-1', iat: 1700000010 }),
      ).resolves.toBe(false);
    });

    it('returns true when the token was issued before the per-user revoke-before cut-off', async () => {
      const { redis, store } = buildRedisMock();
      store.set('jwt:revoke-before:u-1', '1700000100');
      const adapter = new JwtRevocationAdapter(redis);

      await expect(
        adapter.isRevoked({ userId: 'u-1', iat: 1700000050 }),
      ).resolves.toBe(true);
    });

    it('returns false when the token was issued after the revoke-before cut-off', async () => {
      const { redis, store } = buildRedisMock();
      store.set('jwt:revoke-before:u-1', '1700000050');
      const adapter = new JwtRevocationAdapter(redis);

      await expect(
        adapter.isRevoked({ userId: 'u-1', iat: 1700000100 }),
      ).resolves.toBe(false);
    });

    it('returns false when no iat is present (revoke-before branch cannot fire)', async () => {
      const { redis, store } = buildRedisMock();
      store.set('jwt:revoke-before:u-1', '1700000050');
      const adapter = new JwtRevocationAdapter(redis);

      await expect(adapter.isRevoked({ userId: 'u-1' })).resolves.toBe(false);
    });

    it('ignores a non-numeric revoke-before value defensively', async () => {
      const { redis, store } = buildRedisMock();
      store.set('jwt:revoke-before:u-1', 'corrupted');
      const adapter = new JwtRevocationAdapter(redis);

      await expect(
        adapter.isRevoked({ userId: 'u-1', iat: 1700000050 }),
      ).resolves.toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('writes a per-session revocation key with the 24h TTL', async () => {
      const { redis } = buildRedisMock();
      const adapter = new JwtRevocationAdapter(redis);

      await adapter.revokeSession('sess-1');
      expect((redis as unknown as { set: jest.Mock }).set).toHaveBeenCalledWith(
        'jwt:revoked:session:sess-1',
        expect.any(String),
        24 * 60 * 60,
      );
    });

    it('is a no-op for an empty session id', async () => {
      const { redis } = buildRedisMock();
      const adapter = new JwtRevocationAdapter(redis);

      await adapter.revokeSession('');
      expect((redis as unknown as { set: jest.Mock }).set).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllUserTokens', () => {
    it('writes a revoke-before timestamp keyed on userId', async () => {
      const { redis } = buildRedisMock();
      const adapter = new JwtRevocationAdapter(redis);

      await adapter.revokeAllUserTokens('u-1', 1700000000);
      expect((redis as unknown as { set: jest.Mock }).set).toHaveBeenCalledWith(
        'jwt:revoke-before:u-1',
        '1700000000',
        24 * 60 * 60,
      );
    });

    it('defaults to "now" when no cutoff is supplied', async () => {
      const { redis } = buildRedisMock();
      const adapter = new JwtRevocationAdapter(redis);

      const before = Math.floor(Date.now() / 1000);
      await adapter.revokeAllUserTokens('u-1');
      const after = Math.floor(Date.now() / 1000);

      const call = (redis as unknown as { set: jest.Mock }).set.mock.calls[0];
      expect(call[0]).toBe('jwt:revoke-before:u-1');
      const written = Number(call[1]);
      expect(written).toBeGreaterThanOrEqual(before);
      expect(written).toBeLessThanOrEqual(after);
    });

    it('is a no-op for an empty user id', async () => {
      const { redis } = buildRedisMock();
      const adapter = new JwtRevocationAdapter(redis);

      await adapter.revokeAllUserTokens('');
      expect((redis as unknown as { set: jest.Mock }).set).not.toHaveBeenCalled();
    });
  });
});
