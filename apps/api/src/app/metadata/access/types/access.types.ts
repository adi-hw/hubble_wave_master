import {
  AccessCondition,
  AccessConditionGroup,
} from '@hubblewave/instance-db';

// ============================================================================
// User Context
// ============================================================================

export interface UserAccessContext {
  id: string;
  email: string;
  roleIds: string[];
  teamIds: string[];
  groupIds: string[];
  departmentId?: string;
  locationId?: string;
}

// ============================================================================
// Access Check
// ============================================================================

export type Operation = 'read' | 'create' | 'update' | 'delete';

export interface AccessCheckRequest {
  user: UserAccessContext;
  collectionId: string;
  operation: Operation;
  record?: Record<string, unknown>;
  recordId?: string;
  includeTrace?: boolean;
}

export interface AccessCheckResult {
  allowed: boolean;
  matchingRule?: {
    id: string;
    name: string;
    priority: number;
  };
  condition?: AccessCondition | AccessConditionGroup;
  reason?: AccessDenialReason;
  trace?: RuleEvaluationTrace[];
}

export type AccessDenialReason =
  | 'NO_MATCHING_RULE'
  | 'PRINCIPAL_NOT_MATCH'
  | 'PERMISSION_NOT_GRANTED'
  | 'CONDITION_NOT_MET'
  | 'RULE_INACTIVE'
  | 'BREAK_GLASS_REQUIRED';

export interface RuleEvaluationTrace {
  ruleId: string;
  ruleName: string;
  priority: number;
  principalMatch: boolean;
  permissionCheck: boolean;
  conditionCheck: boolean | null;
  conditionResult?: boolean | null;
  conditionDetails?: any;
  result: 'matched' | 'no_principal_match' | 'no_permission' | 'condition_failed' | 'skipped';
}

export interface PropertyAccessResult {
  propertyCode: string;
  canRead: boolean;
  canWrite: boolean;
  isMasked: boolean;
  maskValue?: string;
  isPhi: boolean;
  requiresBreakGlass: boolean;
}

export interface EffectivePermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  readCondition?: AccessCondition | AccessConditionGroup;
  updateCondition?: AccessCondition | AccessConditionGroup;
  deleteCondition?: AccessCondition | AccessConditionGroup;
  propertyAccess: PropertyAccessResult[];
  appliedRules: {
    ruleId: string;
    ruleName: string;
    effect: string;
  }[];
}

export interface QueryFilter {
  sql: string;
  params: unknown[];
}

export const SPECIAL_VALUES = {
  '@currentUser.id': (ctx: UserAccessContext) => ctx.id,
  '@currentUser.email': (ctx: UserAccessContext) => ctx.email,
  '@currentUser.roleIds': (ctx: UserAccessContext) => ctx.roleIds,
  '@currentUser.teamIds': (ctx: UserAccessContext) => ctx.teamIds,
  '@currentUser.groupIds': (ctx: UserAccessContext) => ctx.groupIds,
  '@currentUser.departmentId': (ctx: UserAccessContext) => ctx.departmentId,
  '@currentUser.locationId': (ctx: UserAccessContext) => ctx.locationId,
  '@currentTime': () => new Date(),
  '@currentDate': () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  },
} as const;

export type SpecialValueKey = keyof typeof SPECIAL_VALUES;

