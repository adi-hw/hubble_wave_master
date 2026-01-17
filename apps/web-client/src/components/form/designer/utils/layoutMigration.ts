/**
 * Layout Migration Utilities
 *
 * Handles safe upgrades of form layouts when the platform is updated.
 * Ensures instance admin and user customizations are preserved while
 * incorporating new platform changes.
 */

import {
  DesignerLayout,
  DesignerTab,
  DesignerSection,
  DesignerProperty,
  LayoutChange,
  LayoutMergeResult,
  LayoutConflict,
  LayoutVersionChain,
  generateId,
} from '../types';

// ============================================================================
// Layout Schema Migrations
// ============================================================================

/**
 * Current schema revision - increment when layout structure changes
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Schema migration registry - maps source revision to migration function
 */
const schemaMigrations: Record<number, (layout: DesignerLayout) => DesignerLayout> = {
  1: migrateFromRevision1,
};

/**
 * Migrates a layout from an older schema revision to the current revision.
 * Applies migrations sequentially to preserve data integrity.
 */
export function migrateLayoutSchema(
  layout: DesignerLayout,
  fromVersion: number
): DesignerLayout {
  let migratedLayout = JSON.parse(JSON.stringify(layout)) as DesignerLayout;

  for (let revision = fromVersion; revision < CURRENT_SCHEMA_VERSION; revision++) {
    const migrationFn = schemaMigrations[revision];
    if (migrationFn) {
      migratedLayout = migrationFn(migratedLayout);
    }
  }

  return migratedLayout;
}

/**
 * Migrates layout from revision 1 to revision 2.
 * Adds basedOnAdminVersion, metadata, and settings fields.
 */
