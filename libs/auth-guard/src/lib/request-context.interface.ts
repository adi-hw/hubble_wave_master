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
