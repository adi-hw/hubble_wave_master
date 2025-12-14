import { Request } from 'express';

export interface RequestContext {
  requestId?: string;
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  attributes?: Record<string, unknown>;
  sessionId?: string;
  username?: string;
  raw?: Record<string, unknown>;
}

/**
 * User object attached by JWT strategy after authentication
 */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
}

/**
 * Extended Express Request with tenant and context information
 */
export interface TenantRequest extends Request {
  tenantId: string;
  tenant?: {
    id: string;
    slug: string;
    name: string;
  };
  context: RequestContext;
  user?: AuthenticatedUser;
}

/**
 * Request type for authenticated endpoints
 * Use this when @UseGuards(JwtAuthGuard) is applied
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  tenant?: {
    id: string;
    slug: string;
    name: string;
  };
  ip: string;
  headers: Request['headers'] & {
    'user-agent'?: string;
    'x-tenant-slug'?: string;
  };
}

/**
 * Request type for public endpoints that may have optional tenant context
 */
export interface PublicRequest extends Request {
  tenant?: {
    id: string;
    slug: string;
    name: string;
  };
  ip: string;
  headers: Request['headers'] & {
    'user-agent'?: string;
    'x-tenant-slug'?: string;
    host?: string;
  };
}

/**
 * Safely extracts RequestContext from a request object.
 * This handles both TenantRequest.context and fallback scenarios.
 *
 * @param req - The request object (typically from @Req() decorator)
 * @returns RequestContext if available
 * @throws Error if no valid context is found
 */
export function extractContext(req: TenantRequest | AuthenticatedRequest | Record<string, any>): RequestContext {
  // Primary: Use context from TenantRequest (set by middleware/guard)
  if ('context' in req && req.context && isValidContext(req.context)) {
    return req.context;
  }

  // Fallback: Build context from AuthenticatedUser if available
  if ('user' in req && req.user && isValidAuthenticatedUser(req.user)) {
    const user = req.user as AuthenticatedUser;
    return {
      userId: user.userId,
      username: user.username,
      tenantId: user.tenantId,
      roles: user.roles || [],
      permissions: user.permissions || [],
      isPlatformAdmin: user.roles?.includes('platform_admin') ?? false,
      isTenantAdmin: user.roles?.includes('tenant_admin') ?? false,
      sessionId: user.sessionId,
    };
  }

  throw new Error('No valid RequestContext found on request. Ensure JwtAuthGuard is applied.');
}

/**
 * Type guard to check if an object is a valid RequestContext
 */
function isValidContext(obj: unknown): obj is RequestContext {
  if (!obj || typeof obj !== 'object') return false;
  const ctx = obj as Record<string, unknown>;
  return (
    typeof ctx.userId === 'string' &&
    typeof ctx.tenantId === 'string' &&
    Array.isArray(ctx.roles)
  );
}

/**
 * Type guard to check if an object is a valid AuthenticatedUser
 */
function isValidAuthenticatedUser(obj: unknown): obj is AuthenticatedUser {
  if (!obj || typeof obj !== 'object') return false;
  const user = obj as Record<string, unknown>;
  return (
    typeof user.userId === 'string' &&
    typeof user.tenantId === 'string'
  );
}
