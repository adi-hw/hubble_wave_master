import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '@hubblewave/instance-db';
import {
  IdentityResolverPort,
  ResolvedIdentity,
} from '@hubblewave/auth-guard';
import { In } from 'typeorm';
import { RedisService } from '@hubblewave/redis';
import {
  EventBusService,
  EventTopic,
  PermissionInvalidatePayload,
} from '@hubblewave/event-bus';
import { PermissionResolverService } from '../roles/permission-resolver.service';

/**
 * Cache TTL for resolved-identity entries in Redis. Short enough that role
 * revocations propagate quickly (worst case: <60s after the event bus
 * invalidation also fires), long enough to coalesce the per-request
 * resolves on a busy endpoint. Aligns with `PermissionResolverService`'s
 * in-process 30s TTL: each cache layer halves the wallclock latency the
 * other adds on a miss.
 */
const IDENTITY_CACHE_TTL_SECONDS = 60;
const IDENTITY_CACHE_KEY_PREFIX = 'authz:identity:';

/**
 * Wire-format for cached identity. Mirrors `ResolvedIdentity` exactly —
 * all six fields the port contract requires, including the W2 Stream 1
 * `roleIds` + `roleCodes` + `permissionCodes` split.
 */
interface CachedIdentity {
  userId: string;
  roleIds: string[];
  roleCodes: string[];
  permissionCodes: string[];
  groupIds: string[];
  isAdmin: boolean;
  status: string;
  securityStamp: string;
}

/**
 * F013 / IdentityResolverPort implementation backed by the instance DB.
 *
 * Walks the same path JwtStrategy uses (User lookup + PermissionResolver)
 * so the two authentication surfaces stay functionally consistent. Adds a
 * thin Redis cache so the per-request DB round trip the guard makes does
 * not turn into a hot loop on busy endpoints.
 *
 * Cache invalidation (W2 Stream 1 PR2 / F025): subscribes to the unified
 * `permission.invalidate` event bus channel and evicts Redis cache
 * entries on every relevant scope:
 *   - `identity`    → evict by `userIds`.
 *   - `permissions` → fan out from `roleIds` → users holding the role →
 *                     evict each. A role-permission change affects every
 *                     user holding the role, so the same fan-out the
 *                     PermissionResolverService does for the in-process
 *                     cache happens here for the Redis cache.
 *   - `acl`         → not the identity cache's concern; the
 *                     `AuthorizationService` handles ACL-rule cache.
 *
 * The 60s TTL remains as a safety net for missed-message scenarios — under
 * a healthy bus, role revocations propagate in well under a second.
 */
@Injectable()
export class IdentityResolverAdapter
  implements IdentityResolverPort, OnModuleInit
{
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    private readonly permissionResolver: PermissionResolverService,
    private readonly redis: RedisService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<PermissionInvalidatePayload>(
      EventTopic.PermissionInvalidate,
      async (payload) => {
        if (payload.scope === 'identity') {
          await Promise.all(
            (payload.userIds ?? []).map((userId) => this.invalidate(userId)),
          );
          return;
        }
        if (payload.scope === 'permissions') {
          // Fan out: every user holding the affected role(s) has stale
          // identity cache. Resolve users from the user_roles table.
          const roleIds = payload.roleIds ?? [];
          if (roleIds.length === 0) return;
          const rows = await this.userRoleRepo.find({
            where: { roleId: In(roleIds) },
            select: ['userId'],
          });
          const userIds = Array.from(new Set(rows.map((r) => r.userId)));
          await Promise.all(userIds.map((userId) => this.invalidate(userId)));
          return;
        }
        // payload.scope === 'acl' — out of scope here; AuthorizationService
        // owns the ACL-rule cache.
      },
    );
  }

  async resolveIdentity(userId: string): Promise<ResolvedIdentity | null> {
    if (!userId) return null;

    const cacheKey = `${IDENTITY_CACHE_KEY_PREFIX}${userId}`;
    const cached = await this.redis.getJson<CachedIdentity>(cacheKey);
    if (cached && cached.userId === userId) {
      return cached;
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return null;
    }

    // Resolve effective roles + permissions through the same path
    // JwtStrategy uses, so the guard and the strategy agree on what the
    // user can do right now.
    const { roles, permissions, groupIds: resolvedGroupIds } =
      await this.permissionResolver.getUserPermissions(userId);
    const roleIds = roles.map((r) => r.id);
    const roleCodes = roles.map((r) => r.code);
    const permissionCodes = Array.from(permissions);
    const isAdmin =
      roleCodes.includes('admin') ||
      roleCodes.includes('system_admin') ||
      roleCodes.includes('super_admin') ||
      user.isAdmin === true;

    const resolved: ResolvedIdentity = {
      userId: user.id,
      roleIds,
      roleCodes,
      permissionCodes,
      // W6.D / F047 — direct group IDs; surfaced here so JwtAuthGuard can
      // seed UserRequestContext.groupCache without an additional DB query.
      groupIds: resolvedGroupIds ?? [],
      isAdmin,
      status: user.status,
      // canon §29.6 — the kill-switch the guard compares to `token_version`.
      securityStamp: user.securityStamp,
    };

    // setJson swallows errors internally — a Redis outage degrades to a
    // direct-DB read on every request, which is correct fail-open
    // behavior (the runtime authz check is the actual gate).
    await this.redis.setJson<CachedIdentity>(
      cacheKey,
      resolved,
      IDENTITY_CACHE_TTL_SECONDS,
    );

    return resolved;
  }

  /**
   * Invalidate the Redis-cached identity for a user. Called by adjacent
   * services when an action MUST take effect on the next request rather
   * than waiting out the 60s TTL — e.g. user deactivation, role revoke
   * by admin. Errors are swallowed: a failed cache delete only means the
   * next request reads stale-but-bounded data.
   */
  async invalidate(userId: string): Promise<void> {
    if (!userId) return;
    await this.redis.del(`${IDENTITY_CACHE_KEY_PREFIX}${userId}`);
  }
}
