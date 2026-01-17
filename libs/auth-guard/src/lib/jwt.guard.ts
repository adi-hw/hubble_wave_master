import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RequestContext } from './request-context.interface';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private readonly logger: Logger,
    private reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Use JWT secret from environment - NO fallback for security
    const jwtSecret = process.env.JWT_SECRET || process.env.IDENTITY_JWT_SECRET;

    if (!jwtSecret) {
      this.logger.error(
        'SECURITY ERROR: JWT_SECRET environment variable is not configured. ' +
        'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
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

    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const permissions = Array.isArray((payload as any).permissions) ? (payload as any).permissions : [];
    const requestContext: RequestContext = {
      userId: payload.sub,
      roles,
      permissions,
      isAdmin: roles.includes('admin') || !!payload.is_admin,
      sessionId: payload.session_id || payload.sessionId,
      username: payload.username,
      attributes: payload.attributes,
      raw: payload,
    };

    request.user = requestContext;
    request.context = requestContext;
    return true;
  }
}
