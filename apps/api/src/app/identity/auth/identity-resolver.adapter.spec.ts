import { Repository } from 'typeorm';
import { User } from '@hubblewave/instance-db';
import { IdentityResolverAdapter } from './identity-resolver.adapter';
import { PermissionResolverService } from '../roles/permission-resolver.service';
import { RedisService } from '@hubblewave/redis';

/**
 * Coverage for the F013 IdentityResolverPort implementation. Verifies:
 *   - DB lookup + permission resolution produce the canonical role set
 *   - cache hit short-circuits the DB query
 *   - unknown user returns null without throwing
 *   - invalidate() clears the cache key
 */

function buildRedisMock(initialJson?: unknown) {
  let stored: unknown = initialJson ?? null;
  return {
    getJson: jest.fn(async () => stored),
    setJson: jest.fn(async (_k: string, v: unknown) => {
      stored = v;
      return true;
    }),
    del: jest.fn(async () => {
      stored = null;
      return true;
    }),
  } as unknown as RedisService;
}

function buildUserRepoMock(user: Partial<User> | null) {
  return {
    findOne: jest.fn(async () => user),
  } as unknown as Repository<User>;
}

function buildPermResolverMock(roleCodes: string[], permissions: string[]) {
  return {
    getUserPermissions: jest.fn(async () => ({
      userId: 'u-1',
      permissions: new Set(permissions),
      permissionDetails: new Map(),
      roleIds: [],
      roles: roleCodes.map((code) => ({ code }) as { code: string }),
      computedAt: new Date(),
      expiresAt: new Date(),
    })),
  } as unknown as PermissionResolverService;
}

describe('IdentityResolverAdapter', () => {
  it('returns null for an empty userId without touching DB or cache', async () => {
    const redis = buildRedisMock();
    const repo = buildUserRepoMock(null);
    const perms = buildPermResolverMock([], []);
    const adapter = new IdentityResolverAdapter(repo, perms, redis);

    await expect(adapter.resolveIdentity('')).resolves.toBeNull();
    expect((repo as unknown as { findOne: jest.Mock }).findOne).not.toHaveBeenCalled();
  });

  it('hits the cache when a fresh entry exists', async () => {
    const cached = {
      userId: 'u-1',
      roles: ['user'],
      permissions: ['p1'],
      isAdmin: false,
      status: 'active',
      securityStamp: 'stamp-cached-1',
    };
    const redis = buildRedisMock(cached);
    const repo = buildUserRepoMock(null);
    const perms = buildPermResolverMock([], []);
    const adapter = new IdentityResolverAdapter(repo, perms, redis);

    const result = await adapter.resolveIdentity('u-1');
    expect(result).toEqual(cached);
    // No DB call on cache hit
    expect((repo as unknown as { findOne: jest.Mock }).findOne).not.toHaveBeenCalled();
  });

  it('falls through to the DB and seeds the cache on a miss (includes securityStamp)', async () => {
    const redis = buildRedisMock();
    const repo = buildUserRepoMock({
      id: 'u-1',
      status: 'active',
      isAdmin: false,
      securityStamp: 'stamp-from-db-9',
    } as Partial<User>);
    const perms = buildPermResolverMock(['user'], ['records.read']);
    const adapter = new IdentityResolverAdapter(repo, perms, redis);

    const result = await adapter.resolveIdentity('u-1');
    expect(result).toEqual({
      userId: 'u-1',
      roles: ['user'],
      permissions: ['records.read'],
      isAdmin: false,
      status: 'active',
      securityStamp: 'stamp-from-db-9',
    });
    expect((redis as unknown as { setJson: jest.Mock }).setJson).toHaveBeenCalledWith(
      'authz:identity:u-1',
      expect.objectContaining({
        userId: 'u-1',
        securityStamp: 'stamp-from-db-9',
      }),
      60,
    );
  });

  it('returns the user current securityStamp value (canon §29.6)', async () => {
    const redis = buildRedisMock();
    const repo = buildUserRepoMock({
      id: 'u-1',
      status: 'active',
      isAdmin: false,
      securityStamp: 'stamp-fresh-100',
    } as Partial<User>);
    const perms = buildPermResolverMock(['user'], []);
    const adapter = new IdentityResolverAdapter(repo, perms, redis);

    const result = await adapter.resolveIdentity('u-1');
    expect(result?.securityStamp).toBe('stamp-fresh-100');
  });

  it('flags isAdmin when the user holds an admin role', async () => {
    const redis = buildRedisMock();
    const repo = buildUserRepoMock({
      id: 'u-1',
      status: 'active',
      isAdmin: false,
    } as Partial<User>);
    const perms = buildPermResolverMock(['admin'], []);
    const adapter = new IdentityResolverAdapter(repo, perms, redis);

    const result = await adapter.resolveIdentity('u-1');
    expect(result?.isAdmin).toBe(true);
  });

  it('flags isAdmin when the user has the isAdmin column set even without an admin role', async () => {
    const redis = buildRedisMock();
    const repo = buildUserRepoMock({
      id: 'u-1',
      status: 'active',
      isAdmin: true,
    } as Partial<User>);
    const perms = buildPermResolverMock(['user'], []);
    const adapter = new IdentityResolverAdapter(repo, perms, redis);

    const result = await adapter.resolveIdentity('u-1');
    expect(result?.isAdmin).toBe(true);
  });

  it('returns null when the user record is missing', async () => {
    const redis = buildRedisMock();
    const repo = buildUserRepoMock(null);
    const perms = buildPermResolverMock([], []);
    const adapter = new IdentityResolverAdapter(repo, perms, redis);

    await expect(adapter.resolveIdentity('ghost')).resolves.toBeNull();
  });

  it('invalidate() drops the cache key', async () => {
    const redis = buildRedisMock();
    const adapter = new IdentityResolverAdapter(
      buildUserRepoMock(null),
      buildPermResolverMock([], []),
      redis,
    );

    await adapter.invalidate('u-1');
    expect((redis as unknown as { del: jest.Mock }).del).toHaveBeenCalledWith(
      'authz:identity:u-1',
    );
  });
});
