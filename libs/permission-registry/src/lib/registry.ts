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
 * edit. The `permission-registry-sync-check` scanner enforces the
 * sync contract: every entry below MUST have at least one
 * `@RequirePermission` / `@RequireServiceScope` reference somewhere
 * in `apps/`, and every such reference MUST cite a code that appears
 * here.
 *
 * Population (W2 Stream 2 PR3): codes were coarsened to capability
 * families to satisfy canon §2 ("exactly one obvious way") — the
 * pre-W2 codebase had per-verb codes (`users.view` / `users.create`
 * / `users.update` / `users.delete`) that doubled the surface area
 * without adding meaningful authorization granularity at the
 * platform level. The W2 contract collapses those into two codes
 * per resource: `read` and `manage`. Where a capability has high
 * blast radius (impersonation, system configuration) it gets its
 * own code rather than folding into the generic `:manage` slot.
 *
 * Add a new entry only when a `@RequirePermission(...)` site needs
 * it AND no existing coarse code fits. Delete an entry the moment
 * its last call site is removed (canon §14).
 */
export const PERMISSION_REGISTRY: ReadonlyArray<PlatformPermission> = [
  // Audit ------------------------------------------------------------------
  {
    code: 'audit:read',
    plane: 'instance',
    domain: 'audit',
    action: 'read',
    dangerous: false,
    description: 'Read audit log entries.',
  },

  // Identity ---------------------------------------------------------------
  {
    code: 'identity:user:read',
    plane: 'instance',
    domain: 'identity',
    resource: 'user',
    action: 'read',
    dangerous: false,
    description: 'Read platform user records.',
  },
  {
    code: 'identity:user:manage',
    plane: 'instance',
    domain: 'identity',
    resource: 'user',
    action: 'manage',
    dangerous: true,
    description:
      'Create, update, and delete platform users; assign and revoke role grants on a user — mutates the identity boundary.',
  },
  {
    code: 'identity:role:read',
    plane: 'instance',
    domain: 'identity',
    resource: 'role',
    action: 'read',
    dangerous: false,
    description: 'Read role definitions and their permission grants.',
  },
  {
    code: 'identity:role:manage',
    plane: 'instance',
    domain: 'identity',
    resource: 'role',
    action: 'manage',
    dangerous: true,
    description:
      'Create, update, and delete platform roles, including their permission and policy bindings.',
  },
  {
    code: 'identity:group:read',
    plane: 'instance',
    domain: 'identity',
    resource: 'group',
    action: 'read',
    dangerous: false,
    description: 'Read group definitions, memberships, and role assignments.',
  },
  {
    code: 'identity:group:manage',
    plane: 'instance',
    domain: 'identity',
    resource: 'group',
    action: 'manage',
    dangerous: true,
    description:
      'Create, update, and delete groups; manage group membership and group-role assignments.',
  },
  {
    code: 'identity:delegation:approve',
    plane: 'instance',
    domain: 'identity',
    resource: 'delegation',
    action: 'approve',
    dangerous: false,
    description: 'Approve or reject a delegation request raised against the caller.',
  },
  {
    code: 'identity:delegation:manage',
    plane: 'instance',
    domain: 'identity',
    resource: 'delegation',
    action: 'manage',
    dangerous: true,
    description:
      'Administer delegation policy across the instance — manage delegation rules, audit and revoke any active delegation.',
  },
  {
    code: 'identity:impersonation:invoke',
    plane: 'instance',
    domain: 'identity',
    resource: 'impersonation',
    action: 'invoke',
    dangerous: true,
    description:
      'Impersonate another user, terminate impersonation sessions — high blast radius, exposes administrative reach over every identity in the instance.',
  },

  // Authorization ----------------------------------------------------------
  {
    code: 'authorization:policy:read',
    plane: 'instance',
    domain: 'authorization',
    resource: 'policy',
    action: 'read',
    dangerous: false,
    description:
      'Read authorization policy definitions (collection access rules, property access rules).',
  },
  {
    code: 'authorization:explain:read',
    plane: 'instance',
    domain: 'authorization',
    resource: 'explain',
    action: 'read',
    dangerous: true,
    description:
      'Read authorization decisions for arbitrary users via /authorization/explain — surfaces ACL reasoning; manage admin-only.',
  },

  // Metadata ---------------------------------------------------------------
  {
    code: 'metadata:collection:read',
    plane: 'instance',
    domain: 'metadata',
    resource: 'collection',
    action: 'read',
    dangerous: false,
    description: 'Read collection definitions and their metadata.',
  },
  {
    code: 'metadata:collection:manage',
    plane: 'instance',
    domain: 'metadata',
    resource: 'collection',
    action: 'manage',
    dangerous: true,
    description:
      'Create, update, and delete collection definitions — mutates the platform data model.',
  },
  {
    code: 'metadata:property:read',
    plane: 'instance',
    domain: 'metadata',
    resource: 'property',
    action: 'read',
    dangerous: false,
    description: 'Read property (column) definitions on collections.',
  },
  {
    code: 'metadata:property:manage',
    plane: 'instance',
    domain: 'metadata',
    resource: 'property',
    action: 'manage',
    dangerous: true,
    description:
      'Create, update, and delete property definitions on collections — mutates the platform data model.',
  },
  {
    code: 'metadata:flow:manage',
    plane: 'instance',
    domain: 'metadata',
    resource: 'flow',
    action: 'manage',
    dangerous: true,
    description:
      'Manage automation rules, workflows, decision tables, and guided processes — controls what executes on records.',
  },
  {
    code: 'metadata:form:manage',
    plane: 'instance',
    domain: 'metadata',
    resource: 'form',
    action: 'manage',
    dangerous: true,
    description: 'Manage forms and view layouts.',
  },
  {
    code: 'metadata:workspace:manage',
    plane: 'instance',
    domain: 'metadata',
    resource: 'workspace',
    action: 'manage',
    dangerous: true,
    description: 'Manage workspace definitions (canon §27 UI Builder).',
  },
  {
    code: 'metadata:policy:manage',
    plane: 'instance',
    domain: 'metadata',
    resource: 'policy',
    action: 'manage',
    dangerous: true,
    description:
      'Manage display rules, dependent-review policies, and other metadata-layer policy artifacts.',
  },
  {
    code: 'metadata:change_package:manage',
    plane: 'instance',
    domain: 'metadata',
    resource: 'change_package',
    action: 'manage',
    dangerous: true,
    description:
      'Manage and promote change packages — controls upgrade-safe metadata rollouts.',
  },
  {
    code: 'metadata:navigation:manage',
    plane: 'instance',
    domain: 'metadata',
    resource: 'navigation',
    action: 'manage',
    dangerous: true,
    description:
      'Manage the platform navigation tree — controls every user-facing entry point.',
  },

  // AVA --------------------------------------------------------------------
  {
    code: 'ava:admin',
    plane: 'instance',
    domain: 'ava',
    action: 'admin',
    dangerous: true,
    description:
      'Administer AVA — manage AI feature trust levels, audit proposals, kill autonomous executions.',
  },

  // Notifications ----------------------------------------------------------
  {
    code: 'notifications:send:invoke',
    plane: 'instance',
    domain: 'notifications',
    resource: 'send',
    action: 'invoke',
    dangerous: false,
    description:
      'Trigger a notification dispatch directly (not via an automation rule or scheduled job).',
  },

  // System -----------------------------------------------------------------
  {
    code: 'system:configure',
    plane: 'instance',
    domain: 'system',
    action: 'configure',
    dangerous: true,
    description:
      'Read and write platform-wide configuration: identity config scopes, admin UI theme, behavioural analytics ingestion, application metadata — every admin "settings" surface.',
  },
];
