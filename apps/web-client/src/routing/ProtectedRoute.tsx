import React, { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useHasAnyPermission, useHasPermission, useHasRole } from '../auth/permissions';

interface ProtectedRouteProps {
  permissions?: string | string[];
  /**
   * OR semantics — user passes if they hold ANY of the listed slugs
   * (or are admin). Used by surfaces that accept multiple alternative
   * permissions (e.g. App Studio tab routes accept any metadata.*
   * edit slug).
   */
  anyPermission?: string | string[];
  roles?: string | string[];
  children: ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ permissions, anyPermission, roles, children }) => {
  const { auth } = useAuth();
  const location = useLocation();
  // F088 fix: hooks MUST be called unconditionally on every render so
  // React's hook-count contract holds. The previous form
  //   const hasPerm = permissions ? useHasPermission(permissions) : true;
  // changed the hook call count whenever the `permissions` prop toggled
  // between truthy and undefined, which crashed the subtree in
  // StrictMode. Always call; branch on the boolean afterward.
  const hasPermResult = useHasPermission(permissions ?? []);
  const hasAnyResult = useHasAnyPermission(anyPermission ?? []);
  const hasRoleResult = useHasRole(roles ?? []);
  const hasPerm = permissions ? hasPermResult : true;
  const hasAny = anyPermission ? hasAnyResult : true;
  const hasRole = roles ? hasRoleResult : true;

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Not authenticated - redirect to login with return URL
  if (!auth.user) {
    return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
  }

  // Authenticated but missing permissions/roles - show unauthorized
  if (!hasPerm || !hasRole || !hasAny) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
