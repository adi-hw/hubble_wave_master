import { Request } from 'express';

export interface RequestContext {
  userId: string;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
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
  roles: string[];
  permissions: string[];
  sessionId?: string;
}

/**
 * Extended Express Request with context information
 */
export interface InstanceRequest extends Request {
  context: RequestContext;
  user?: AuthenticatedUser;
}

// Deprecated alias for backward compatibility
export type TenantRequest = InstanceRequest;

/**
 * Request type for authenticated endpoints
 * Use this when @UseGuards(JwtAuthGuard) is applied
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  ip: string;
  headers: Request['headers'] & {
    'user-agent'?: string;
  };
}

/**
 * Request type for public endpoints
 */
export interface PublicRequest extends Request {
  ip: string;
  headers: Request['headers'] & {
    'user-agent'?: string;
    host?: string;
  };
}

/**
 * Safely extracts RequestContext from a request object.
 *
 * @param req - The request object (typically from @Req() decorator)
 * @returns RequestContext if available
 * @throws Error if no valid context is found
 */
export function extractContext(req: InstanceRequest | AuthenticatedRequest | Record<string, any>): RequestContext {
  // Primary: Use context from InstanceRequest (set by middleware/guard)
  if ('context' in req && req.context && isValidContext(req.context)) {
    return req.context;
  }

  // Fallback: Build context from AuthenticatedUser if available
  if ('user' in req && req.user && isValidAuthenticatedUser(req.user)) {
    const user = req.user as AuthenticatedUser;
    return {
      userId: user.userId,
      username: user.username,
      roles: user.roles || [],
      permissions: user.permissions || [],
      isAdmin: user.roles?.includes('admin') ?? false,
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
    typeof user.userId === 'string'
  );
}
