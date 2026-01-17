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

    // Admin users have full access to collection metadata (schema operations)
    // Check multiple possible admin indicators from JWT payload
    if (
      rawUser.isAdmin ||
      rawUser.is_admin ||
      (Array.isArray(rawUser.roles) && rawUser.roles.includes('admin'))
    ) {
      return true;
    }

    // Check for system.admin or collection-related permissions
    const permissions = rawUser.permissions || [];
    if (Array.isArray(permissions)) {
      if (
        permissions.includes('system.admin') ||
        permissions.includes('collection.admin') ||
        permissions.includes('collection.create') ||
        permissions.includes('collection.read') ||
        permissions.includes('collection.update')
      ) {
        return true;
      }
    }

    // Extract Collection ID from route params
    const collectionId = request.params['collectionId'] || request.params['id'];

    // If no collection ID, allow access (global endpoints like /collections list)
    if (!collectionId) {
      return true;
    }

    // Build a properly typed UserAccessContext from the raw JWT payload
    const user: UserAccessContext = {
      id: rawUser.sub || rawUser.id || '',
      email: rawUser.email || '',
      roleIds: rawUser.roleIds || rawUser.role_ids || [],
      teamIds: rawUser.teamIds || rawUser.team_ids || [],
      groupIds: rawUser.groupIds || rawUser.group_ids || [],
      departmentId: rawUser.departmentId || rawUser.department_id,
      locationId: rawUser.locationId || rawUser.location_id,
    };

    // Determine Operation
    const operation = this.determineOperation(request.method);

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

      // Store the matching rule or permissions in request for downstream use
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
}
