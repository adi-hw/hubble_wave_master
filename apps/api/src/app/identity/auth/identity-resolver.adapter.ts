import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@hubblewave/instance-db';
import {
  IdentityResolverPort,
  ResolvedIdentity,
} from '@hubblewave/auth-guard';
import { RedisService } from '@hubblewave/redis';
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
 * Wire-format for cached identity. Keep this minimal — only the fields
 * the port contract requires.
 */
interface CachedIdentity {
  userId: string;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
  status: string;
  securityStamp: string;
  /** W6.D / F047 — direct group IDs; included in cache to avoid extra DB queries. */
  groupIds?: string[];
}

/**
 * F013 / IdentityResolverPort implementation backed by the instance DB.
 *
 * Walks the same path JwtStrategy uses (User lookup + PermissionResolver)
 * so the two authentication surfaces stay functionally consistent. Adds a
 * thin Redis cache so the new per-request DB round trip the guard now
 * makes does not turn into a hot loop on busy endpoints.
 *
 * Cache invalidation is implicit via the short TTL plus the event-driven
 * invalidation on `PermissionResolverService` — when a role changes, the
 * in-process cache flushes immediately and the Redis cache expires within
 * a minute. For force-immediate scenarios (admin "log out everywhere"),
 * the parallel `JwtRevocationAdapter` writes a revoke-before timestamp
 * that the guard checks after identity resolution.
 */
@Injectable()
export class IdentityResolverAdapter implements IdentityResolverPort {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly permissionResolver: PermissionResolverService,
    private readonly redis: RedisService,
  ) {}

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
    const roleCodes = roles.map((r) => r.code);
    const permissionCodes = Array.from(permissions);
    const isAdmin =
      roleCodes.includes('admin') ||
      roleCodes.includes('system_admin') ||
      roleCodes.includes('super_admin') ||
      user.isAdmin === true;

    const resolved: ResolvedIdentity = {
      userId: user.id,
      roles: roleCodes,
      permissions: permissionCodes,
      isAdmin,
      status: user.status,
      // canon §29.6 — the kill-switch the guard compares to `token_version`.
      securityStamp: user.securityStamp,
      // W6.D / F047 — direct group IDs; surfaced here so JwtAuthGuard can
      // seed UserRequestContext.groupCache without an additional DB query.
      groupIds: resolvedGroupIds ?? [],
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
