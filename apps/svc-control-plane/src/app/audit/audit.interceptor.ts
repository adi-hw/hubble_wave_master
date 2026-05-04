import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, mergeMap, tap } from 'rxjs';
import { AuditService } from './audit.service';

/**
 * Operations whose audit trail is part of the authorization decision itself —
 * compliance and incident-response would be unable to reconstruct the action
 * without the audit record. For these, we block the response on a successful
 * audit write and fail the request with 503 if persistence fails. All other
 * mutations fall back to the warn-and-continue policy.
 */
const HIGH_STAKES_PATHS: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: 'DELETE', pattern: /^\/customers\/[^/]+$/i },
  { method: 'POST', pattern: /^\/licenses\/[^/]+\/revoke$/i },
  { method: 'POST', pattern: /^\/subscriptions\/[^/]+\/cancel$/i },
  { method: 'PATCH', pattern: /^\/subscriptions\/[^/]+\/cancel$/i },
];

function isHighStakes(method: string, url: string): boolean {
  const path = (url || '').split('?')[0] || '';
  return HIGH_STAKES_PATHS.some((entry) => entry.method === method && entry.pattern.test(path));
}

const SENSITIVE_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'creditCard',
  'ssn',
  'socialSecurityNumber',
];

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
  Global audit interceptor to log mutating actions.
  Skips GET/HEAD/OPTIONS to reduce noise.
  Sanitizes sensitive fields before logging.
*/
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method?.toUpperCase?.() || '';

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const user = req.user;
    const actor = user?.email || 'system';
    const actorType = user ? 'user' : 'system';
    const targetType = (req.route?.path || '').split('/')[1] || 'unknown';
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const correlationId = req.headers['x-correlation-id'] || undefined;

    const start = Date.now();
    const highStakes = isHighStakes(method, req.url || '');

    const buildPayload = (
      result: 'success' | 'failure',
      error?: unknown,
    ) => ({
      userId: user?.id,
      customerId: req.body?.customerId || req.query?.customerId,
      resourceType: targetType,
      resourceId: req.params?.id,
      result,
      errorMessage: error ? (error as { message?: string })?.message || String(error) : undefined,
      ipAddress,
      userAgent,
      requestId: correlationId,
      details: {
        method,
        url: req.url,
        actor,
        actorType,
        durationMs: Date.now() - start,
        body: sanitizeBody(req.body),
      },
    });

    if (highStakes) {
      // For high-stakes operations the audit write must succeed before we
      // consider the request complete. If persistence fails we abort the
      // response with 503 so callers retry; better to surface the error than
      // to silently complete an action with no audit trail.
      return next.handle().pipe(
        mergeMap((value) =>
          from(
            this.auditService
              .log(`${targetType}.${method.toLowerCase()}`, buildPayload('success'))
              .catch((err) => {
                this.logger.error(
                  `High-stakes audit failed for ${method} ${req.url}: ${err?.message || err}`,
                );
                throw new HttpException(
                  'Audit log write failed; high-stakes operation cannot be confirmed',
                  HttpStatus.SERVICE_UNAVAILABLE,
                );
              }),
          ).pipe(mergeMap(() => Promise.resolve(value))),
        ),
        tap({
          error: (error) => {
            this.auditService
              .log(`${targetType}.${method.toLowerCase()}`, buildPayload('failure', error))
              .catch((err) =>
                this.logger.warn(`Audit log failed (failure path): ${err?.message || err}`),
              );
          },
        }),
      );
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.auditService
            .log(`${targetType}.${method.toLowerCase()}`, buildPayload('success'))
            .catch((err) => this.logger.warn(`Audit log failed: ${err?.message || err}`));
        },
        error: (error) => {
          this.auditService
            .log(`${targetType}.${method.toLowerCase()}`, buildPayload('failure', error))
            .catch((err) => this.logger.warn(`Audit log failed: ${err?.message || err}`));
        },
      }),
    );
  }
}
