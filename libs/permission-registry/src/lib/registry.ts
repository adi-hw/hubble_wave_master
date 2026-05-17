/**
 * Canon §28 + §29.7 / W2 spec §2.1 — the canonical `PERMISSION_REGISTRY`
 * constant. Every platform-wide capability code MUST live here; the
 * `permission-registry-sync-check` scanner verifies that every
 * `@RequirePermission(...)` / `@RequireServiceScope(...)` site references
 * a code in this list (and conversely, that every registered code is
 * exercised somewhere).
 *
 * Capability codes are flat, platform-stable identifiers. They are
 * deliberately NOT keyed on customer-namespaced collection IDs —
 * collection IDs are user-authored metadata that change as schemas
 * evolve; per-collection access is governed separately by canon §28
 * row-level rules (`CollectionAccessRule`).
 *
 * The constant is the source of truth. Stream 2 PR3 materializes it
 * into `identity.platform_permissions` via
 * `scripts/seed-permission-registry-sync.ts`. There is one direction of
 * truth: TypeScript → DB. The DB never sources new codes.
 *
 * Adding a new code is a focused PR: append the entry here, update any
 * call site that uses it, ensure the scanner sees both ends. Removing
 * a code requires all call sites to migrate first.
 */

/**
 * Discriminator for which Nest application surface a capability applies
 * to. Per canon §17 the platform has two planes (`instance` is the
 * customer-facing Nest API; `control-plane` is the HubbleWave-internal
 * admin app). Most codes are instance-plane; control-plane codes are
 * limited to operations the HubbleWave SRE team performs.
 */
export type PermissionPlane = 'instance' | 'control-plane';

/**
 * The verb of a capability. The action vocabulary is intentionally
 * narrow — adding an action requires editing this enum AND the
 * `permission-registry-sync-check` scanner's regex. The fixed set keeps
 * the scanner deterministic and prevents the proliferation of nearly
 * synonymous verbs.
 *
 *   - `read`      — view / list / get
 *   - `manage`    — create / update / delete (the W2 spec's "write")
 *   - `export`    — emit to an external system (dangerous: data leaves
 *                   the platform's audit boundary)
 *   - `configure` — change platform configuration (settings, env vars,
 *                   feature flags, integrations)
 *   - `admin`     — broad administrative capability over a domain
 *   - `invoke`    — trigger an automation / workflow / job
 *   - `approve`   — sign off on an AVA proposal / approval step
 */
export type PermissionAction =
  | 'read'
  | 'manage'
  | 'export'
  | 'configure'
  | 'admin'
  | 'invoke'
  | 'approve';

/**
 * Shape of a single registry row. Mirrors the
 * `identity.platform_permissions` table schema; the W2 Stream 2 PR3
 * sync script materializes these directly.
 *
 * `dangerous: true` flags capabilities that:
 *   - leave a customer's audit boundary (`export`),
 *   - mutate the security model (`identity:role:manage`,
 *     `identity:user:manage`),
 *   - touch platform-wide state (`system:admin`,
 *     `metadata:schema:manage`),
 *   - expose authorization reasoning (`authorization:explain:read`).
 *
 * The flag is informational + used by the registry self-test sanity
 * check; it does NOT change runtime behavior. Authorization decisions
 * use the explicit role / collection / property rules per canon §28.
 */
export interface PlatformPermission {
  readonly code: string;
  readonly plane: PermissionPlane;
  readonly domain: string;
  readonly resource?: string;
  readonly action: PermissionAction;
  readonly dangerous: boolean;
  readonly description: string;
}

/**
 * The canonical registry. New entries land via PR, never via silent
 * edit. Stream 3 sweeps the existing ~213 `@RequirePermission` sites
 * and adds codes for each capability family they reference; Stream 2
 * PR3 enforces sync between this constant and call sites as a hard CI
 * gate.
 *
 * Initial seed (W2 Stream 2 PR1):
 *   - Known capability families surfaced by canon §28 + §29.7 review.
 *   - Each entry is referenced by at least one existing call site OR
 *     by a Stream 2/4 PR that's already drafted.
 *   - `dashboard:read` is included because Stream 4a Task 34's
 *     `filterDashboardLayout` consumes it (canon §28 read check
 *     evaluated per widget).
 */
export const PERMISSION_REGISTRY: ReadonlyArray<PlatformPermission> = [
  {
    code: 'audit:read',
    plane: 'instance',
    domain: 'audit',
    action: 'read',
    dangerous: false,
    description: 'Read audit log entries.',
  },
  {
    code: 'audit:export',
    plane: 'instance',
    domain: 'audit',
    action: 'export',
    dangerous: true,
    description: 'Export audit log entries to external systems.',
  },
  {
    code: 'identity:user:manage',
    plane: 'instance',
    domain: 'identity',
    resource: 'user',
    action: 'manage',
    dangerous: true,
    description: 'Create, update, and delete platform users.',
  },
  {
    code: 'identity:role:manage',
    plane: 'instance',
    domain: 'identity',
    resource: 'role',
    action: 'manage',
    dangerous: true,
    description: 'Create, update, and delete platform roles.',
  },
  {
    code: 'metadata:schema:manage',
    plane: 'instance',
    domain: 'metadata',
    resource: 'schema',
    action: 'manage',
    dangerous: true,
    description:
      'Manage collection schemas (create, modify, delete) — changes the platform data model.',
  },
  {
    code: 'automation:invoke',
    plane: 'instance',
    domain: 'automation',
    action: 'invoke',
    dangerous: false,
    description: 'Invoke automation rules and workflows.',
  },
  {
    code: 'system:admin',
    plane: 'instance',
    domain: 'system',
    action: 'admin',
    dangerous: true,
    description: 'Platform-wide administrative capability.',
  },
  {
    code: 'authorization:explain:read',
    plane: 'instance',
    domain: 'authorization',
    resource: 'explain',
    action: 'read',
    dangerous: true,
    description:
      'Read authorization decisions for arbitrary users — exposes ACL reasoning.',
  },
  {
    code: 'data:record:read',
    plane: 'instance',
    domain: 'data',
    resource: 'record',
    action: 'read',
    dangerous: false,
    description:
      'Read records from collections (per-collection access via §28 ACL).',
  },
  {
    code: 'data:record:manage',
    plane: 'instance',
    domain: 'data',
    resource: 'record',
    action: 'manage',
    dangerous: false,
    description:
      'Create, update, and delete records (per-collection access via §28 ACL).',
  },
  {
    code: 'dashboard:read',
    plane: 'instance',
    domain: 'dashboard',
    action: 'read',
    dangerous: false,
    description:
      'Read dashboards and their widget layouts (per-widget filtering via §28 collection-access checks).',
  },
];
