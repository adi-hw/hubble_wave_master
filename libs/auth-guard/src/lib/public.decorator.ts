import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Marker for endpoints that require an authenticated user but no
 * specific permission (e.g., /auth/me, /auth/logout, change-password).
 * The fail-closed PermissionsGuard treats this as an explicit decision.
 */
export const IS_AUTHENTICATED_ONLY_KEY = 'isAuthenticatedOnly';
export const AuthenticatedOnly = () => SetMetadata(IS_AUTHENTICATED_ONLY_KEY, true);
