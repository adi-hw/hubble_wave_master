import { useAuth } from './AuthContext';

export const useHasRole = (role: string | string[]) => {
  const { auth } = useAuth();
  const user = auth.user;
  const roles = user?.roles || [];
  const required = Array.isArray(role) ? role : [role];

  // Check if user has admin flags that satisfy the role requirement
  if (user?.isPlatformAdmin) return true;
  if (required.includes('tenant_admin') && user?.isTenantAdmin) return true;

  return required.every((r) => roles.includes(r));
};

export const useHasPermission = (permission: string | string[]) => {
  const { auth } = useAuth();
  const perms = auth.user?.permissions || [];
  const required = Array.isArray(permission) ? permission : [permission];
  return required.every((p) => perms.includes(p));
};
