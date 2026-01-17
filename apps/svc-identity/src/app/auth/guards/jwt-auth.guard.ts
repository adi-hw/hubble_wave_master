import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    this.logger.debug('JWT Guard checking', {
      url: request.url,
      method: request.method,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20),
    });

    // Otherwise require JWT authentication
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info?: any) {
    if (err || !user) {
      this.logger.warn('JWT authentication failed', {
        error: err?.message,
        info: info?.message,
        hasUser: !!user,
      });
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
