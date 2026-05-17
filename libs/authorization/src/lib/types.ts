export type CollectionOperation = 'create' | 'read' | 'update' | 'delete';
export type PropertyOperation = 'read' | 'write';

export type MaskingStrategy = 'NONE' | 'PARTIAL' | 'FULL';

/**
 * Rule effect (canon §28.2/§28.3).
 *
 * `allow` rules contribute positive grants. Multiple matching allows UNION
 * (most permissive read/write across them), with masking taking the
 * MOST-restrictive strategy per §28.5.
 *
 * `deny` rules are absolute at their level: a single matching deny denies
 * regardless of co-matching allows (§28.4 rule 1). At the field level a
 * matching deny forces `canRead=false, canWrite=false, maskingStrategy='FULL'`.
 * At the collection/record level a matching deny excludes the record from
 * the visible set even when an allow would have included it.
 */
export type RuleEffect = 'allow' | 'deny';

export interface PropertyMeta {
  code: string;
  label?: string;
  type?: string;
  isSystem?: boolean;
  isInternal?: boolean;
  showInForms?: boolean;
  showInLists?: boolean;
  storagePath?: string;
  validators?: Record<string, any>;
}

export interface AuthorizedPropertyMeta extends PropertyMeta {
  canRead: boolean;
  canWrite: boolean;
  maskingStrategy: MaskingStrategy;
}

/**
 * Per-field permissions surfaced to the client on UI-facing data
 * responses (list / search / detail / dashboard). The §28 evaluator
 * computes this once per request; the client renders accordingly:
 *
 *   - `canRead === false` → the record body OMITS the field entirely
 *     (server-side stripping). The client doesn't need to mask it.
 *   - `canRead === true, maskStrategy === 'PARTIAL' | 'FULL'` → the
 *     server returns the masked value (via `maskCollectionRecord`).
 *     The client renders as-is.
 *   - `canRead === true, canWrite === false` → the client renders the
 *     field as read-only.
 *
 * The `canWrite` and `maskStrategy` fields are optional because some
 * code paths only carry read-decision provenance (e.g. an
 * aggregated/grouped query that doesn't surface masking per row).
 * Field decisions that DO carry the data carry it; consumers fall
 * back to `canWrite: true` and `maskStrategy: 'NONE'` when absent.
 */
export interface FieldPermissions {
  canRead: boolean;
  canWrite?: boolean;
  maskStrategy?: MaskingStrategy;
}

/**
 * Canon §28 + W2 Stream 4b Task 36 — the response-level permissions
 * payload. Attached to every UI-facing data response so the client
 * can render per the centralized §28 decision instead of re-deriving
 * it from per-field flags scattered across the response.
 *
 * Shape:
 * ```json
 * {
 *   "canCreate": true,
 *   "canUpdate": false,
 *   "canDelete": false,
 *   "fields": {
 *     "name":   { "canRead": true,  "canWrite": false, "maskStrategy": "NONE" },
 *     "salary": { "canRead": true,  "canWrite": false, "maskStrategy": "PARTIAL" },
 *     "ssn":    { "canRead": false }
 *   }
 * }
 * ```
 *
 * `canCreate / canUpdate / canDelete` reflect the collection-level
 * §28 evaluator output (CollectionAccessRule for the verb). They
 * gate the client's render of add/edit/delete affordances. Backend
 * is still authoritative — the client uses these flags ONLY to render
 * UI; every actual mutation still passes through the
 * `@RequireCollectionAccess(...)` guard.
 *
 * `fields` is uniform across all records in a response — per-field
 * permissions are computed once on the collection's schema, not
 * per-row. (Per-row ABAC filters change which RECORDS are visible
 * but not which FIELDS are visible within a record.)
 */
export interface ResponsePermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  fields: Record<string, FieldPermissions>;
}



// ============================================================================
// Access Rule Interfaces (for repository abstraction)
// ============================================================================

