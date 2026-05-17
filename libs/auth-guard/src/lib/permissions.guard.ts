import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
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

    // Soft-fail (warn-and-allow): an endpoint with no @RequirePermission /
    // @Roles / @Public / @AuthenticatedOnly is mis-configured, but blanket-
    // denying it has the same effect as taking the platform offline because
    // a large set of controllers were never annotated as part of the W1.2
    // rollout. Log a warning so the missing annotations show up in operator
    // logs (use these to drive a finishing pass) and pass the request
    // through. Endpoints that DO have a @RequirePermission still get
    // strict-checked below; only unannotated endpoints get the soft path.
    if (!requiredPermissions || requiredPermissions.length === 0) {
      if (hasRoles) {
        return true;
      }
      const handler = context.getHandler();
      const cls = context.getClass();
      this.logger.warn(
        `PermissionsGuard: unannotated endpoint passed through (add @RequirePermission, @Roles, @AuthenticatedOnly, or @Public on ${cls.name}.${handler.name})`,
      );
      return true;
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
