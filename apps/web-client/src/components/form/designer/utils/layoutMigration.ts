/**
 * Layout Migration Utilities
 *
 * Handles safe upgrades of form layouts when the platform is updated.
 * Ensures tenant admin and user customizations are preserved while
 * incorporating new platform changes.
 */

import {
  DesignerLayout,
  DesignerTab,
  DesignerSection,
  DesignerField,
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
 * Current schema version - increment when layout structure changes
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Migrates a layout from an older schema version to the current version
 */
export function migrateLayoutSchema(
  layout: DesignerLayout,
  fromVersion: number
): DesignerLayout {
  let migratedLayout = JSON.parse(JSON.stringify(layout)) as DesignerLayout;

  // Apply migrations sequentially
  if (fromVersion < 2) {
    migratedLayout = migrateV1toV2(migratedLayout);
  }

  // Future migrations would go here:
  // if (fromVersion < 3) {
  //   migratedLayout = migrateV2toV3(migratedLayout);
  // }

  return migratedLayout;
}

/**
 * Migration from v1 to v2:
 * - Added basedOnAdminVersion field
 * - Added metadata object
 * - Added settings object
 */
function migrateV1toV2(layout: DesignerLayout): DesignerLayout {
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
 * Extracts all field codes from a layout
 */
export function extractFieldCodes(layout: DesignerLayout): Set<string> {
  const fieldCodes = new Set<string>();

  for (const tab of layout.tabs) {
    for (const section of tab.sections) {
      for (const item of section.items) {
        if (item.type === 'field') {
          fieldCodes.add(item.fieldCode);
        } else if (item.type === 'dot_walk') {
          fieldCodes.add(`${item.basePath}.${item.fieldCode}`);
        } else if (item.type === 'group') {
          for (const field of item.fields) {
            if (field.type === 'field') {
              fieldCodes.add(field.fieldCode);
            }
          }
        }
      }
    }
  }

  return fieldCodes;
}

/**
 * Detects changes between two layouts
 */
export function detectLayoutChanges(
  oldLayout: DesignerLayout,
  newLayout: DesignerLayout
): LayoutChange[] {
  const changes: LayoutChange[] = [];

  const oldFields = extractFieldCodes(oldLayout);
  const newFields = extractFieldCodes(newLayout);
  const oldTabs = new Set(oldLayout.tabs.map((t) => t.id));
  const newTabs = new Set(newLayout.tabs.map((t) => t.id));
  const oldSections = new Set(
    oldLayout.tabs.flatMap((t) => t.sections.map((s) => s.id))
  );
  const newSections = new Set(
    newLayout.tabs.flatMap((t) => t.sections.map((s) => s.id))
  );

  // Detect added fields
  for (const fieldCode of newFields) {
    if (!oldFields.has(fieldCode)) {
      changes.push({
        type: 'field_added',
        description: `Field "${fieldCode}" was added`,
        fieldCode,
        severity: 'info',
        autoMergeable: true,
      });
    }
  }

  // Detect removed fields
  for (const fieldCode of oldFields) {
    if (!newFields.has(fieldCode)) {
      changes.push({
        type: 'field_removed',
        description: `Field "${fieldCode}" was removed`,
        fieldCode,
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
 * Finds the location of a field in a layout
 */
export function findFieldLocation(
  layout: DesignerLayout,
  fieldCode: string
): { tabId: string; sectionId: string; index: number } | null {
  for (const tab of layout.tabs) {
    for (const section of tab.sections) {
      const index = section.items.findIndex(
        (item) =>
          (item.type === 'field' && item.fieldCode === fieldCode) ||
          (item.type === 'dot_walk' &&
            `${item.basePath}.${item.fieldCode}` === fieldCode)
      );
      if (index !== -1) {
        return { tabId: tab.id, sectionId: section.id, index };
      }
    }
  }
  return null;
}

// ============================================================================
// Layout Merge Algorithm
// ============================================================================

/**
 * Merges a new platform/admin layout into a user's customized layout
 * while preserving user customizations where possible.
 *
 * Strategy:
 * 1. Keep user's structural customizations (tab order, section arrangement)
 * 2. Add new fields from the source layout
 * 3. Remove fields that no longer exist in the source
 * 4. Flag conflicts for user resolution
 */
export function mergeLayouts(
  userLayout: DesignerLayout,
  sourceLayout: DesignerLayout,
  options: {
    preserveUserOrder?: boolean;
    addNewFieldsToEnd?: boolean;
    removeDeletedFields?: boolean;
  } = {}
): LayoutMergeResult {
  const {
    preserveUserOrder = true,
    addNewFieldsToEnd = true,
    removeDeletedFields = false,
  } = options;

  const mergedLayout = JSON.parse(JSON.stringify(userLayout)) as DesignerLayout;
  const changes = detectLayoutChanges(userLayout, sourceLayout);
  const appliedChanges: LayoutChange[] = [];
  const conflicts: LayoutConflict[] = [];
  const warnings: string[] = [];

  // Handle new fields from source
  for (const change of changes.filter((c) => c.type === 'field_added')) {
    if (change.fieldCode && change.autoMergeable) {
      // Find where the field is in the source layout
      const sourceLocation = findFieldLocation(sourceLayout, change.fieldCode);

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
            if (addNewFieldsToEnd) {
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
            if (addNewFieldsToEnd && targetTab.sections.length > 0) {
              targetSection = targetTab.sections[targetTab.sections.length - 1];
            } else {
              // Create new section
              targetSection = {
                id: generateId(),
                label: sourceSection?.label || 'New Fields',
                columns: sourceSection?.columns || 2,
                items: [],
              };
              targetTab.sections.push(targetSection);
            }
          }

          // Add the field
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

  // Handle removed fields
  for (const change of changes.filter((c) => c.type === 'field_removed')) {
    if (change.fieldCode) {
      if (removeDeletedFields) {
        // Remove the field from user layout
        removeFieldFromLayout(mergedLayout, change.fieldCode);
        appliedChanges.push(change);
      } else {
        // Create a conflict for user to resolve
        conflicts.push({
          id: generateId(),
          type: 'field_removed',
          description: `Field "${change.fieldCode}" was removed from the base layout`,
          affectedItems: [change.fieldCode],
        });
        warnings.push(
          `Field "${change.fieldCode}" exists in your layout but was removed from the base layout`
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
 * Removes a field from a layout
 */
function removeFieldFromLayout(layout: DesignerLayout, fieldCode: string): void {
  for (const tab of layout.tabs) {
    for (const section of tab.sections) {
      section.items = section.items.filter((item) => {
        if (item.type === 'field') {
          return item.fieldCode !== fieldCode;
        }
        if (item.type === 'dot_walk') {
          return `${item.basePath}.${item.fieldCode}` !== fieldCode;
        }
        if (item.type === 'group') {
          item.fields = item.fields.filter(
            (f) => f.type !== 'field' || f.fieldCode !== fieldCode
          );
          return item.fields.length > 0;
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
    addNewFieldsToEnd: true,
    removeDeletedFields: false,
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
 * Validates that a layout contains all required fields
 */
export function validateLayoutFields(
  layout: DesignerLayout,
  requiredFieldCodes: string[]
): {
  isValid: boolean;
  missingFields: string[];
  extraFields: string[];
} {
  const layoutFields = extractFieldCodes(layout);
  const missingFields = requiredFieldCodes.filter((f) => !layoutFields.has(f));
  const extraFields = [...layoutFields].filter(
    (f) => !requiredFieldCodes.includes(f)
  );

  return {
    isValid: missingFields.length === 0,
    missingFields,
    extraFields,
  };
}

/**
 * Adds missing required fields to a layout
 */
export function addMissingRequiredFields(
  layout: DesignerLayout,
  missingFields: string[],
  fieldLabels: Record<string, string> = {}
): DesignerLayout {
  const updatedLayout = JSON.parse(JSON.stringify(layout)) as DesignerLayout;

  // Find or create a "Required Fields" section in the first tab
  let targetSection = updatedLayout.tabs[0]?.sections.find(
    (s) => s.label === 'Required Fields'
  );

  if (!targetSection && updatedLayout.tabs[0]) {
    targetSection = {
      id: generateId(),
      label: 'Required Fields',
      description: 'These fields are required by the system',
      columns: 2,
      items: [],
    };
    // Add at the beginning
    updatedLayout.tabs[0].sections.unshift(targetSection);
  }

  if (targetSection) {
    for (const fieldCode of missingFields) {
      const newField: DesignerField = {
        type: 'field',
        id: generateId(),
        fieldCode,
        span: 1,
        helpText: fieldLabels[fieldCode]
          ? undefined
          : 'This field is required by the system',
      };
      targetSection.items.push(newField);
    }
  }

  return updatedLayout;
}