export interface CollectionAccessRuleData {
  id: string;
  collectionId: string;
  name: string;
  description?: string | null;
  roleId?: string | null;
  groupId?: string | null;
  userId?: string | null;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  conditions?: AccessConditionData | null;
  priority: number;
  isActive: boolean;
  /**
   * Rule effect (canon §28.3). `allow` is the legacy default; `deny` rules
   * deny matching records regardless of co-matching allows (§28.4 rule 1).
   * The DB column has DEFAULT 'allow' so legacy rows round-trip unchanged.
   */
  effect: RuleEffect;
}

export interface PropertyAccessRuleData {
  id: string;
  /**
   * Explicit field-level rule target (canon §28.2 levels 1-2). Nullable
   * because wildcard field rules (levels 3-4) carry `wildcardCollectionId`
   * instead. The DB CHECK constraint enforces XOR: exactly one of
   * (`propertyId`, `wildcardCollectionId`) is set.
   */
  propertyId?: string | null;
  propertyCode?: string;
  collectionId?: string;
  /**
   * Wildcard field-rule target (canon §28.2 levels 3-4). When set, the
   * rule applies to EVERY field of the referenced collection. Mutually
   * exclusive with `propertyId`. Evaluated between explicit field rules
   * (levels 1-2) and collection-level fallback (levels 5-6+).
   */
  wildcardCollectionId?: string | null;
  roleId?: string | null;
  groupId?: string | null;
  userId?: string | null;
  canRead: boolean;
  canWrite: boolean;
  conditions?: AccessConditionData | null;
  priority: number;
  isActive: boolean;
  maskingStrategy?: MaskingStrategy;
  /**
   * Rule effect (canon §28.2). `allow` is the legacy default; `deny` rules
   * force the field to canRead=false/canWrite=false/maskingStrategy='FULL'
   * regardless of co-matching allows (§28.4 rule 1).
   */
  effect: RuleEffect;
}

// ============================================================================
// Access Condition Types
// ============================================================================

export interface AccessConditionData {
  property?: string;
  operator?: AccessOperator;
  value?: unknown;
  and?: AccessConditionData[];
  or?: AccessConditionData[];
}

export type AccessOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equals'
  | 'less_than'
  | 'less_than_or_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

// ============================================================================
// User Context for Authorization
// ============================================================================

export interface UserAccessContext {
  userId: string;
  email?: string;
  roleIds: string[];
  roleNames?: string[];
  groupIds: string[];
  teamIds: string[];
  departmentId?: string;
  locationId?: string;
  siteIds?: string[];
  isAdmin?: boolean;
}

// ============================================================================
// Repository Interfaces (for dependency injection)
// ============================================================================

export interface CollectionAccessRuleRepository {
  findByCollection(collectionId: string, activeOnly?: boolean): Promise<CollectionAccessRuleData[]>;
  findByCollectionAndUser(
    collectionId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[],
  ): Promise<CollectionAccessRuleData[]>;
}

export interface PropertyAccessRuleRepository {
  findByProperty(propertyId: string, activeOnly?: boolean): Promise<PropertyAccessRuleData[]>;
  findByCollectionProperties(
    collectionId: string,
    propertyCodes: string[],
    userId: string,
    roleIds: string[],
    groupIds: string[],
  ): Promise<PropertyAccessRuleData[]>;
}

// ============================================================================
// Special Value Resolution
// ============================================================================

export const SPECIAL_VALUES: Record<string, (ctx: UserAccessContext) => unknown> = {
  '@currentUser': (ctx) => ctx.userId,
  '@currentUser.id': (ctx) => ctx.userId,
  '@currentUser.email': (ctx) => ctx.email,
  '@currentUser.roleIds': (ctx) => ctx.roleIds,
  '@currentUser.groupIds': (ctx) => ctx.groupIds,
  '@currentUser.teamIds': (ctx) => ctx.teamIds,
  '@currentUser.departmentId': (ctx) => ctx.departmentId,
  '@currentUser.locationId': (ctx) => ctx.locationId,
  '@currentUser.siteIds': (ctx) => ctx.siteIds,
  '@roles': (ctx) => ctx.roleIds,
  '@groups': (ctx) => ctx.groupIds,
  '@teams': (ctx) => ctx.teamIds,
  '@sites': (ctx) => ctx.siteIds,
  '@now': () => new Date(),
  '@today': () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  },
};

export type SpecialValueKey = keyof typeof SPECIAL_VALUES;
