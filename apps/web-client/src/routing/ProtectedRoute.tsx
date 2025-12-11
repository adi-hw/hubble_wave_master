import React, { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useHasPermission, useHasRole } from '../auth/permissions';

interface ProtectedRouteProps {
  permissions?: string | string[];
  roles?: string | string[];
  children: ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ permissions, roles, children }) => {
  const { auth } = useAuth();
  const location = useLocation();
  const hasPerm = permissions ? useHasPermission(permissions) : true;
  const hasRole =
    roles
      ? useHasRole(roles) ||
        (Array.isArray(auth.user?.roles) && auth.user?.roles.includes('platform_admin'))
      : true;

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    );
  }

  // Not authenticated - redirect to login with return URL
  if (!auth.user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Authenticated but missing permissions/roles - show unauthorized
  if (!hasPerm || !hasRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
