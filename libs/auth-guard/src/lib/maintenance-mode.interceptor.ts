import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { RedisService } from '@hubblewave/redis';
import { SKIP_MAINTENANCE_MODE_KEY } from './skip-maintenance-mode.decorator';

/**
 * Redis key the pack install service sets to "1" while an install or rollback
 * is running. The key carries a TTL safety net (see
 * {@link MAINTENANCE_MODE_TTL_SECONDS}) so a stuck pack install eventually
 * unblocks customer traffic without operator intervention.
 *
 * Note: RedisModule prefixes all keys with `hw:`, so the on-the-wire key is
 * `hw:pack_install:active`.
 */
export const MAINTENANCE_MODE_FLAG_KEY = 'pack_install:active';

/**
 * Safety TTL for the maintenance-mode flag. If a pack install crashes between
 * setting the flag and the finally{} that clears it, customers regain
 * write access after this window without operator intervention. Long enough to
 * cover the largest realistic pack install, short enough that a stuck flag
 * does not become a multi-day outage.
 */
export const MAINTENANCE_MODE_TTL_SECONDS = 30 * 60;

/**
 * HTTP methods that mutate state and are therefore subject to the
 * maintenance-mode read-only gate. GET / HEAD / OPTIONS pass through.
 */
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Global interceptor that translates the Redis maintenance-mode flag into
 * an HTTP 503 for every state-changing request while a pack install or
 * rollback is in progress. GETs are allowed through because read traffic
 * must keep working.
 *
 * The flag itself is set and cleared by `PacksService.installPack` /
 * `rollbackPack`. This interceptor is the read-side enforcement only — it
 * never writes to Redis.
 *
 * Endpoints that must remain writeable during install (the pack install
 * controller, recovery tooling) opt out via the @SkipMaintenanceMode()
 * decorator from this library.
 */
@Injectable()
export class MaintenanceModeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MaintenanceModeInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<{ method?: string }>();
    const method = (request?.method || '').toUpperCase();

    // Read traffic is never blocked — the canon mandates that customers can
    // always reach their data.
    if (!STATE_CHANGING_METHODS.has(method)) {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MAINTENANCE_MODE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const active = await this.redis.exists(MAINTENANCE_MODE_FLAG_KEY);
    if (!active) {
      return next.handle();
    }

    this.logger.warn(
      `Blocked ${method} request: pack install in progress (maintenance mode active)`,
    );
    throw new HttpException(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: 'Pack install in progress; instance is read-only. Retry after the install completes.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
