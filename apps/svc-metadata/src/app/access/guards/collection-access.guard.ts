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
 *   - system.admin and collection.admin grant every operation.
 *   - collection.read  -> GET only
 *   - collection.create -> POST only
 *   - collection.update -> PUT / PATCH only
 *   - collection.delete -> DELETE only
 *
 * A user holding `collection.read` MUST NOT be able to create, update, or
 * delete collections, and vice versa.
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
    const requiredPermission = this.permissionForOperation(operation);

    // Admin role grants full schema access.
    const isAdminRole =
      rawUser.isAdmin ||
      rawUser.is_admin ||
      (Array.isArray(rawUser.roles) && rawUser.roles.includes('admin'));

    const permissions: string[] = Array.isArray(rawUser.permissions) ? rawUser.permissions : [];

    // Only system.admin and collection.admin are operation-agnostic.
    const hasBlanketPermission =
      permissions.includes('system.admin') || permissions.includes('collection.admin');

    if (isAdminRole || hasBlanketPermission) {
      return true;
    }

    const collectionId = request.params['collectionId'] || request.params['id'];

    // Global (no :collectionId) endpoints: enforce the operation's permission directly.
    if (!collectionId) {
      if (!permissions.includes(requiredPermission)) {
        throw new ForbiddenException(
          `Permission '${requiredPermission}' required for this operation`,
        );
      }
      return true;
    }

    // Record-scoped endpoints: the user must hold the operation permission AND
    // pass the per-collection access rules.
    if (!permissions.includes(requiredPermission)) {
      throw new ForbiddenException(
        `Permission '${requiredPermission}' required for this operation`,
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

  private permissionForOperation(operation: Operation): string {
    switch (operation) {
      case 'read': return 'collection.read';
      case 'create': return 'collection.create';
      case 'update': return 'collection.update';
      case 'delete': return 'collection.delete';
      default: return 'collection.read';
    }
  }
}