function migrateFromRevision1(layout: DesignerLayout): DesignerLayout {
  return {
    ...layout,
    version: 2,
    basedOnAdminVersion: layout.basedOnAdminVersion ?? undefined,
    metadata: layout.metadata ?? {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    settings: layout.settings ?? {
      showTabBar: true,
      animateVisibility: true,
    },
  };
}

// ============================================================================
// Layout Diff & Change Detection
// ============================================================================

/**
 * Extracts all property codes from a layout
 */
export function extractPropertyCodes(layout: DesignerLayout): Set<string> {
  const propertyCodes = new Set<string>();

  for (const tab of layout.tabs) {
    for (const section of tab.sections) {
      for (const item of section.items) {
        if (item.type === 'property') {
          propertyCodes.add(item.propertyCode);
        } else if (item.type === 'dot_walk') {
          propertyCodes.add(`${item.basePath}.${item.propertyCode}`);
        } else if (item.type === 'group') {
          for (const property of item.properties) {
            if (property.type === 'property') {
              propertyCodes.add(property.propertyCode);
            }
          }
        }
      }
    }
  }

  return propertyCodes;
}

// Deprecated alias for backward compatibility
export const extractFieldCodes = extractPropertyCodes;

/**
 * Detects changes between two layouts
 */
export function detectLayoutChanges(
  oldLayout: DesignerLayout,
  newLayout: DesignerLayout
): LayoutChange[] {
  const changes: LayoutChange[] = [];

  const oldProperties = extractPropertyCodes(oldLayout);
  const newProperties = extractPropertyCodes(newLayout);
  const oldTabs = new Set(oldLayout.tabs.map((t) => t.id));
  const newTabs = new Set(newLayout.tabs.map((t) => t.id));
  const oldSections = new Set(
    oldLayout.tabs.flatMap((t) => t.sections.map((s) => s.id))
  );
  const newSections = new Set(
    newLayout.tabs.flatMap((t) => t.sections.map((s) => s.id))
  );

  // Detect added properties
  for (const propertyCode of newProperties) {
    if (!oldProperties.has(propertyCode)) {
      changes.push({
        type: 'property_added',
        description: `Property "${propertyCode}" was added`,
        propertyCode,
        severity: 'info',
        autoMergeable: true,
      });
    }
  }

  // Detect removed properties
  for (const propertyCode of oldProperties) {
    if (!newProperties.has(propertyCode)) {
      changes.push({
        type: 'property_removed',
        description: `Property "${propertyCode}" was removed`,
        propertyCode,
        severity: 'warning',
        autoMergeable: false,
      });
    }
  }

  // Detect added tabs
  for (const tabId of newTabs) {
    if (!oldTabs.has(tabId)) {
      const tab = newLayout.tabs.find((t) => t.id === tabId);
      changes.push({
        type: 'tab_added',
        description: `Tab "${tab?.label || tabId}" was added`,
        severity: 'info',
        autoMergeable: true,
        details: { tabId, label: tab?.label },
      });
    }
  }

  // Detect removed tabs
  for (const tabId of oldTabs) {
    if (!newTabs.has(tabId)) {
      const tab = oldLayout.tabs.find((t) => t.id === tabId);
      changes.push({
        type: 'tab_removed',
        description: `Tab "${tab?.label || tabId}" was removed`,
        severity: 'warning',
        autoMergeable: false,
        details: { tabId, label: tab?.label },
      });
    }
  }

  // Detect added sections
  for (const sectionId of newSections) {
    if (!oldSections.has(sectionId)) {
      changes.push({
        type: 'section_added',
        description: `A new section was added`,
        severity: 'info',
        autoMergeable: true,
        details: { sectionId },
      });
    }
  }

  // Detect removed sections
  for (const sectionId of oldSections) {
    if (!newSections.has(sectionId)) {
      changes.push({
        type: 'section_removed',
        description: `A section was removed`,
        severity: 'warning',
        autoMergeable: false,
        details: { sectionId },
      });
    }
  }

  return changes;
}

/**
 * Finds the location of a property in a layout
 */
export function findPropertyLocation(
  layout: DesignerLayout,
  propertyCode: string
): { tabId: string; sectionId: string; index: number } | null {
  for (const tab of layout.tabs) {
    for (const section of tab.sections) {
      const index = section.items.findIndex(
        (item) =>
          (item.type === 'property' && item.propertyCode === propertyCode) ||
          (item.type === 'dot_walk' &&
            `${item.basePath}.${item.propertyCode}` === propertyCode)
      );
      if (index !== -1) {
        return { tabId: tab.id, sectionId: section.id, index };
      }
    }
  }
  return null;
}

// Deprecated alias for backward compatibility
export const findFieldLocation = findPropertyLocation;

// ============================================================================
// Layout Merge Algorithm
// ============================================================================

/**
 * Merges a new platform/admin layout into a user's customized layout
 * while preserving user customizations where possible.
 *
 * Strategy:
 * 1. Keep user's structural customizations (tab order, section arrangement)
 * 2. Add new properties from the source layout
 * 3. Remove properties that no longer exist in the source
 * 4. Flag conflicts for user resolution
 */
export function mergeLayouts(
  userLayout: DesignerLayout,
  sourceLayout: DesignerLayout,
  options: {
    preserveUserOrder?: boolean;
    addNewPropertiesToEnd?: boolean;
    removeDeletedProperties?: boolean;
  } = {}
): LayoutMergeResult {
  const {
    preserveUserOrder = true,
    addNewPropertiesToEnd = true,
    removeDeletedProperties = false,
  } = options;

  const mergedLayout = JSON.parse(JSON.stringify(userLayout)) as DesignerLayout;
  const changes = detectLayoutChanges(userLayout, sourceLayout);
  const appliedChanges: LayoutChange[] = [];
  const conflicts: LayoutConflict[] = [];
  const warnings: string[] = [];

  // Handle new properties from source
  for (const change of changes.filter((c) => c.type === 'property_added')) {
    if (change.propertyCode && change.autoMergeable) {
      // Find where the property is in the source layout
      const sourceLocation = findPropertyLocation(sourceLayout, change.propertyCode);

      if (sourceLocation) {
        // Find the corresponding field item in source
        const sourceTab = sourceLayout.tabs.find(
          (t) => t.id === sourceLocation.tabId
        );
        const sourceSection = sourceTab?.sections.find(
          (s) => s.id === sourceLocation.sectionId
        );
        const sourceItem = sourceSection?.items[sourceLocation.index];

        if (sourceItem) {
          // Try to find matching tab/section in user layout
          let targetTab = mergedLayout.tabs.find(
            (t) => t.id === sourceLocation.tabId
          );
          let targetSection: DesignerSection | undefined;

          if (targetTab) {
            targetSection = targetTab.sections.find(
              (s) => s.id === sourceLocation.sectionId
            );
          }

          // If no matching location, add to first tab/section or create new
          if (!targetTab) {
            if (addNewPropertiesToEnd) {
              targetTab = mergedLayout.tabs[0];
            } else {
              // Create a new tab matching the source
              targetTab = {
                ...JSON.parse(JSON.stringify(sourceTab)),
                sections: [],
              } as DesignerTab;
              mergedLayout.tabs.push(targetTab);
            }
          }

          if (!targetSection) {
            if (addNewPropertiesToEnd && targetTab.sections.length > 0) {
              targetSection = targetTab.sections[targetTab.sections.length - 1];
            } else {
              // Create new section
              targetSection = {
                id: generateId(),
                label: sourceSection?.label || 'New Properties',
                columns: sourceSection?.columns || 2,
                items: [],
              };
              targetTab.sections.push(targetSection);
            }
          }

          // Add the property
          const newItem = JSON.parse(JSON.stringify(sourceItem));
          if (preserveUserOrder) {
            targetSection.items.push(newItem);
          } else {
            // Try to maintain source position
            targetSection.items.splice(sourceLocation.index, 0, newItem);
          }

          appliedChanges.push(change);
        }
      }
    }
  }

  // Handle removed properties
  for (const change of changes.filter((c) => c.type === 'property_removed')) {
    if (change.propertyCode) {
      if (removeDeletedProperties) {
        // Remove the property from user layout
        removePropertyFromLayout(mergedLayout, change.propertyCode);
        appliedChanges.push(change);
      } else {
        // Create a conflict for user to resolve
        conflicts.push({
          id: generateId(),
          type: 'property_removed',
          description: `Property "${change.propertyCode}" was removed from the base layout`,
          affectedItems: [change.propertyCode],
        });
        warnings.push(
          `Property "${change.propertyCode}" exists in your layout but was removed from the base layout`
        );
      }
    }
  }

  // Handle new tabs
  for (const change of changes.filter((c) => c.type === 'tab_added')) {
    const tabId = change.details?.tabId as string;
    const sourceTab = sourceLayout.tabs.find((t) => t.id === tabId);

    if (sourceTab && !mergedLayout.tabs.find((t) => t.id === tabId)) {
      // Add the new tab
      mergedLayout.tabs.push(JSON.parse(JSON.stringify(sourceTab)));
      appliedChanges.push(change);
    }
  }

  // Handle removed tabs - create conflicts
  for (const change of changes.filter((c) => c.type === 'tab_removed')) {
    const tabId = change.details?.tabId as string;
    if (mergedLayout.tabs.find((t) => t.id === tabId)) {
      conflicts.push({
        id: generateId(),
        type: 'section_removed',
        description: `Tab "${change.details?.label}" was removed from the base layout`,
        affectedItems: [tabId],
      });
    }
  }

  // Update version info
  mergedLayout.metadata = {
    ...mergedLayout.metadata,
    updatedAt: new Date().toISOString(),
  };

  return {
    success: conflicts.length === 0,
    mergedLayout,
    appliedChanges,
    conflicts,
    warnings,
  };
}

/**
 * Removes a property from a layout
 */
function removePropertyFromLayout(layout: DesignerLayout, propertyCode: string): void {
  for (const tab of layout.tabs) {
    for (const section of tab.sections) {
      section.items = section.items.filter((item) => {
        if (item.type === 'property') {
          return item.propertyCode !== propertyCode;
        }
        if (item.type === 'dot_walk') {
          return `${item.basePath}.${item.propertyCode}` !== propertyCode;
        }
        if (item.type === 'group') {
          item.properties = item.properties.filter(
            (p) => p.type !== 'property' || p.propertyCode !== propertyCode
          );
          return item.properties.length > 0;
        }
        return true;
      });
    }
  }
}

// ============================================================================
// Safe Platform Upgrade
// ============================================================================

/**
 * Performs a safe platform upgrade that preserves all customizations
 */
export function performPlatformUpgrade(
  currentLayout: DesignerLayout,
  newPlatformLayout: DesignerLayout,
  versionChain: LayoutVersionChain,
  newPlatformVersion: string
): {
  upgradedLayout: DesignerLayout;
  mergeResult: LayoutMergeResult;
  newVersionChain: LayoutVersionChain;
} {
  // First, migrate schema if needed
  const migratedNew = migrateLayoutSchema(
    newPlatformLayout,
    versionChain.platformSchemaVersion
  );

  // Merge the layouts
  const mergeResult = mergeLayouts(currentLayout, migratedNew, {
    preserveUserOrder: true,
    addNewPropertiesToEnd: true,
    removeDeletedProperties: false,
  });

  // Update version chain
  const newVersionChain: LayoutVersionChain = {
    ...versionChain,
    platformVersion: newPlatformVersion,
    platformSchemaVersion: CURRENT_SCHEMA_VERSION,
  };

  return {
    upgradedLayout: mergeResult.mergedLayout,
    mergeResult,
    newVersionChain,
  };
}

/**
 * Checks if a layout needs migration
 */
export function needsMigration(
  layout: DesignerLayout,
  currentPlatformVersion: string,
  userVersionChain?: LayoutVersionChain
): {
  needsSchemaMigration: boolean;
  needsPlatformUpgrade: boolean;
  fromSchemaVersion: number;
  fromPlatformVersion: string;
} {
  const layoutVersion = layout.version || 1;
  const userPlatformVersion = userVersionChain?.platformVersion || '0.0.0';

  return {
    needsSchemaMigration: layoutVersion < CURRENT_SCHEMA_VERSION,
    needsPlatformUpgrade: userPlatformVersion !== currentPlatformVersion,
    fromSchemaVersion: layoutVersion,
    fromPlatformVersion: userPlatformVersion,
  };
}

// ============================================================================
// Field Validation for Layouts
// ============================================================================

/**
 * Validates that a layout contains all required properties
 */
export function validateLayoutProperties(
  layout: DesignerLayout,
  requiredPropertyCodes: string[]
): {
  isValid: boolean;
  missingProperties: string[];
  extraProperties: string[];
} {
  const layoutProperties = extractPropertyCodes(layout);
  const missingProperties = requiredPropertyCodes.filter((p) => !layoutProperties.has(p));
  const extraProperties = [...layoutProperties].filter(
    (p) => !requiredPropertyCodes.includes(p)
  );

  return {
    isValid: missingProperties.length === 0,
    missingProperties,
    extraProperties,
  };
}

// Deprecated alias for backward compatibility
export const validateLayoutFields = validateLayoutProperties;

/**
 * Adds missing required properties to a layout
 */
export function addMissingRequiredProperties(
  layout: DesignerLayout,
  missingProperties: string[],
  propertyLabels: Record<string, string> = {}
): DesignerLayout {
  const updatedLayout = JSON.parse(JSON.stringify(layout)) as DesignerLayout;

  // Find or create a "Required Properties" section in the first tab
  let targetSection = updatedLayout.tabs[0]?.sections.find(
    (s) => s.label === 'Required Properties'
  );

  if (!targetSection && updatedLayout.tabs[0]) {
    targetSection = {
      id: generateId(),
      label: 'Required Properties',
      description: 'These properties are required by the system',
      columns: 2,
      items: [],
    };
    // Add at the beginning
    updatedLayout.tabs[0].sections.unshift(targetSection);
  }

  if (targetSection) {
    for (const propertyCode of missingProperties) {
      const newProperty: DesignerProperty = {
        type: 'property',
        id: generateId(),
        propertyCode,
        span: 1,
        helpText: propertyLabels[propertyCode]
          ? undefined
          : 'This property is required by the system',
      };
      targetSection.items.push(newProperty);
    }
  }

  return updatedLayout;
}

// Deprecated alias for backward compatibility
export const addMissingRequiredFields = addMissingRequiredProperties;
