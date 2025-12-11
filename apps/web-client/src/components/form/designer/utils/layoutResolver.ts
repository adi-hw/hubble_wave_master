/**
 * Layout Resolution Utilities
 *
 * Resolves the effective layout for a user based on the hierarchy:
 * Platform → Tenant Admin → Role → User
 *
 * Handles fallback logic and ensures users always have a valid layout.
 */

import {
  DesignerLayout,
  LayoutSource,
  LayoutResolutionContext,
  ResolvedLayout,
  LayoutOption,
  FieldProtection,
  LayoutVersionChain,
  PlatformLayout,
  TenantAdminLayout,
  RoleLayout,
  UserLayoutPreference,
  createEmptyLayout,
} from '../types';
import {
  mergeLayouts,
  needsMigration,
  CURRENT_SCHEMA_VERSION,
} from './layoutMigration';

// ============================================================================
// Layout Repository Interface
// ============================================================================

/**
 * Interface for fetching layouts from various sources
 * This should be implemented by your data layer
 */
export interface LayoutRepository {
  getPlatformLayout(tableCode: string): Promise<PlatformLayout | null>;
  getTenantAdminLayout(tenantId: string, tableCode: string): Promise<TenantAdminLayout | null>;
  getRoleLayouts(tenantId: string, roleCodes: string[], tableCode: string): Promise<RoleLayout[]>;
  getUserLayout(userId: string, tableCode: string): Promise<UserLayoutPreference | null>;
  saveUserLayout(userId: string, tableCode: string, layout: UserLayoutPreference): Promise<void>;
}

// ============================================================================
// Layout Resolution
// ============================================================================

/**
 * Resolves the effective layout for a user
 */
export async function resolveLayout(
  context: LayoutResolutionContext,
  repository: LayoutRepository
): Promise<ResolvedLayout> {
  const { tenantId, userId, userRoles, tableCode, preferUserLayout = true } = context;

  // Fetch all available layouts in parallel
  const [platformLayout, tenantLayout, roleLayouts, userLayout] = await Promise.all([
    repository.getPlatformLayout(tableCode),
    repository.getTenantAdminLayout(tenantId, tableCode),
    repository.getRoleLayouts(tenantId, userRoles, tableCode),
    preferUserLayout ? repository.getUserLayout(userId, tableCode) : Promise.resolve(null),
  ]);

  // Build the available layouts list
  const availableLayouts: LayoutOption[] = [];

  if (platformLayout) {
    availableLayouts.push({
      id: platformLayout.id,
      name: 'Platform Default',
      source: 'platform',
      isActive: false,
      isDefault: platformLayout.isDefault,
      lastModified: platformLayout.createdAt,
    });
  }

  if (tenantLayout) {
    availableLayouts.push({
      id: tenantLayout.id,
      name: tenantLayout.name,
      source: 'tenant_admin',
      isActive: false,
      isDefault: tenantLayout.isDefault,
      version: tenantLayout.version,
      lastModified: tenantLayout.updatedAt,
      modifiedBy: tenantLayout.createdBy,
    });
  }

  for (const roleLayout of roleLayouts) {
    availableLayouts.push({
      id: roleLayout.id,
      name: `${roleLayout.name} (${roleLayout.roleCode})`,
      source: 'role',
      isActive: roleLayout.isActive,
      isDefault: false,
      lastModified: roleLayout.updatedAt,
      modifiedBy: roleLayout.createdBy,
    });
  }

  if (userLayout) {
    availableLayouts.push({
      id: userLayout.id,
      name: userLayout.layoutName,
      source: 'user',
      isActive: userLayout.isActive,
      isDefault: userLayout.isDefault,
      lastModified: userLayout.updatedAt,
    });
  }

  // Determine the effective layout using the hierarchy
  const { layout, source, sourceId, versionChain } = resolveEffectiveLayout(
    platformLayout,
    tenantLayout,
    roleLayouts,
    userLayout
  );

  // Collect effective field protections
  const effectiveProtections = collectProtections(tenantLayout, roleLayouts);

  // Check for pending updates
  const hasPendingUpdate = checkForPendingUpdates(
    userLayout,
    tenantLayout,
    platformLayout
  );

  // Mark the active layout in the list
  const activeIndex = availableLayouts.findIndex((l) => l.id === sourceId);
  if (activeIndex !== -1) {
    availableLayouts[activeIndex].isActive = true;
  }

  return {
    layout,
    source,
    sourceId,
    effectiveProtections,
    versionChain,
    hasUserCustomization: !!userLayout?.isActive,
    hasPendingUpdate,
    availableLayouts,
  };
}

