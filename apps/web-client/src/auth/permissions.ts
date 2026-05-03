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
  const roles = auth.user?.roles || [];
  if (roles.includes('admin')) return true;
  const required = Array.isArray(permission) ? permission : [permission];
  return required.every((p) => perms.includes(p));
};

/**
 * Pass if the user holds ANY of the supplied slugs (OR semantics).
 * Use for surfaces that accept multiple alternative permissions —
 * e.g. the App Studio tabbed shell, where a user with
 * `metadata.forms.edit` should reach the Forms tab even if they
 * don't have `metadata.collections.edit` or the admin role.
 */
export const useHasAnyPermission = (permission: string | string[]) => {
  const { auth } = useAuth();
  const perms = auth.user?.permissions || [];
  const roles = auth.user?.roles || [];
  if (roles.includes('admin')) return true;
  const candidates = Array.isArray(permission) ? permission : [permission];
  return candidates.some((p) => perms.includes(p));
};
