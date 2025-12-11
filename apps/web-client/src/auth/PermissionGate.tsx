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
  const hasPerm = permissions ? useHasPermission(permissions) : true;
  const hasRole = roles ? useHasRole(roles) : true;

  if (!hasPerm || !hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
