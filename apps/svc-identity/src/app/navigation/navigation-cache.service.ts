import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ResolvedNavigation } from './dto/navigation.dto';

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * NavigationCacheService - Caches resolved navigation to improve performance
 *
 * Cache strategies:
 * - Per-user navigation cache (keyed by tenant:profile:userContextHash)
 * - Profile metadata cache (keyed by tenant:profile)
 * - Module registry cache (keyed by tenant)
 *
 * Invalidation triggers:
 * - NavProfile/NavProfileItem CRUD
 * - NavPatch CRUD
 * - Module CRUD
 * - Role/Permission changes (via RBAC events)
 *
 * In production, this should be backed by Redis.
 * This implementation uses in-memory caching for simplicity.
 */
@Injectable()
export class NavigationCacheService implements OnModuleInit {
  private readonly logger = new Logger(NavigationCacheService.name);

  // In-memory caches (would be Redis in production)
  private navigationCache = new Map<string, CacheEntry<ResolvedNavigation>>();
  private profileCache = new Map<string, CacheEntry<any>>();
  private moduleCache = new Map<string, CacheEntry<any>>();

  // Cache TTLs in milliseconds
  private readonly navigationTtl: number;
  private readonly profileTtl: number;
  private readonly moduleTtl: number;

  // Max cache size (per cache type)
  private readonly maxCacheSize: number;

  constructor(private readonly configService: ConfigService) {
    this.navigationTtl = this.configService.get('NAV_CACHE_TTL_MS', 5 * 60 * 1000); // 5 minutes
    this.profileTtl = this.configService.get('NAV_PROFILE_CACHE_TTL_MS', 10 * 60 * 1000); // 10 minutes
    this.moduleTtl = this.configService.get('NAV_MODULE_CACHE_TTL_MS', 15 * 60 * 1000); // 15 minutes
    this.maxCacheSize = this.configService.get('NAV_CACHE_MAX_SIZE', 1000);
  }

  onModuleInit() {
    // Start cache cleanup interval
    setInterval(() => this.cleanupExpiredEntries(), 60 * 1000); // Every minute
  }

  // === Navigation Cache ===

  /**
   * Generate cache key for user navigation
   */
  getNavigationCacheKey(
    tenantId: string,
    profileId: string,
    roles: string[],
    permissions: string[],
    featureFlags: string[],
    contextTags: string[]
  ): string {
    // Create a deterministic hash of the context
    const contextHash = this.hashContext({
      roles: roles.sort(),
      permissions: permissions.sort(),
      featureFlags: featureFlags.sort(),
      contextTags: contextTags.sort(),
    });

    return `nav:${tenantId}:${profileId}:${contextHash}`;
  }

