import React from 'react';
import { useHasPermission, useHasRole } from './permissions';

interface PermissionGateProps {
  permissions?: string | string[];
  roles?: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permissions,
  roles,
  children,
  fallback = null,
}) => {
  // F088 fix: always call hooks; branch on the boolean afterward.
  // See ProtectedRoute.tsx for the full rationale.
  const hasPermResult = useHasPermission(permissions ?? []);
  const hasRoleResult = useHasRole(roles ?? []);
  const hasPerm = permissions ? hasPermResult : true;
  const hasRole = roles ? hasRoleResult : true;

  if (!hasPerm || !hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
