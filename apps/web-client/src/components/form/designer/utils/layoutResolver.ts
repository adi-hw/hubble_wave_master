/**
 * Layout Resolution Utilities
 *
 * Resolves the effective layout for a user based on the hierarchy:
 * Platform → Instance Admin → Role → User
 *
 * Handles fallback logic and ensures users always have a valid layout.
 */

import {
  DesignerLayout,
  LayoutSource,
  LayoutResolutionContext,
  ResolvedLayout,
  LayoutOption,
  PropertyProtection,
  LayoutVersionChain,
  PlatformLayout,
  InstanceAdminLayout,
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
  getPlatformLayout(collectionCode: string): Promise<PlatformLayout | null>;
  getInstanceAdminLayout(instanceId: string, collectionCode: string): Promise<InstanceAdminLayout | null>;
  getRoleLayouts(instanceId: string, roleCodes: string[], collectionCode: string): Promise<RoleLayout[]>;
  getUserLayout(userId: string, collectionCode: string): Promise<UserLayoutPreference | null>;
  saveUserLayout(userId: string, collectionCode: string, layout: UserLayoutPreference): Promise<void>;
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
  const { instanceId, userId, userRoles, collectionCode, preferUserLayout = true } = context;

  // Fetch all available layouts in parallel
  const [platformLayout, instanceLayout, roleLayouts, userLayout] = await Promise.all([
    repository.getPlatformLayout(collectionCode),
    repository.getInstanceAdminLayout(instanceId, collectionCode),
    repository.getRoleLayouts(instanceId, userRoles, collectionCode),
    preferUserLayout ? repository.getUserLayout(userId, collectionCode) : Promise.resolve(null),
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

  if (instanceLayout) {
    availableLayouts.push({
      id: instanceLayout.id,
      name: instanceLayout.name,
      source: 'admin',
      isActive: false,
      isDefault: instanceLayout.isDefault,
      version: instanceLayout.version,
      lastModified: instanceLayout.updatedAt,
      modifiedBy: instanceLayout.createdBy,
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
    instanceLayout,
    roleLayouts,
    userLayout
  );

  // Collect effective property protections
  const effectiveProtections = collectProtections(instanceLayout, roleLayouts);

  // Check for pending updates
  const hasPendingUpdate = checkForPendingUpdates(
    userLayout,
    instanceLayout,
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
  instanceLayout: InstanceAdminLayout | null,
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
    instanceAdminVersion: instanceLayout?.version,
    roleLayoutVersion: roleLayouts[0]?.basedOnInstanceVersion,
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

  // Priority 3: Instance admin layout
  if (instanceLayout?.isPublished && instanceLayout.isDefault) {
    return {
      layout: instanceLayout.layout,
      source: 'admin',
      sourceId: instanceLayout.id,
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
 * Collects property protections from instance and role layouts
 */
function collectProtections(
  instanceLayout: InstanceAdminLayout | null,
  _roleLayouts: RoleLayout[]
): PropertyProtection[] {
  const protections: PropertyProtection[] = [];

  // Instance protections have priority
  if (instanceLayout?.propertyProtections) {
    for (const protection of instanceLayout.propertyProtections) {
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
  instanceLayout: InstanceAdminLayout | null,
  platformLayout: PlatformLayout | null
): boolean {
  if (!userLayout) return false;

  // Check if user layout is based on an older instance version
  if (instanceLayout && userLayout.basedOnVersion < instanceLayout.version) {
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
        instanceAdminVersion: instanceLayout?.version,
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
  collectionCode: string,
  targetLayoutId: string,
  availableLayouts: LayoutOption[],
  repository: LayoutRepository
): Promise<ResolvedLayout | null> {
  const targetLayout = availableLayouts.find((l) => l.id === targetLayoutId);
  if (!targetLayout) return null;

  // If switching to user's personal layout, just activate it
  if (targetLayout.source === 'user') {
    const userLayout = await repository.getUserLayout(userId, collectionCode);
    if (userLayout) {
      userLayout.isActive = true;
      await repository.saveUserLayout(userId, collectionCode, userLayout);
    }
  } else {
    // Deactivate user's personal layout if switching to another source
    const userLayout = await repository.getUserLayout(userId, collectionCode);
    if (userLayout) {
      userLayout.isActive = false;
      await repository.saveUserLayout(userId, collectionCode, userLayout);
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
  collectionCode: string,
  baseLayout: ResolvedLayout,
  repository: LayoutRepository
): Promise<UserLayoutPreference> {
  const newUserLayout: UserLayoutPreference = {
    id: `user-${userId}-${collectionCode}-${Date.now()}`,
    userId,
    collectionCode,
    layoutName: 'My Custom Layout',
    layoutData: JSON.parse(JSON.stringify(baseLayout.layout)),
    basedOnVersion: baseLayout.versionChain.instanceAdminVersion || 1,
    isActive: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await repository.saveUserLayout(userId, collectionCode, newUserLayout);
  return newUserLayout;
}

/**
 * Upgrades a user's layout to match a new base version
 */
export async function upgradeUserLayout(
  userId: string,
  collectionCode: string,
  newBaseLayout: DesignerLayout,
  newVersion: number,
  repository: LayoutRepository
): Promise<{
  success: boolean;
  layout?: UserLayoutPreference;
  conflicts?: string[];
}> {
  const userLayout = await repository.getUserLayout(userId, collectionCode);
  if (!userLayout) {
    return { success: false, conflicts: ['No user layout found'] };
  }

  // Merge the layouts
  const mergeResult = mergeLayouts(userLayout.layoutData, newBaseLayout, {
    preserveUserOrder: true,
    addNewPropertiesToEnd: true,
    removeDeletedProperties: false,
  });

  if (mergeResult.success) {
    const updatedLayout: UserLayoutPreference = {
      ...userLayout,
      layoutData: mergeResult.mergedLayout,
      basedOnVersion: newVersion,
      updatedAt: new Date().toISOString(),
    };

    await repository.saveUserLayout(userId, collectionCode, updatedLayout);
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
  collectionCode: string,
  repository: LayoutRepository
): Promise<void> {
  const userLayout = await repository.getUserLayout(userId, collectionCode);
  if (userLayout) {
    userLayout.isActive = false;
    await repository.saveUserLayout(userId, collectionCode, userLayout);
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
  requiredProperties: string[]
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required properties
  const layoutProperties = new Set<string>();
  for (const tab of resolved.layout.tabs) {
    for (const section of tab.sections) {
      for (const item of section.items) {
        if (item.type === 'property') {
          layoutProperties.add(item.propertyCode);
        }
      }
    }
  }

  for (const required of requiredProperties) {
    if (!layoutProperties.has(required)) {
      // Check if it's a protected property that was hidden
      const protection = resolved.effectiveProtections.find(
        (p) => p.propertyCode === required
      );
      if (protection?.protectionLevel === 'locked') {
        errors.push(`Required system property "${required}" is missing from layout`);
      } else if (protection?.protectionLevel === 'required_visible') {
        errors.push(`Required property "${required}" cannot be hidden`);
      } else {
        warnings.push(`Property "${required}" is not visible in the current layout`);
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
