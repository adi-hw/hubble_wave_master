import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AccessRuleService } from '../services/access-rule.service';
import { UserAccessContext } from '../types/access.types';

@Injectable()
export class PropertyAccessInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PropertyAccessInterceptor.name);

  constructor(private readonly accessService: AccessRuleService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const rawUser = (request as any).user;
    // Support both :id and :collectionId route parameters
    const collectionId = request.params.collectionId || request.params.id;

    if (!rawUser || !collectionId) {
      return next.handle();
    }

    // Skip property access filtering for users with the bypass permission or
    // operation-agnostic schema admin. `isAdmin` / `is_admin` are the cached
    // forms of "holds platform.bypass_authz".
    const permissions: string[] = Array.isArray(rawUser.permissions) ? rawUser.permissions : [];
    const isAdmin = rawUser.isAdmin || rawUser.is_admin ||
      permissions.includes('platform.bypass_authz') ||
      permissions.includes('system.admin') ||
      permissions.includes('collection.admin');

    if (isAdmin) {
      return next.handle();
    }

    // Build UserAccessContext from raw JWT payload
    const user: UserAccessContext = {
      id: rawUser.sub || rawUser.id || '',
      email: rawUser.email || '',
      roleIds: rawUser.roleIds || rawUser.role_ids || [],
      teamIds: rawUser.teamIds || rawUser.team_ids || [],
      groupIds: rawUser.groupIds || rawUser.group_ids || [],
      departmentId: rawUser.departmentId || rawUser.department_id,
      locationId: rawUser.locationId || rawUser.location_id,
    };

    return next.handle().pipe(
      switchMap((data) => from(this.applyPropertyAccess(data, collectionId, user))),
      catchError((error) => {
        this.logger.error(`Property access interceptor error: ${error.message}`, error.stack);
        throw error;
      })
    );
  }

  private async applyPropertyAccess(
    data: any,
    collectionId: string,
    user: UserAccessContext
  ): Promise<any> {
    try {
      const permissions = await this.accessService.getEffectivePermissions(collectionId, user);
      const propertyRules = permissions.propertyAccess;

      if (!propertyRules || propertyRules.length === 0) {
        return data;
      }

      if (Array.isArray(data)) {
        return data.map(item => this.maskProperties(item, propertyRules));
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) {
          data.data = data.data.map((item: any) => this.maskProperties(item, propertyRules));
          return data;
        }
        return this.maskProperties(data, propertyRules);
      }

      return data;
    } catch (error) {
      // Fail closed: if masking cannot be applied, refuse to return data rather
      // than risk leaking sensitive properties to a user who should not see them.
      const err = error as Error;
      this.logger.error(
        `Failed to apply property access rules for collection ${collectionId} / user ${user.id}: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException('Property masking failed');
    }
  }

  private maskProperties(item: any, rules: any[]): any {
    const maskedItem = { ...item };

    for (const rule of rules) {
      if (!rule.canRead) {
        delete maskedItem[rule.propertyCode];
      } else if (rule.isMasked) {
        maskedItem[rule.propertyCode] = rule.maskValue || '****';
      }
    }
    return maskedItem;
  }
}
