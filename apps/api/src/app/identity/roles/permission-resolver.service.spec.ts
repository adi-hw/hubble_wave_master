import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  GroupMember,
  GroupRole,
  Role,
  RolePermission,
  UserRole,
} from '@hubblewave/instance-db';
import { EventBusService, EventTopic } from '@hubblewave/event-bus';

import { PermissionResolverService } from './permission-resolver.service';

/**
 * Minimal stand-in for EventBusService that lets tests publish synthetic
 * events back to the resolver as if they came from Redis.
 */
class FakeEventBus {
  private handlers = new Map<string, Array<(payload: unknown) => unknown>>();

  subscribe<T>(topic: string, handler: (payload: T) => unknown): void {
    const existing = this.handlers.get(topic) ?? [];
    existing.push(handler as (payload: unknown) => unknown);
    this.handlers.set(topic, existing);
  }

  // Test-only: simulate a published event reaching the subscriber side.
  async deliver(topic: string, payload: unknown): Promise<void> {
    const handlers = this.handlers.get(topic) ?? [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }

  publish(): Promise<void> {
    return Promise.resolve();
  }
}

describe('PermissionResolverService', () => {
  let service: PermissionResolverService;
  let bus: FakeEventBus;

  const mockUserRoleRepo = {
    find: jest.fn().mockResolvedValue([]),
  };
  const mockRolePermissionRepo = { find: jest.fn().mockResolvedValue([]) };
  const mockRoleRepo = { find: jest.fn().mockResolvedValue([]) };
  const mockGroupRoleRepo = { find: jest.fn().mockResolvedValue([]) };
  const mockGroupMemberRepo = { find: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRoleRepo.find.mockResolvedValue([]);
    bus = new FakeEventBus();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionResolverService,
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        {
          provide: getRepositoryToken(RolePermission),
          useValue: mockRolePermissionRepo,
        },
        { provide: getRepositoryToken(UserRole), useValue: mockUserRoleRepo },
        {
          provide: getRepositoryToken(GroupRole),
          useValue: mockGroupRoleRepo,
        },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: mockGroupMemberRepo,
        },
        { provide: EventBusService, useValue: bus },
      ],
    }).compile();

    service = module.get<PermissionResolverService>(PermissionResolverService);
    service.onModuleInit();
  });

  function seedCache(userId: string): void {
    const future = new Date(Date.now() + 60_000);
    // Using `any` here is fine — the test only needs the entry to exist so
    // we can prove invalidation removed it.
    (service as unknown as {
      cache: Map<string, { userId: string; expiresAt: Date }>;
    }).cache.set(userId, { userId, expiresAt: future });
  }

  function isCached(userId: string): boolean {
    return (service as unknown as { cache: Map<string, unknown> }).cache.has(
      userId,
    );
  }

  it('clears the cached entry for a user when identity.user-role.changed fires', async () => {
    seedCache('user-1');
    seedCache('user-2');
    expect(isCached('user-1')).toBe(true);

    await bus.deliver(EventTopic.IdentityUserRoleChanged, {
      userIds: ['user-1'],
    });

    expect(isCached('user-1')).toBe(false);
    expect(isCached('user-2')).toBe(true);
  });

  it('clears multiple users in a single user-role event', async () => {
    seedCache('user-a');
    seedCache('user-b');
    seedCache('user-c');

    await bus.deliver(EventTopic.IdentityUserRoleChanged, {
      userIds: ['user-a', 'user-b'],
    });

    expect(isCached('user-a')).toBe(false);
    expect(isCached('user-b')).toBe(false);
    expect(isCached('user-c')).toBe(true);
  });

  it('clears all users holding a role when identity.role-permission.changed fires', async () => {
    seedCache('user-1');
    seedCache('user-2');
    seedCache('unrelated');

    mockUserRoleRepo.find.mockResolvedValueOnce([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);

    await bus.deliver(EventTopic.IdentityRolePermissionChanged, {
      roleIds: ['role-x'],
    });

    expect(mockUserRoleRepo.find).toHaveBeenCalledWith({
      where: { roleId: 'role-x' },
      select: ['userId'],
    });
    expect(isCached('user-1')).toBe(false);
    expect(isCached('user-2')).toBe(false);
    expect(isCached('unrelated')).toBe(true);
  });

  it('clears users when identity.group-membership.changed fires', async () => {
    seedCache('user-1');
    seedCache('other');

    await bus.deliver(EventTopic.IdentityGroupMembershipChanged, {
      userIds: ['user-1'],
    });

    expect(isCached('user-1')).toBe(false);
    expect(isCached('other')).toBe(true);
  });

  it('uses a 30-second fallback TTL on the in-memory cache', () => {
    const ttl = (
      service as unknown as { CACHE_TTL_MS: number }
    ).CACHE_TTL_MS;
    expect(ttl).toBe(30 * 1000);
  });

  it('tolerates events with empty/missing userIds gracefully', async () => {
    seedCache('user-1');

    await bus.deliver(EventTopic.IdentityUserRoleChanged, {});
    await bus.deliver(EventTopic.IdentityUserRoleChanged, { userIds: [] });

    expect(isCached('user-1')).toBe(true);
  });

  // ── W6.D / F047 — getUserGroupsBatch tests ─────────────────────────────────

  describe('getUserGroupsBatch', () => {
    it('returns an empty map when given an empty userIds list', async () => {
      const result = await service.getUserGroupsBatch([]);
      expect(result.size).toBe(0);
      expect(mockGroupMemberRepo.find).not.toHaveBeenCalled();
    });

    it('issues ONE query for N users — not N queries', async () => {
      const userIds = ['u-1', 'u-2', 'u-3', 'u-4', 'u-5'];

      mockGroupMemberRepo.find.mockResolvedValueOnce([
        { userId: 'u-1', groupId: 'g-a' },
        { userId: 'u-1', groupId: 'g-b' },
        { userId: 'u-3', groupId: 'g-c' },
      ]);

      await service.getUserGroupsBatch(userIds);

      // Single call with IN predicate — not one call per user.
      expect(mockGroupMemberRepo.find).toHaveBeenCalledTimes(1);
      expect(mockGroupMemberRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: expect.anything() },
        }),
      );
    });

    it('buckets results correctly per userId', async () => {
      mockGroupMemberRepo.find.mockResolvedValueOnce([
        { userId: 'u-1', groupId: 'g-a' },
        { userId: 'u-1', groupId: 'g-b' },
        { userId: 'u-2', groupId: 'g-c' },
      ]);

      const result = await service.getUserGroupsBatch(['u-1', 'u-2', 'u-3']);

      expect(result.get('u-1')).toEqual(expect.arrayContaining(['g-a', 'g-b']));
      expect(result.get('u-1')).toHaveLength(2);
      expect(result.get('u-2')).toEqual(['g-c']);
      expect(result.get('u-3')).toEqual([]);
    });

    it('uses the request-scoped cache on a cache hit — issues ZERO additional queries', async () => {
      const groupCacheCtx = new Map<string, string[]>([
        ['u-1', ['g-a', 'g-b']],
        ['u-2', ['g-c']],
      ]);

      const result = await service.getUserGroupsBatch(['u-1', 'u-2'], groupCacheCtx);

      // Both users were in the cache; no DB query should have been issued.
      expect(mockGroupMemberRepo.find).not.toHaveBeenCalled();
      expect(result.get('u-1')).toEqual(['g-a', 'g-b']);
      expect(result.get('u-2')).toEqual(['g-c']);
    });

    it('issues ONE query only for uncached users when ctx cache is partially warm', async () => {
      const groupCacheCtx = new Map<string, string[]>([
        ['u-1', ['g-a']],
      ]);

      mockGroupMemberRepo.find.mockResolvedValueOnce([
        { userId: 'u-2', groupId: 'g-b' },
      ]);

      const result = await service.getUserGroupsBatch(['u-1', 'u-2'], groupCacheCtx);

      // Only u-2 was uncached; find called once.
      expect(mockGroupMemberRepo.find).toHaveBeenCalledTimes(1);
      expect(result.get('u-1')).toEqual(['g-a']);
      expect(result.get('u-2')).toEqual(['g-b']);

      // Cache was updated with the newly resolved entry.
      expect(groupCacheCtx.get('u-2')).toEqual(['g-b']);
    });

    it('populates the ctx cache with DB results for future calls', async () => {
      const groupCacheCtx = new Map<string, string[]>();

      mockGroupMemberRepo.find.mockResolvedValueOnce([
        { userId: 'u-1', groupId: 'g-x' },
      ]);

      await service.getUserGroupsBatch(['u-1'], groupCacheCtx);
      expect(groupCacheCtx.get('u-1')).toEqual(['g-x']);

      // Second call — same ctx — should hit the cache, no new DB query.
      mockGroupMemberRepo.find.mockClear();
      const result2 = await service.getUserGroupsBatch(['u-1'], groupCacheCtx);
      expect(mockGroupMemberRepo.find).not.toHaveBeenCalled();
      expect(result2.get('u-1')).toEqual(['g-x']);
    });

    it('returns empty arrays for users with no group memberships', async () => {
      mockGroupMemberRepo.find.mockResolvedValueOnce([]);

      const result = await service.getUserGroupsBatch(['u-no-groups']);

      expect(result.get('u-no-groups')).toEqual([]);
    });

    it('falls through to in-process permission cache when it is warm', async () => {
      const future = new Date(Date.now() + 60_000);
      // Seed the permission cache with a warm entry that already has groupIds.
      (service as unknown as {
        cache: Map<string, { userId: string; expiresAt: Date; groupIds: string[] }>;
      }).cache.set('u-warm', {
        userId: 'u-warm',
        expiresAt: future,
        groupIds: ['g-warm-1'],
      });

      const result = await service.getUserGroupsBatch(['u-warm']);

      // Permission cache was warm — no DB query issued.
      expect(mockGroupMemberRepo.find).not.toHaveBeenCalled();
      expect(result.get('u-warm')).toEqual(['g-warm-1']);
    });
  });
});
