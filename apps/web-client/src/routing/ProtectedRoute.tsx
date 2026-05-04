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
  const hasPerm = permissions ? useHasPermission(permissions) : true;
  const hasAny = anyPermission ? useHasAnyPermission(anyPermission) : true;
  const hasRole = roles ? useHasRole(roles) : true;

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
