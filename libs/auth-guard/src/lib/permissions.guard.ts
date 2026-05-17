import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PERMISSION_MODE_KEY,
  PermissionMode,
} from './permissions.decorator';
import { IS_PUBLIC_KEY, IS_AUTHENTICATED_ONLY_KEY } from './public.decorator';
import {
  ACCESS_AUDIT_PORT,
  type AccessAuditPort,
  type AuditedDecisionProvenance,
} from './audit-port';

/**
 * Bland 403 shape per canon §28 — the body NEVER leaks which permission
 * was missing. Forensic detail goes to `AccessAuditPort.logAccessDenied`
 * (auditable, stored in the access audit log) instead of the wire.
 */
const PERMISSION_DENIED_RESPONSE = {
  statusCode: 403,
  message: 'Permission denied',
  code: 'PERMISSION_DENIED',
} as const;

/**
 * Guard that checks if the user has the required permissions.
 *
 * Behavior is fail-closed: a route reaches this guard with no
 * @RequirePermission and no @Public is treated as a configuration
 * error and access is denied. This ensures every endpoint makes
 * an explicit authorization decision.
 *
 * Must be used AFTER JwtAuthGuard since it relies on request.user being populated.
 *
 * On 403 (W2 Stream 2 PR6) the guard:
 *   1. Throws `ForbiddenException` with the canon §28 minimal shape
 *      `{ statusCode: 403, message: 'Permission denied', code:
 *      'PERMISSION_DENIED' }`. The client never sees which capability
 *      was missing.
 *   2. Calls `AccessAuditPort.logAccessDenied(...)` if the port is
 *      bound. The audit row carries §28.7 provenance: the required
 *      capability code(s), the user's actual capability set, the
 *      route identifier, and the mode (`any` / `all`).
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequirePermission('ava.admin')
 * @Controller('admin')
 * export class AdminController {}
 * ```
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    @Optional()
    @Inject(ACCESS_AUDIT_PORT)
    private readonly accessAudit?: AccessAuditPort,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Public endpoints opt-out of permission checks via @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // @AuthenticatedOnly endpoints require auth but no specific permission.
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(
      IS_AUTHENTICATED_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (authenticatedOnly) {
      const request = context.switchToHttp().getRequest();
      const user = request.user || request.context;
      if (!user) {
        throw new UnauthorizedException('Authentication required');
      }
      return true;
    }

    // Get required permissions from decorator (check both handler and class level)
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // @Roles(...) is a parallel authorization mechanism enforced by RolesGuard.
    // Treat its presence as an explicit decision and step aside.
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    const hasRoles = Array.isArray(roles) && roles.length > 0;

    // W2 Stream 3 PR-final (2026-05-17): the warn-and-allow branch
    // for unannotated handlers is retired. The AST-aware
    // `route-boundary-coverage-check` scanner is now a hard CI gate
    // and no handler can ship without a primary boundary decorator.
    //
    // Runtime defense (in-depth): if an unannotated handler somehow
    // reaches the guard at runtime (e.g. a controller added without
    // running CI, or a dynamic module registration that the scanner
    // doesn't see at PR time), the guard fails closed.
    //
    // Behavior:
    //   - In production: throw 403 with the canon §28 minimal shape +
    //     emit a `handler_missing_boundary` AccessAuditPort event so
    //     operators can query the SIEM stream for the misconfiguration.
    //   - In local dev / test (env `HW_LOUD_AUTH_MISCONFIG=true`):
    //     throw 500. The loud failure short-circuits any "it works on
    //     my machine" rollout where the developer never ran the scanner.
    if (!requiredPermissions || requiredPermissions.length === 0) {
      if (hasRoles) {
        return true;
      }
      const handler = context.getHandler();
      const cls = context.getClass();
      const target = `${cls.name}.${handler.name}`;
      this.logger.error(
        `PermissionsGuard: handler ${target} reached the guard with no @RequirePermission / @RequireCollectionAccess / @AuthenticatedOnly / @Public. The route-boundary scanner should have caught this at PR time. Failing closed.`,
      );

      if (this.accessAudit) {
        try {
          const request = context.switchToHttp().getRequest();
          const userId =
            (request?.user?.userId as string | undefined) ||
            (request?.context?.kind === 'user'
              ? (request.context.userId as string | undefined)
              : undefined) ||
            'unknown';
          this.accessAudit.logSecurityEvent({
            userId,
            kind: 'handler_missing_boundary',
            severity: 'high',
            context: {
              handler: target,
              route: request?.route?.path ?? request?.url ?? null,
              method: request?.method ?? null,
            },
          });
        } catch (err) {
          this.logger.error(
            `PermissionsGuard: failed to emit handler_missing_boundary audit event: ${(err as Error)?.message ?? err}`,
          );
        }
      }

      if (process.env['HW_LOUD_AUTH_MISCONFIG'] === 'true') {
        throw new InternalServerErrorException(
          `Handler missing boundary decision: ${target}`,
        );
      }
      throw new ForbiddenException(PERMISSION_DENIED_RESPONSE);
    }

    // Get permission mode (default to 'any')
    const mode =
      this.reflector.getAllAndOverride<PermissionMode>(PERMISSION_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'any';

    const request = context.switchToHttp().getRequest();
    const user = request.user || request.context;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Get user permissions - W2 Stream 1 vocabulary.
    const userPermissions: string[] = user.permissionCodes || [];

    // Canon §28.6 (Plan Fix 33): admin role no longer bypasses permission
    // checks here. Admin users hold explicit permission grants via the seeded
    // role_permissions rows (1817999999999-seed-admin-role.ts) and the seeded
    // CollectionAccessRules (1931100000000-seed-admin-policies.ts). They
    // reach this guard with a fully-populated permissions array like any other
    // role-bearing user.

    let hasPermission: boolean;

    if (mode === 'all') {
      hasPermission = requiredPermissions.every((perm) =>
        userPermissions.includes(perm),
      );
    } else {
      hasPermission = requiredPermissions.some((perm) =>
        userPermissions.includes(perm),
      );
    }

    if (!hasPermission) {
      const handler = context.getHandler();
      const cls = context.getClass();
      const routeIdentifier = `${cls.name}.${handler.name}`;

      this.logger.debug(
        `User denied: required ${mode === 'all' ? 'all of' : 'any of'} [${requiredPermissions.join(', ')}], ` +
          `has [${userPermissions.join(', ')}]`,
      );

      // W2 Stream 2 PR6: write the access-denied audit row before
      // throwing. Fire-and-forget — port may be unbound (tests) and
      // the throw must always reach the client even if the audit
      // write fails.
      if (this.accessAudit) {
        try {
          const provenance: AuditedDecisionProvenance = {
            effect: 'deny',
            // Level 3: deny because no rule matched the required
            // capability — analogous to §28.3 record-decision
            // level-3 default deny applied at the route surface.
            matchedLevel: 3,
            matchedRuleId: null,
            matchedPrincipal: null,
            fallbackChain: [
              `level-1: no explicit deny`,
              `level-2: no rule granted ${mode === 'all' ? 'all of' : 'any of'} [${requiredPermissions.join(', ')}]`,
              `level-3: missing capability`,
            ],
          };
          const httpReq = request as {
            method?: unknown;
            route?: { path?: unknown };
          };
          this.accessAudit.logAccessDenied({
            userId: typeof user.userId === 'string' ? user.userId : 'unknown',
            resource: { kind: 'route', identifier: routeIdentifier },
            provenance,
            requestContext: {
              requiredCodes: requiredPermissions,
              mode,
              httpMethod:
                typeof httpReq.method === 'string' ? httpReq.method : undefined,
              httpPath:
                typeof httpReq.route?.path === 'string'
                  ? httpReq.route.path
                  : undefined,
            },
          });
        } catch (err) {
          this.logger.error(
            'AccessAuditPort.logAccessDenied threw on permissions deny',
            err,
          );
        }
      }

      throw new ForbiddenException(PERMISSION_DENIED_RESPONSE);
    }

    return true;
  }
}