/**
 * Resolves the effective layout following the hierarchy
 */
function resolveEffectiveLayout(
  platformLayout: PlatformLayout | null,
  tenantLayout: TenantAdminLayout | null,
  roleLayouts: RoleLayout[],
  userLayout: UserLayoutPreference | null
): {
  layout: DesignerLayout;
  source: LayoutSource;
  sourceId: string;
  versionChain: LayoutVersionChain;
} {
  // Build the version chain
  const versionChain: LayoutVersionChain = {
    platformVersion: platformLayout?.platformVersion || '0.0.0',
    platformSchemaVersion: platformLayout?.schemaVersion || CURRENT_SCHEMA_VERSION,
    tenantAdminVersion: tenantLayout?.version,
    roleLayoutVersion: roleLayouts[0]?.basedOnTenantVersion,
    userLayoutVersion: userLayout?.basedOnVersion,
  };

  // Priority 1: User customized layout
  if (userLayout?.isActive && userLayout.layoutData) {
    return {
      layout: userLayout.layoutData,
      source: 'user',
      sourceId: userLayout.id,
      versionChain,
    };
  }

  // Priority 2: Role-specific layout (highest priority role)
  const activeRoleLayout = roleLayouts
    .filter((r) => r.isActive)
    .sort((a, b) => b.priority - a.priority)[0];

  if (activeRoleLayout) {
    return {
      layout: activeRoleLayout.layout,
      source: 'role',
      sourceId: activeRoleLayout.id,
      versionChain,
    };
  }

  // Priority 3: Tenant admin layout
  if (tenantLayout?.isPublished && tenantLayout.isDefault) {
    return {
      layout: tenantLayout.layout,
      source: 'tenant_admin',
      sourceId: tenantLayout.id,
      versionChain,
    };
  }

  // Priority 4: Platform layout
  if (platformLayout) {
    return {
      layout: platformLayout.layout,
      source: 'platform',
      sourceId: platformLayout.id,
      versionChain,
    };
  }

  // Fallback: Create an empty layout
  return {
    layout: createEmptyLayout(),
    source: 'platform',
    sourceId: 'default',
    versionChain,
  };
}

/**
 * Collects field protections from tenant and role layouts
 */
function collectProtections(
  tenantLayout: TenantAdminLayout | null,
  _roleLayouts: RoleLayout[]
): FieldProtection[] {
  const protections: FieldProtection[] = [];

  // Tenant protections have priority
  if (tenantLayout?.fieldProtections) {
    for (const protection of tenantLayout.fieldProtections) {
      protections.push(protection);
    }
  }

  // Role protections can be added here in the future using _roleLayouts

  return protections;
}

/**
 * Checks if there are pending updates to notify the user about
 */
function checkForPendingUpdates(
  userLayout: UserLayoutPreference | null,
  tenantLayout: TenantAdminLayout | null,
  platformLayout: PlatformLayout | null
): boolean {
  if (!userLayout) return false;

  // Check if user layout is based on an older tenant version
  if (tenantLayout && userLayout.basedOnVersion < tenantLayout.version) {
    return true;
  }

  // Check if platform has been updated
  if (platformLayout) {
    const migration = needsMigration(
      userLayout.layoutData,
      platformLayout.platformVersion,
      {
        platformVersion: platformLayout.platformVersion,
        platformSchemaVersion: platformLayout.schemaVersion,
        tenantAdminVersion: tenantLayout?.version,
      }
    );
    return migration.needsPlatformUpgrade || migration.needsSchemaMigration;
  }

  return false;
}

// ============================================================================
// Layout Switching
// ============================================================================

/**
 * Switches the user to a different layout
 */
