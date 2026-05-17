/**
 * Public API for `@hubblewave/permission-registry`. The single source
 * of truth for platform-wide capability codes per canon §28 + §29.7.
 *
 * Consumers:
 *   - `JwtAuthGuard` reads `PERMISSION_REGISTRY` to validate scope
 *     claims on service tokens (Stream 2 PR3 wires this).
 *   - `@RequirePermission(code)` and `@RequireServiceScope(code)` call
 *     sites cite codes from this registry; the
 *     `permission-registry-sync-check` scanner verifies every cited
 *     code exists.
 *   - `scripts/seed-permission-registry-sync.ts` (Stream 2 PR3)
 *     materializes the registry into `identity.platform_permissions`.
 */

export {
  PERMISSION_REGISTRY,
  type PermissionPlane,
  type PermissionAction,
  type PlatformPermission,
} from './registry';

/**
 * Canonical regex for a permission code. Mirrors the shape of every
 * entry in `PERMISSION_REGISTRY`:
 *
 *   - First segment: domain (lowercase, optional underscores).
 *   - 1-2 trailing segments separated by `:`: optional resource, then
 *     action. Both lowercase, optional underscores.
 *
 *   `audit:read`                  → ok (domain + action)
 *   `identity:user:manage`        → ok (domain + resource + action)
 *   `metadata:schema:manage`      → ok
 *   `Audit:Read`                  → fail (uppercase)
 *   `audit-read`                  → fail (hyphen, no colon)
 *   `audit:`                      → fail (empty trailing segment)
 *   `audit:read:write:export`     → fail (too many segments)
 */
export const PERMISSION_CODE_REGEX = /^[a-z][a-z_]*(:[a-z_]+){1,2}$/;

/**
 * `true` iff `code` is registered in `PERMISSION_REGISTRY`. Linear scan
 * because the registry is small; if it grows past a few hundred codes
 * a Map index can replace this without changing the contract.
 */
import { PERMISSION_REGISTRY } from './registry';
export function isRegistered(code: string): boolean {
  return PERMISSION_REGISTRY.some((p) => p.code === code);
}
