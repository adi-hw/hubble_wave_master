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
  type: string;
  valueParam?: string;
  value?: string;
}

/**
 * Require specific permission(s) to access endpoint
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
 * Require ALL specified permissions
 */
export function RequireAllPermissions(...permissions: string[]) {
  return RequirePermission(permissions, 'all');
}

/**
 * Require ANY of the specified permissions
 */
export function RequireAnyPermission(...permissions: string[]) {
  return RequirePermission(permissions, 'any');
}
