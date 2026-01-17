import { SetMetadata, applyDecorators } from '@nestjs/common';

/**
 * Metadata keys for permission-based access control
 */
export const PERMISSIONS_KEY = 'required_permissions';
export const PERMISSION_MODE_KEY = 'permission_mode';
export const PERMISSION_SCOPE_KEY = 'permission_scope';

/**
 * Permission check mode
 */
export type PermissionMode = 'any' | 'all';

/**
 * Scope resolver for dynamic permission checking
 */
export interface PermissionScope {
  type: string;      // e.g., 'department', 'location', 'collection'
  valueParam?: string; // Request param to extract scope value from
  value?: string;     // Static scope value
}

/**
 * Require specific permission(s) to access endpoint
 *
 * @example
 * // Single permission
 * @RequirePermission('assets.create')
 *
 * // Multiple permissions (user must have at least one)
 * @RequirePermission(['assets.create', 'assets.import'], 'any')
 *
 * // Multiple permissions (user must have all)
 * @RequirePermission(['assets.create', 'assets.update'], 'all')
 *
 * // With scope
 * @RequirePermission('assets.update', 'any', { type: 'department', valueParam: 'deptId' })
 */
export function RequirePermission(
  permissions: string | string[],
  mode: PermissionMode = 'any',
  scope?: PermissionScope,
) {
  const permArray = Array.isArray(permissions) ? permissions : [permissions];

  const decorators = [
    SetMetadata(PERMISSIONS_KEY, permArray),
    SetMetadata(PERMISSION_MODE_KEY, mode),
  ];

  if (scope) {
    decorators.push(SetMetadata(PERMISSION_SCOPE_KEY, scope));
  }

  return applyDecorators(...decorators);
}

/**
 * Shorthand: Require ALL specified permissions
 */
export function RequireAllPermissions(...permissions: string[]) {
  return RequirePermission(permissions, 'all');
}

/**
 * Shorthand: Require ANY of the specified permissions
 */
export function RequireAnyPermission(...permissions: string[]) {
  return RequirePermission(permissions, 'any');
}

/**
 * Permission categories for documentation/validation
 */
export const PermissionCategories = {
  ASSETS: 'assets',
  WORK_ORDERS: 'work-orders',
  USERS: 'users',
  GROUPS: 'groups',
  ROLES: 'roles',
  REPORTS: 'reports',
  ADMIN: 'admin',
  PROCESS_FLOWS: 'process-flows',
  COLLECTIONS: 'collections',
  SCRIPTS: 'scripts',
  AUDIT: 'audit',
} as const;

/**
 * Standard permission actions
 */
export const PermissionActions = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  IMPORT: 'import',
  EXPORT: 'export',
  EXECUTE: 'execute',
  APPROVE: 'approve',
  ASSIGN: 'assign',
  MANAGE: 'manage',
} as const;

/**
 * Build permission slug from category and action
 */
export function buildPermission(
  category: typeof PermissionCategories[keyof typeof PermissionCategories],
  action: typeof PermissionActions[keyof typeof PermissionActions],
): string {
  return `${category}.${action}`;
}
