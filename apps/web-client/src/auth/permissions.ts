import { useAuth } from './AuthContext';

export const useHasRole = (role: string | string[]) => {
  const { auth } = useAuth();
  const user = auth.user;
  const roles = user?.roles || [];
  const required = Array.isArray(role) ? role : [role];

  // Admin role has access to all protected routes
  if (roles.includes('admin')) return true;

  return required.every((r) => roles.includes(r));
};

export const useHasPermission = (permission: string | string[]) => {
  const { auth } = useAuth();
  const perms = auth.user?.permissions || [];
  const required = Array.isArray(permission) ? permission : [permission];
  return required.every((p) => perms.includes(p));
};
