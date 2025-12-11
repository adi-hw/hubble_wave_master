import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
  const { auth } = useAuth();
  const roles = auth.user?.roles ?? [];

  const hasRole = (required: string | string[]) => {
    const requiredArray = Array.isArray(required) ? required : [required];
    return requiredArray.some((r) => roles.includes(r));
  };

  return { roles, hasRole };
};
