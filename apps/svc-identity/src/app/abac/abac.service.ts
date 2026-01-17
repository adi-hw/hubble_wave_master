import { Injectable, Logger } from '@nestjs/common';

type Context = Record<string, unknown>;

interface AbacCondition {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'greater_than' | 'less_than';
  value: unknown;
}

/**
 * Attribute-Based Access Control Service
 *
 * ABAC policies are evaluated through the AccessRules system.
 * This service provides the evaluation interface for ABAC checks.
 *
 * Security: This service defaults to DENY if no matching rule is found.
 */
@Injectable()
export class AbacService {
  private readonly logger = new Logger(AbacService.name);

  async isAllowed(
    resource: string,
    action: string,
    context: Context,
    resourceType: 'collection' | 'property' | 'action' = 'action',
  ): Promise<boolean> {
    if (!resource || !action) {
      this.logger.warn(`ABAC check failed: missing resource or action`);
      return false;
    }

    const userId = context['userId'] as string | undefined;
    const roles = context['roles'] as string[] | undefined;
    const permissions = context['permissions'] as string[] | undefined;
    const isAdmin = context['isAdmin'] as boolean | undefined;

    if (!userId) {
      this.logger.warn(`ABAC check denied: no userId in context for ${resourceType}:${resource}:${action}`);
      return false;
    }

    // System administrators have full access
    if (isAdmin === true) {
      return true;
    }

    // Check explicit permissions
    if (permissions && Array.isArray(permissions)) {
      const requiredPermission = this.buildPermissionString(resourceType, resource, action);

      if (permissions.includes(requiredPermission)) {
        return true;
      }

      // Check for wildcard permissions
      const wildcardPermission = `${resourceType}.*`;
      if (permissions.includes(wildcardPermission)) {
        return true;
      }

      // Check for admin-level permission on resource type
      const adminPermission = `${resourceType}.admin`;
      if (permissions.includes(adminPermission)) {
        return true;
      }
    }

    // Check role-based permissions
    if (roles && Array.isArray(roles)) {
      const hasAdminRole = roles.some(role =>
        role.toLowerCase() === 'admin' ||
        role.toLowerCase() === 'system_admin' ||
        role.toLowerCase() === 'superadmin'
      );

      if (hasAdminRole) {
        return true;
      }
    }

    // Default to DENY for security
    this.logger.debug(`ABAC check denied: no matching rule for ${resourceType}:${resource}:${action} (user: ${userId})`);
    return false;
  }

  private buildPermissionString(resourceType: string, resource: string, action: string): string {
    return `${resourceType}.${resource}.${action}`.toLowerCase();
  }

  evaluateCondition(condition: AbacCondition, context: Context): boolean {
    const contextValue = context[condition.attribute];

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'not_equals':
        return contextValue !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(contextValue);
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(String(condition.value));
      case 'greater_than':
        return typeof contextValue === 'number' && contextValue > (condition.value as number);
      case 'less_than':
        return typeof contextValue === 'number' && contextValue < (condition.value as number);
      default:
        return false;
    }
  }
}
