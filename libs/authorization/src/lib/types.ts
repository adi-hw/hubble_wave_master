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
  propertyId: string;
  propertyCode?: string;
  collectionId?: string;
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