  /**
   * Get cached navigation
   */
  getCachedNavigation(cacheKey: string): ResolvedNavigation | null {
    const entry = this.navigationCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.navigationCache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache resolved navigation
   */
  setCachedNavigation(cacheKey: string, navigation: ResolvedNavigation): void {
    this.ensureCacheSize(this.navigationCache);

    this.navigationCache.set(cacheKey, {
      data: navigation,
      expiresAt: Date.now() + this.navigationTtl,
    });
  }

  // === Profile Cache ===

  /**
   * Get cached profile metadata
   */
  getCachedProfile(tenantId: string, profileId: string): any | null {
    const key = `profile:${tenantId}:${profileId}`;
    const entry = this.profileCache.get(key);

    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.profileCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache profile metadata
   */
  setCachedProfile(tenantId: string, profileId: string, profile: any): void {
    this.ensureCacheSize(this.profileCache);

    this.profileCache.set(`profile:${tenantId}:${profileId}`, {
      data: profile,
      expiresAt: Date.now() + this.profileTtl,
    });
  }

  // === Module Cache ===

  /**
   * Get cached modules
   */
  getCachedModules(tenantId: string): Map<string, any> | null {
    const key = `modules:${tenantId}`;
    const entry = this.moduleCache.get(key);

    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.moduleCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache modules
   */
  setCachedModules(tenantId: string, modules: Map<string, any>): void {
    this.ensureCacheSize(this.moduleCache);

    this.moduleCache.set(`modules:${tenantId}`, {
      data: modules,
      expiresAt: Date.now() + this.moduleTtl,
    });
  }

  // === Invalidation ===

  /**
   * Invalidate all navigation cache for a tenant
   */
  invalidateTenantNavigation(tenantId: string): void {
    const prefix = `nav:${tenantId}:`;
    for (const key of this.navigationCache.keys()) {
      if (key.startsWith(prefix)) {
        this.navigationCache.delete(key);
      }
    }
    this.logger.debug(`Invalidated navigation cache for tenant ${tenantId}`);
  }

  /**
   * Invalidate navigation cache for a specific profile
   */
  invalidateProfileNavigation(tenantId: string, profileId: string): void {
    const prefix = `nav:${tenantId}:${profileId}:`;
    for (const key of this.navigationCache.keys()) {
      if (key.startsWith(prefix)) {
        this.navigationCache.delete(key);
      }
    }

    // Also invalidate profile metadata
    this.profileCache.delete(`profile:${tenantId}:${profileId}`);

    this.logger.debug(`Invalidated navigation cache for profile ${profileId}`);
  }

  /**
   * Invalidate module cache for a tenant
   */
  invalidateTenantModules(tenantId: string): void {
    this.moduleCache.delete(`modules:${tenantId}`);
    // Module changes affect navigation, so invalidate that too
    this.invalidateTenantNavigation(tenantId);
    this.logger.debug(`Invalidated module cache for tenant ${tenantId}`);
  }

  /**
   * Invalidate all caches for a user (e.g., after role change)
   */
  invalidateUserCaches(tenantId: string): void {
    // Since user context is hashed, we can't target specific users
    // Invalidate all navigation for the tenant
    this.invalidateTenantNavigation(tenantId);
  }

  /**
   * Clear all caches (for development/testing)
   */
  clearAll(): void {
    this.navigationCache.clear();
    this.profileCache.clear();
    this.moduleCache.clear();
    this.logger.debug('Cleared all navigation caches');
  }

  // === Helpers ===

  /**
   * Hash context for cache key
   */
  private hashContext(context: Record<string, unknown>): string {
    const str = JSON.stringify(context);
    return createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  /**
   * Ensure cache doesn't exceed max size (LRU eviction)
   */
  private ensureCacheSize(cache: Map<string, CacheEntry<any>>): void {
    if (cache.size >= this.maxCacheSize) {
      // Remove oldest entries (first 10%)
      const toRemove = Math.floor(this.maxCacheSize * 0.1);
      const keys = Array.from(cache.keys()).slice(0, toRemove);
      for (const key of keys) {
        cache.delete(key);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();

    for (const [key, entry] of this.navigationCache.entries()) {
      if (now > entry.expiresAt) {
        this.navigationCache.delete(key);
      }
    }

    for (const [key, entry] of this.profileCache.entries()) {
      if (now > entry.expiresAt) {
        this.profileCache.delete(key);
      }
    }

    for (const [key, entry] of this.moduleCache.entries()) {
      if (now > entry.expiresAt) {
        this.moduleCache.delete(key);
      }
    }
  }

  // === Stats (for monitoring) ===

  /**
   * Get cache statistics
   */
  getStats(): {
    navigation: { size: number; maxSize: number };
    profile: { size: number; maxSize: number };
    module: { size: number; maxSize: number };
  } {
    return {
      navigation: { size: this.navigationCache.size, maxSize: this.maxCacheSize },
      profile: { size: this.profileCache.size, maxSize: this.maxCacheSize },
      module: { size: this.moduleCache.size, maxSize: this.maxCacheSize },
    };
  }
}
