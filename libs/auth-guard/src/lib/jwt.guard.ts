import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RequestContext } from './request-context.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private readonly logger: Logger
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Use JWT secret from environment with dev fallback
    const isProd = process.env.NODE_ENV === 'production';
    const jwtSecret =
      process.env.JWT_SECRET ||
      process.env.IDENTITY_JWT_SECRET ||
      (isProd ? undefined : 'dev-only-insecure-secret');

    if (!jwtSecret) {
      this.logger.error('JWT_SECRET environment variable is not configured');
      throw new UnauthorizedException('Token verification not configured');
    }

    let payload: any = null;

    try {
      payload = this.jwtService.verify(token, { secret: jwtSecret });
    } catch (err) {
      const msg = (err as any)?.message || 'Invalid token';
      this.logger.error(`JwtAuthGuard verification failed: ${msg}`, (err as Error | undefined)?.stack);
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    try {
      const tenantId = this.resolveTenantId(payload);

      const roles = Array.isArray(payload.roles) ? payload.roles : [];
      const permissions = Array.isArray((payload as any).permissions) ? (payload as any).permissions : [];
      const context: RequestContext = {
        requestId: request.requestId,
        tenantId,
        userId: payload.sub,
        roles,
        permissions,
        isPlatformAdmin: roles.includes('platform_admin'),
        isTenantAdmin: roles.includes('tenant_admin') || !!payload.is_tenant_admin,
        sessionId: payload.session_id || payload.sessionId,
        username: payload.username,
        attributes: payload.attributes,
        raw: payload,
      };

      request.user = context;
      request.context = context;
      request.tenantId = tenantId;
      return true;
    } catch (err) {
      this.logger.error(`JwtAuthGuard Error: ${(err as any).message}`, (err as Error | undefined)?.stack);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private resolveTenantId(payload: any): string {
    const tenantId = payload?.tenant_id || payload?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context missing in token');
    }
    return tenantId;
  }
}
