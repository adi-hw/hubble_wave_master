import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const rawPath =
      typeof request?.originalUrl === 'string' ? request.originalUrl : request?.url ?? '';
    const path = rawPath.split('?')[0];
    // Allow unauthenticated health checks for orchestration probes.
    if (path === '/api/health' || path === '/api/health/' || path === '/health' || path === '/health/') {
      return true;
    }

    return super.canActivate(context);
  }
}
