// Layout Migration Utilities
export {
  CURRENT_SCHEMA_VERSION,
  migrateLayoutSchema,
  extractFieldCodes,
  detectLayoutChanges,
  findFieldLocation,
  mergeLayouts,
  performPlatformUpgrade,
  needsMigration,
  validateLayoutFields,
  addMissingRequiredFields,
} from './layoutMigration';

// Layout Resolution Utilities
export type { LayoutRepository } from './layoutResolver';
export {
  resolveLayout,
  switchLayout,
  createUserCustomization,
  upgradeUserLayout,
  resetUserLayout,
  validateResolvedLayout,
} from './layoutResolver';