export async function switchLayout(
  userId: string,
  tableCode: string,
  targetLayoutId: string,
  availableLayouts: LayoutOption[],
  repository: LayoutRepository
): Promise<ResolvedLayout | null> {
  const targetLayout = availableLayouts.find((l) => l.id === targetLayoutId);
  if (!targetLayout) return null;

  // If switching to user's personal layout, just activate it
  if (targetLayout.source === 'user') {
    const userLayout = await repository.getUserLayout(userId, tableCode);
    if (userLayout) {
      userLayout.isActive = true;
      await repository.saveUserLayout(userId, tableCode, userLayout);
    }
  } else {
    // Deactivate user's personal layout if switching to another source
    const userLayout = await repository.getUserLayout(userId, tableCode);
    if (userLayout) {
      userLayout.isActive = false;
      await repository.saveUserLayout(userId, tableCode, userLayout);
    }
  }

  // Re-resolve to get the updated layout
  // Note: This would need the full context, simplified here
  return null;
}

// ============================================================================
// Safe Customization
// ============================================================================

/**
 * Creates a user customization based on the current effective layout
 */
export async function createUserCustomization(
  userId: string,
  tableCode: string,
  baseLayout: ResolvedLayout,
  repository: LayoutRepository
): Promise<UserLayoutPreference> {
  const newUserLayout: UserLayoutPreference = {
    id: `user-${userId}-${tableCode}-${Date.now()}`,
    userId,
    tableCode,
    layoutName: 'My Custom Layout',
    layoutData: JSON.parse(JSON.stringify(baseLayout.layout)),
    basedOnVersion: baseLayout.versionChain.tenantAdminVersion || 1,
    isActive: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await repository.saveUserLayout(userId, tableCode, newUserLayout);
  return newUserLayout;
}

/**
 * Upgrades a user's layout to match a new base version
 */
export async function upgradeUserLayout(
  userId: string,
  tableCode: string,
  newBaseLayout: DesignerLayout,
  newVersion: number,
  repository: LayoutRepository
): Promise<{
  success: boolean;
  layout?: UserLayoutPreference;
  conflicts?: string[];
}> {
  const userLayout = await repository.getUserLayout(userId, tableCode);
  if (!userLayout) {
    return { success: false, conflicts: ['No user layout found'] };
  }

  // Merge the layouts
  const mergeResult = mergeLayouts(userLayout.layoutData, newBaseLayout, {
    preserveUserOrder: true,
    addNewFieldsToEnd: true,
    removeDeletedFields: false,
  });

  if (mergeResult.success) {
    const updatedLayout: UserLayoutPreference = {
      ...userLayout,
      layoutData: mergeResult.mergedLayout,
      basedOnVersion: newVersion,
      updatedAt: new Date().toISOString(),
    };

    await repository.saveUserLayout(userId, tableCode, updatedLayout);
    return { success: true, layout: updatedLayout };
  }

  return {
    success: false,
    conflicts: mergeResult.conflicts.map((c) => c.description),
  };
}

/**
 * Resets a user's layout to the default (removes customization)
 */
export async function resetUserLayout(
  userId: string,
  tableCode: string,
  repository: LayoutRepository
): Promise<void> {
  const userLayout = await repository.getUserLayout(userId, tableCode);
  if (userLayout) {
    userLayout.isActive = false;
    await repository.saveUserLayout(userId, tableCode, userLayout);
  }
}

// ============================================================================
// Layout Validation
// ============================================================================

/**
 * Validates that a resolved layout is safe to use
 */
export function validateResolvedLayout(
  resolved: ResolvedLayout,
  requiredFields: string[]
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required fields
  const layoutFields = new Set<string>();
  for (const tab of resolved.layout.tabs) {
    for (const section of tab.sections) {
      for (const item of section.items) {
        if (item.type === 'field') {
          layoutFields.add(item.fieldCode);
        }
      }
    }
  }

  for (const required of requiredFields) {
    if (!layoutFields.has(required)) {
      // Check if it's a protected field that was hidden
      const protection = resolved.effectiveProtections.find(
        (p) => p.fieldCode === required
      );
      if (protection?.protectionLevel === 'locked') {
        errors.push(`Required system field "${required}" is missing from layout`);
      } else if (protection?.protectionLevel === 'required_visible') {
        errors.push(`Required field "${required}" cannot be hidden`);
      } else {
        warnings.push(`Field "${required}" is not visible in the current layout`);
      }
    }
  }

  // Check for version conflicts
  if (resolved.hasPendingUpdate) {
    warnings.push('A newer version of the base layout is available');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
