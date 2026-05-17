/**
 * Re-export of `PERMISSION_REGISTRY` for the web client. Use this
 * module (or `@hubblewave/permission-registry` directly) when a
 * component needs to compare against a known platform capability
 * code; the shared TypeScript constant is the single source of
 * truth per canon §28 + §29.7 / W2 Stream 2.
 *
 * The CI scanner `permission-registry-sync-check` enforces that every
 * `@RequirePermission` / `@RequireServiceScope` site and every JSX
 * `<RequirePermission permission="..." />` site uses a code from this
 * registry. Hand-typed string literals that match a registered code
 * are accepted today (CI is content-equal, not import-graph aware), so
 * importing from this module is the convention, not a strict
 * requirement.
 */
export {
  PERMISSION_REGISTRY,
  PERMISSION_CODE_REGEX,
  isRegistered,
  type PermissionAction,
  type PermissionPlane,
  type PlatformPermission,
} from '@hubblewave/permission-registry';
