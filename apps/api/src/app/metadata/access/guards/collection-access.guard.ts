import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AccessRuleService } from '../services/access-rule.service';
import { UserAccessContext, Operation } from '../types/access.types';
import { Request } from 'express';

/**
 * Guards collection metadata endpoints by mapping the HTTP method to the
 * specific permission required for that operation.
 *
 * Permission semantics:
 *   - system.admin grants every operation AND bypasses per-collection
 *     access rules. This is the cross-instance platform superuser.
 *   - The `admin` role grants every operation AND bypasses per-collection
 *     access rules within the instance — the instance admin.
 *   - collection.admin satisfies the operation gate for any HTTP verb but
 *     STILL passes through AccessRuleService for the requested
 *     collectionId. It is operation-agnostic, NOT collection-agnostic.
 *   - collection.read  -> GET only
 *   - collection.create -> POST only
 *   - collection.update -> PUT / PATCH only
 *   - collection.delete -> DELETE only
 *
 * A user holding `collection.read` MUST NOT create / update / delete, and
 * a user holding `collection.admin` MUST NOT mutate collections they have
 * not been granted access to via AccessRuleService.
 */
@Injectable()
export class CollectionAccessGuard implements CanActivate {
  private readonly logger = new Logger(CollectionAccessGuard.name);

  constructor(
    private readonly accessService: AccessRuleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawUser = (request as any).user;

    if (!rawUser) {
      throw new UnauthorizedException('User not authenticated');
    }

    const operation = this.determineOperation(request.method);
    const acceptablePermissions = this.permissionsForOperation(operation, request);

    // Admin role grants full schema access. W2 Stream 1 PR1: read role
    // codes from `roleCodes` (`AuthenticatedUser` / `UserRequestContext`
    // post-Stream-1 vocabulary). The fallbacks on `isAdmin` / `is_admin`
    // / legacy `roles` cover transient test fixtures that still build the
    // pre-Stream-1 shape inline.
    const isAdminRole =
      rawUser.isAdmin ||
      rawUser.is_admin ||
      (Array.isArray(rawUser.roleCodes) && rawUser.roleCodes.includes('admin')) ||
      (Array.isArray(rawUser.roles) && rawUser.roles.includes('admin'));

    const permissions: string[] = Array.isArray(rawUser.permissionCodes)
      ? rawUser.permissionCodes
      : Array.isArray(rawUser.permissions)
        ? rawUser.permissions
        : [];

    // Only system.admin (platform superuser) and the admin role bypass
    // the per-collection access-rule check below. collection.admin is
    // intentionally NOT in this set — it is operation-agnostic, not
    // collection-agnostic, and is checked against AccessRuleService
    // alongside every other collection permission.
    const hasBlanketBypass =
      isAdminRole || permissions.includes('system.admin');

    if (hasBlanketBypass) {
      return true;
    }

    // collection.admin satisfies any operation gate but does not skip the
    // per-collection rule evaluation.
    const hasOperationAgnostic = permissions.includes('collection.admin');

    const collectionId = request.params['collectionId'] || request.params['id'];

    const hasAnyAcceptable =
      hasOperationAgnostic ||
      acceptablePermissions.some((slug) => permissions.includes(slug));

    // Global (no :collectionId) endpoints: enforce the operation's permission directly.
    if (!collectionId) {
      if (!hasAnyAcceptable) {
        throw new ForbiddenException(
          `One of [${acceptablePermissions.join(', ')}] required for this operation`,
        );
      }
      return true;
    }

    // Record-scoped endpoints: the user must hold an acceptable
    // permission (or collection.admin) AND pass the per-collection access rules.
    if (!hasAnyAcceptable) {
      throw new ForbiddenException(
        `One of [${acceptablePermissions.join(', ')}] required for this operation`,
      );
    }

    const user: UserAccessContext = {
      id: rawUser.sub || rawUser.id || '',
      email: rawUser.email || '',
      roleIds: rawUser.roleIds || rawUser.role_ids || [],
      teamIds: rawUser.teamIds || rawUser.team_ids || [],
      groupIds: rawUser.groupIds || rawUser.group_ids || [],
      departmentId: rawUser.departmentId || rawUser.department_id,
      locationId: rawUser.locationId || rawUser.location_id,
    };

    try {
      const result = await this.accessService.checkAccess({
        user,
        collectionId,
        operation,
      });

      if (!result.allowed) {
        throw new ForbiddenException(
          result.reason || `Access denied for ${operation} on collection ${collectionId}`,
        );
      }

      (request as any).accessResult = result;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Access check failed: ${(error as Error).message}`, (error as Error).stack);
      throw new ForbiddenException('Access check failed');
    }
  }

  private determineOperation(method: string): Operation {
    switch (method.toUpperCase()) {
      case 'GET': return 'read';
      case 'POST': return 'create';
      case 'PUT':
      case 'PATCH': return 'update';
      case 'DELETE': return 'delete';
      default: return 'read';
    }
  }

  /**
   * Per ADR-12, the per-feature slugs (metadata.collections.edit,
   * metadata.properties.edit, etc.) satisfy the corresponding operation
   * gate alongside the coarse-grained collection.* slugs. The arrays are
   * checked with OR semantics — any single matching slug allows the
   * operation. Per-collection access rules still apply on top.
   *
   * Some routes carry their own dedicated slug that the generic
   * operation-to-slug mapping wouldn't include. Two examples today:
   *   - /collections/:id/spreadsheet/audit-edit-mode-entry — only the
   *     `metadata.collections.spreadsheet.write` permission should let
   *     a delegated user reach the handler (ADR-16). Without this
   *     route-aware expansion the guard rejects the request before the
   *     handler's explicit check runs, so the spreadsheet-write slug
   *     is functionally unreachable for non-admins.
   *   - /collections/:id/publish-preview — read-style introspection
   *     that reuses the read slug list; nothing extra needed.
   *
   * Add new route-specific expansions here when introducing a feature
   * slug that wouldn't naturally fall under collection.* or
   * metadata.collections.edit.
   */
  private permissionsForOperation(operation: Operation, request?: Request): string[] {
    const base = this.basePermissionsForOperation(operation);
    if (!request) return base;
    const path = (request.route?.path ?? request.path ?? request.url ?? '').toString();
    if (path.includes('/spreadsheet/audit-edit-mode-entry')) {
      return [...base, 'metadata.collections.spreadsheet.write'];
    }
    return base;
  }

  private basePermissionsForOperation(operation: Operation): string[] {
    switch (operation) {
      case 'read':
        return ['collection.read'];
      case 'create':
        return ['collection.create', 'metadata.collections.edit'];
      case 'update':
        return ['collection.update', 'metadata.collections.edit'];
      case 'delete':
        return ['collection.delete'];
      default:
        return ['collection.read'];
    }
  }
}
