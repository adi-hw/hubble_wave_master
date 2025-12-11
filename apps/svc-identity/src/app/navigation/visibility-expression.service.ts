import { Injectable, Logger } from '@nestjs/common';
import { NavItemVisibility } from '@eam-platform/tenant-db';
import { ModuleSecurity } from '@eam-platform/tenant-db';

/**
 * User context for visibility evaluation
 */
export interface VisibilityContext {
  /** User's assigned roles */
  roles: string[];
  /** User's effective permissions */
  permissions: string[];
  /** Enabled feature flags */
  featureFlags: string[];
  /** Active context tags */
  contextTags: string[];
  /** Additional user attributes for expression evaluation */
  userAttributes?: Record<string, unknown>;
}

/**
 * VisibilityExpressionService - Evaluates visibility rules for navigation items
 *
 * Supports:
 * - rolesAny: User must have at least one of the specified roles
 * - rolesAll: User must have all of the specified roles
 * - permissionsAny: User must have at least one of the specified permissions
 * - featureFlagsAny: At least one feature flag must be enabled
 * - expression: DSL expression for complex rules
 */
@Injectable()
export class VisibilityExpressionService {
  private readonly logger = new Logger(VisibilityExpressionService.name);

  /**
   * Check if a nav item is visible given the user context
   */
  isVisible(
    visibility: NavItemVisibility | ModuleSecurity | undefined | null,
    context: VisibilityContext
  ): boolean {
    // No visibility rules = visible to everyone
    if (!visibility) {
      return true;
    }

    // Check rolesAll first (most restrictive)
    if (visibility.rolesAll?.length) {
      const hasAllRoles = visibility.rolesAll.every((role) =>
        context.roles.includes(role)
      );
      if (!hasAllRoles) {
        return false;
      }
    }

    // Check rolesAny
    if (visibility.rolesAny?.length) {
      const hasAnyRole = visibility.rolesAny.some((role) =>
        context.roles.includes(role)
      );
      if (!hasAnyRole) {
        return false;
      }
    }

    // Check permissionsAny
    if (visibility.permissionsAny?.length) {
      const hasAnyPermission = visibility.permissionsAny.some((perm) =>
        context.permissions.includes(perm)
      );
      if (!hasAnyPermission) {
        return false;
      }
    }

    // Check feature flags (only in NavItemVisibility)
    const navVisibility = visibility as NavItemVisibility;
    if (navVisibility.featureFlagsAny?.length) {
      const hasAnyFlag = navVisibility.featureFlagsAny.some((flag) =>
        context.featureFlags.includes(flag)
      );
      if (!hasAnyFlag) {
        return false;
      }
    }

    // Check feature flag (single flag in ModuleSecurity)
    const moduleSecurity = visibility as ModuleSecurity;
    if (moduleSecurity.featureFlag) {
      if (!context.featureFlags.includes(moduleSecurity.featureFlag)) {
        return false;
      }
    }

    // Check DSL expression
    if (visibility.expression) {
      try {
        const result = this.evaluateExpression(visibility.expression, context);
        if (!result) {
          return false;
        }
      } catch (error) {
        this.logger.warn(`Expression evaluation failed: ${visibility.expression}`, error);
        // Fail closed - if expression fails, hide the item
        return false;
      }
    }

    return true;
  }

  /**
   * Check if context tags match the required tags
   */
  matchesContextTags(requiredTags: string[] | undefined, contextTags: string[]): boolean {
    if (!requiredTags?.length) {
      return true;
    }

    // Check for negative tags (e.g., 'mobile-hidden' means hide on mobile)
    for (const tag of requiredTags) {
      if (tag.startsWith('!')) {
        // Negative tag - should NOT be in context
        const negatedTag = tag.substring(1);
        if (contextTags.includes(negatedTag)) {
          return false;
        }
      }
    }

    // Check for positive tags - at least one must match (OR logic)
    const positiveTags = requiredTags.filter((t) => !t.startsWith('!'));
    if (positiveTags.length > 0) {
      return positiveTags.some((tag) => contextTags.includes(tag));
    }

    return true;
  }

  /**
   * Evaluate a DSL expression against the user context
   *
   * Supported syntax:
   * - hasRole('admin')
   * - hasPermission('asset.create')
   * - hasFeature('beta_nav')
   * - user.department == 'IT'
   * - env == 'prod'
   * - device == 'mobile'
   * - Boolean operators: &&, ||, !
   * - Comparison operators: ==, !=
   * - Parentheses for grouping
   */
  evaluateExpression(expression: string, context: VisibilityContext): boolean {
    try {
      // Create a safe evaluation context
      const evalContext = {
        // Helper functions
        hasRole: (role: string) => context.roles.includes(role),
        hasPermission: (perm: string) => context.permissions.includes(perm),
        hasFeature: (flag: string) => context.featureFlags.includes(flag),
        hasTag: (tag: string) => context.contextTags.includes(tag),

        // User attributes
        user: context.userAttributes || {},

        // Built-in context
        roles: context.roles,
        permissions: context.permissions,
        featureFlags: context.featureFlags,
        contextTags: context.contextTags,
      };

      // Sanitize expression - only allow safe characters
      const sanitized = expression.replace(/[^a-zA-Z0-9_.\s()'",=!&|<>-]/g, '');

      // Build a function that evaluates the expression
      const fn = new Function(
        'ctx',
        `with(ctx) { return !!(${sanitized}); }`
      );

      return fn(evalContext);
    } catch (error) {
      this.logger.error(`Failed to evaluate expression: ${expression}`, error);
      return false;
    }
  }

  /**
   * Merge multiple visibility rules (AND logic)
   */
  mergeVisibilityRules(
    ...rules: (NavItemVisibility | undefined | null)[]
  ): NavItemVisibility {
    const merged: NavItemVisibility = {};

    for (const rule of rules) {
      if (!rule) continue;

      // Merge rolesAny (intersection - must match any in all sets)
      if (rule.rolesAny?.length) {
        merged.rolesAny = merged.rolesAny
          ? [...new Set([...merged.rolesAny, ...rule.rolesAny])]
          : [...rule.rolesAny];
      }

      // Merge rolesAll (union - must have all from all sets)
      if (rule.rolesAll?.length) {
        merged.rolesAll = merged.rolesAll
          ? [...new Set([...merged.rolesAll, ...rule.rolesAll])]
          : [...rule.rolesAll];
      }

      // Merge permissionsAny
      if (rule.permissionsAny?.length) {
        merged.permissionsAny = merged.permissionsAny
          ? [...new Set([...merged.permissionsAny, ...rule.permissionsAny])]
          : [...rule.permissionsAny];
      }

      // Merge feature flags
      if (rule.featureFlagsAny?.length) {
        merged.featureFlagsAny = merged.featureFlagsAny
          ? [...new Set([...merged.featureFlagsAny, ...rule.featureFlagsAny])]
          : [...rule.featureFlagsAny];
      }

      // Merge expressions with AND
      if (rule.expression) {
        merged.expression = merged.expression
          ? `(${merged.expression}) && (${rule.expression})`
          : rule.expression;
      }
    }

    return merged;
  }
}
