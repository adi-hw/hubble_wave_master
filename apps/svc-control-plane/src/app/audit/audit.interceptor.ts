import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

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
    const target = req.params?.id || req.url;
    const targetType = (req.route?.path || '').split('/')[1] || 'unknown';
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const correlationId = req.headers['x-correlation-id'] || undefined;

    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.auditService
            .log(`${targetType}.${method.toLowerCase()}`, `${method} ${req.url}`, {
              actor,
              actorType,
              target,
              targetType: targetType as any,
              customerId: req.body?.customerId || req.query?.customerId,
              ipAddress,
              userAgent,
              correlationId: correlationId as string | undefined,
              durationMs: Date.now() - start,
              metadata: { body: sanitizeBody(req.body) },
            })
            .catch((err) => this.logger.warn(`Audit log failed: ${err?.message || err}`));
        },
        error: () => {
          this.auditService
            .log(`${targetType}.${method.toLowerCase()}.error`, `${method} ${req.url}`, {
              actor,
              actorType,
              target,
              targetType: targetType as any,
              customerId: req.body?.customerId || req.query?.customerId,
              ipAddress,
              userAgent,
              correlationId: correlationId as string | undefined,
              durationMs: Date.now() - start,
              metadata: { body: sanitizeBody(req.body) },
              severity: 'error',
            })
            .catch((err) => this.logger.warn(`Audit log failed: ${err?.message || err}`));
        },
      }),
    );
  }
}
