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
});
