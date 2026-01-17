/**
 * Advanced Form Layout Designer Types
 *
 * This module defines all types for the form layout designer system,
 * including layout structures, property protection, user preferences,
 * and conditional visibility rules.
 */

// ============================================================================
// Visibility Conditions
// ============================================================================

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equals'
  | 'less_than_or_equals'
  | 'in_list'
  | 'not_in_list'
  | 'starts_with'
  | 'ends_with';

export interface VisibilityRule {
  id: string;
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface VisibilityCondition {
  id: string;
  operator: 'and' | 'or';
  rules: VisibilityRule[];
  nestedConditions?: VisibilityCondition[];
}

// ============================================================================
// Property Protection
// ============================================================================

export type ProtectionLevel =
  | 'locked'           // Cannot be hidden, moved, or modified (system properties like id, created_at)
  | 'required_visible' // Cannot be hidden, but can be repositioned
  | 'flexible';        // Full user control

export interface PropertyProtection {
  id: string;
  propertyCode: string;
  protectionLevel: ProtectionLevel;
  condition?: VisibilityCondition; // Protection applies when condition is true
  reason?: string;                  // Explanation shown to user
}

export interface PropertyProtectionRule {
  id: string;
  collectionCode: string;
  propertyCode: string;
  protectionLevel: ProtectionLevel;
  condition?: VisibilityCondition;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Designer Layout Items
// ============================================================================

export interface DesignerFieldBase {
  id: string;
  span?: 1 | 2 | 3 | 4;           // Column span
  visibilityCondition?: VisibilityCondition;
}

export interface DesignerProperty extends DesignerFieldBase {
  type: 'property';
  propertyCode: string;
  labelOverride?: string;
  placeholder?: string;
  helpText?: string;
  readOnly?: boolean;
}

export interface DesignerDotWalkProperty extends DesignerFieldBase {
  type: 'dot_walk';
  basePath: string;        // e.g., "location.contact" or "assigned_to"
  propertyCode: string;    // e.g., "email" or "name"
  displayLabel: string;    // User-friendly label
  referenceChain: string[]; // Array of reference property codes traversed
}

export interface DesignerPropertyGroup {
  type: 'group';
  id: string;
  label?: string;
  description?: string;
  style: 'bordered' | 'shaded' | 'plain' | 'card';
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  properties: (DesignerProperty | DesignerDotWalkProperty)[];
  visibilityCondition?: VisibilityCondition;
}

export interface DesignerEmbeddedList {
  type: 'embedded_list';
  id: string;
  label: string;
  description?: string;
  collectionCode: string;        // The related collection to display
  referenceProperty: string;     // Property on child collection pointing to this record
  columns: string[];             // Property codes to display as columns
  defaultSort?: {
    property: string;
    direction: 'asc' | 'desc';
  };
  filter?: FilterExpression;
  maxRows?: number;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  span?: 1 | 2 | 3 | 4;
  visibilityCondition?: VisibilityCondition;
}

export interface DesignerSpacer {
  type: 'spacer';
  id: string;
  height?: 'small' | 'medium' | 'large';
  span?: 1 | 2 | 3 | 4;
}

export interface DesignerDivider {
  type: 'divider';
  id: string;
  label?: string;
  span?: 1 | 2 | 3 | 4;
}

export interface DesignerInfoBox {
  type: 'info_box';
  id: string;
  title?: string;
  content: string;
  variant: 'info' | 'warning' | 'success' | 'error';
  span?: 1 | 2 | 3 | 4;
  visibilityCondition?: VisibilityCondition;
}

export type DesignerItem =
  | DesignerProperty
  | DesignerDotWalkProperty
  | DesignerPropertyGroup
  | DesignerEmbeddedList
  | DesignerSpacer
  | DesignerDivider
  | DesignerInfoBox;

// ============================================================================
// Filter Expressions (for embedded lists)
// ============================================================================

export interface FilterRule {
  id: string;
  property: string;
  operator: ConditionOperator;
  value?: any;
}

export interface FilterExpression {
  operator: 'and' | 'or';
  rules: FilterRule[];
  groups?: FilterExpression[];
}

// ============================================================================
// Section & Tab Structure
// ============================================================================

export interface DesignerSection {
  id: string;
  label?: string;
  description?: string;
  columns: 1 | 2 | 3 | 4;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  items: DesignerItem[];
  visibilityCondition?: VisibilityCondition;
  style?: {
    background?: 'white' | 'gray' | 'primary-light';
    border?: boolean;
    padding?: 'none' | 'small' | 'medium' | 'large';
  };
}

export interface DesignerTab {
  id: string;
  label: string;
  icon?: string;           // Lucide icon name
  badge?: {
    type: 'count' | 'dot' | 'text';
    value?: string | number;
    propertyCode?: string;    // For dynamic count based on a property
  };
  sections: DesignerSection[];
  visibilityCondition?: VisibilityCondition;
}

// ============================================================================
// Main Layout Structure
// ============================================================================

export interface DesignerLayout {
  version: 2;
  basedOnAdminVersion?: number;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    name?: string;
    description?: string;
  };
  tabs: DesignerTab[];
  settings?: LayoutSettings;
}

export interface LayoutSettings {
  showTabBar?: boolean;         // Hide tab bar if only one tab
  defaultTab?: string;          // Tab ID to show by default
  compactMode?: boolean;        // Reduce padding and spacing
  showPropertyCodes?: boolean;  // Show property codes in labels (dev mode)
  animateVisibility?: boolean;  // Animate property show/hide
}

// ============================================================================
// User Layout Preferences
// ============================================================================

export interface UserLayoutPreference {
  id: string;
  userId: string;
  collectionCode: string;
  layoutName: string;
  layoutData: DesignerLayout;
  basedOnVersion: number;       // Admin layout version this was based on
  isActive: boolean;            // Only one active per user per collection
  isDefault: boolean;           // User's default for this collection
  createdAt: string;
  updatedAt: string;
}

export interface UserLayoutSummary {
  id: string;
  layoutName: string;
  isActive: boolean;
  isDefault: boolean;
  updatedAt: string;
}

// ============================================================================
// Layout Hierarchy System
// ============================================================================

/**
 * Layout Source Hierarchy (in priority order, highest to lowest):
 *
 * 1. PLATFORM - Provided by platform vendor (us), shipped with updates
 *    - Cannot be modified by instance administrators
 *    - Serves as ultimate fallback
 *    - Versioned with platform releases
 *
 * 2. admin - Configured by instance administrator
 *    - Overrides platform layout
 *    - Applies to all users in instance by default
 *    - Can be versioned for rollback
 *
 * 3. ROLE - Role-specific layouts
 *    - Overrides instance admin layout for specific roles
 *    - E.g., Technician sees different properties than Manager
 *
 * 4. USER - Individual user customization
 *    - Highest priority, user's personal preference
 *    - Based on their effective layout (role or instance)
 *    - Can be reset to default at any level
 */

export type LayoutSource =
  | 'platform'     // Platform-provided (vendor)
  | 'admin'        // Instance administrator configured
  | 'role'         // Role-based layout
  | 'user';        // User personalized

export type LayoutScope =
  | 'global'       // Applies to all collections
  | 'collection';  // Specific to one collection

/**
 * Platform Layout - Shipped with the platform, read-only for instances
 */
export interface PlatformLayout {
  id: string;
  collectionCode: string;
  layout: DesignerLayout;
  platformVersion: string;         // e.g., "2.5.0"
  schemaVersion: number;           // Layout schema version for migrations
  releaseNotes?: string;
  isDefault: boolean;              // Default for this collection
  createdAt: string;
}

/**
 * Instance Admin Layout - Customized by instance administrator
 */
export interface InstanceAdminLayout {
  id: string;
  instanceId: string;
  collectionCode: string;
  name: string;
  description?: string;
  layout: DesignerLayout;
  basedOnPlatformVersion: string;  // Which platform layout version this extends
  version: number;                 // Internal version for change tracking
  isDefault: boolean;              // Default for this instance's collection
  isPublished: boolean;            // Draft vs published
  propertyProtections: PropertyProtection[]; // Admin-defined property protections
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export type TenantAdminLayout = InstanceAdminLayout;

/**
 * Role Layout - Role-specific customization
 */
export interface RoleLayout {
  id: string;
  instanceId: string;
  roleCode: string;
  collectionCode: string;
  name: string;
  description?: string;
  layout: DesignerLayout;
  basedOnInstanceVersion: number;  // Which instance layout version this extends
  priority: number;                // For users with multiple roles
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin Layout (kept for backward compatibility)
 */
export interface AdminLayout {
  id: string;
  collectionCode: string;
  name: string;
  description?: string;
  layout: DesignerLayout;
  isDefault: boolean;
  isPublished: boolean;
  version: number;
  roleRestrictions?: string[];   // Only show to specific roles
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Layout Version & Migration
// ============================================================================

/**
 * Tracks which version each layer is based on
 */
export interface LayoutVersionChain {
  platformVersion: string;
  platformSchemaVersion: number;
  instanceAdminVersion?: number;
  roleLayoutVersion?: number;
  userLayoutVersion?: number;
}

export interface LayoutVersionInfo {
  currentVersion: number;
  userVersion: number;
  hasUpdate: boolean;
  changes?: LayoutChange[];
  versionChain: LayoutVersionChain;
}

export interface LayoutChange {
  type: 'property_added' | 'property_removed' | 'property_renamed' | 'property_moved' |
        'property_config_changed' | 'section_added' | 'section_removed' |
        'tab_added' | 'tab_removed' | 'structure_changed' | 'protection_changed';
  description: string;
  propertyCode?: string;
  severity: 'info' | 'warning' | 'breaking';
  autoMergeable: boolean;         // Can be automatically merged
  details?: Record<string, unknown>;
}

/**
 * Migration record for tracking layout upgrades
 */
export interface LayoutMigration {
  id: string;
  fromVersion: string;
  toVersion: string;
  migrationType: 'platform_upgrade' | 'instance_update' | 'role_update';
  collectionCode: string;
  changes: LayoutChange[];
  migrationScript?: string;       // Optional transformation script
  isReversible: boolean;
  createdAt: string;
}

/**
 * Result of a layout merge operation
 */
export interface LayoutMergeResult {
  success: boolean;
  mergedLayout: DesignerLayout;
  appliedChanges: LayoutChange[];
  conflicts: LayoutConflict[];
  warnings: string[];
}

export interface LayoutConflict {
  id: string;
  type: 'property_removed' | 'property_moved' | 'section_removed' | 'protection_conflict';
  description: string;
  affectedItems: string[];        // IDs of affected properties/sections
  userChoice?: 'keep_user' | 'use_new' | 'merge';
  resolution?: unknown;
}

// ============================================================================
// Layout Resolution
// ============================================================================

/**
 * Resolved layout with full context about its source
 */
export interface ResolvedLayout {
  layout: DesignerLayout;
  source: LayoutSource;
  sourceId: string;
  effectiveProtections: PropertyProtection[];
  versionChain: LayoutVersionChain;
  hasUserCustomization: boolean;
  hasPendingUpdate: boolean;
  availableLayouts: LayoutOption[];
}

export interface LayoutOption {
  id: string;
  name: string;
  source: LayoutSource;
  isActive: boolean;
  isDefault: boolean;
  version?: number;
  hasConflict?: boolean;
  lastModified?: string;
  modifiedBy?: string;
}

/**
 * Context for resolving which layout to use
 */
export interface LayoutResolutionContext {
  instanceId: string;
  userId: string;
  userRoles: string[];
  collectionCode: string;
  preferUserLayout?: boolean;     // Default true
}

// ============================================================================
// Designer State
// ============================================================================

export type SelectedItemType = 'section' | 'property' | 'group' | 'tab' | 'embedded_list' | null;

export interface DesignerState {
  layout: DesignerLayout;
  selectedItemId: string | null;
  selectedItemType: SelectedItemType;
  isDirty: boolean;
  history: DesignerLayout[];
  historyIndex: number;
  dragState: DragState | null;
  mode: 'edit' | 'preview';
}

export interface DragState {
  itemId: string;
  itemType: DesignerItem['type'] | 'tab' | 'section';
  sourceLocation: ItemLocation;
}

export interface ItemLocation {
  tabId: string;
  sectionId?: string;
  index: number;
}

// ============================================================================
// Designer Actions
// ============================================================================

export type DesignerAction =
  | { type: 'SET_LAYOUT'; payload: DesignerLayout }
  | { type: 'SELECT_ITEM'; payload: { id: string | null; type: DesignerState['selectedItemType'] } }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<DesignerItem> } }
  | { type: 'ADD_ITEM'; payload: { item: DesignerItem; location: ItemLocation } }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'MOVE_ITEM'; payload: { itemId: string; targetLocation: ItemLocation } }
  | { type: 'ADD_SECTION'; payload: { section: DesignerSection; tabId: string; index?: number } }
  | { type: 'UPDATE_SECTION'; payload: { id: string; updates: Partial<DesignerSection> } }
  | { type: 'REMOVE_SECTION'; payload: { id: string } }
  | { type: 'MOVE_SECTION'; payload: { sectionId: string; tabId: string; index: number } }
  | { type: 'ADD_TAB'; payload: { tab: DesignerTab; index?: number } }
  | { type: 'UPDATE_TAB'; payload: { id: string; updates: Partial<DesignerTab> } }
  | { type: 'REMOVE_TAB'; payload: { id: string } }
  | { type: 'MOVE_TAB'; payload: { tabId: string; index: number } }
  | { type: 'SET_DRAG_STATE'; payload: DragState | null }
  | { type: 'SET_MODE'; payload: 'edit' | 'preview' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' };

// ============================================================================
// Palette Items (for drag source)
// ============================================================================

export interface PaletteItem {
  id: string;
  type: DesignerItem['type'] | 'new_section' | 'new_tab';
  label: string;
  icon: string;
  description?: string;
  category: 'properties' | 'layout' | 'data' | 'display';
  protection?: ProtectionLevel;
  propertyCode?: string;       // For property palette items
  propertyType?: string;       // For property type indicator
  isInLayout?: boolean;        // Already placed in layout
}

// ============================================================================
// Properties Panel
// ============================================================================

export interface PropertyDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'color' |
        'icon' | 'condition' | 'columns' | 'json';
  options?: { value: any; label: string }[];
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface PropertyGroup {
  id: string;
  label: string;
  properties: PropertyDefinition[];
  collapsed?: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createEmptyLayout(): DesignerLayout {
  return {
    version: 2,
    tabs: [
      {
        id: generateId(),
        label: 'Details',
        icon: 'file-text',
        sections: [
          {
            id: generateId(),
            label: 'General Information',
            columns: 2,
            items: [],
          },
        ],
      },
    ],
  };
}

export function createDefaultProperty(propertyCode: string, _label?: string): DesignerProperty {
  return {
    type: 'property',
    id: generateId(),
    propertyCode,
    span: 1,
  };
}

export const createDefaultField = createDefaultProperty;

export function createDefaultSection(label?: string): DesignerSection {
  return {
    id: generateId(),
    label,
    columns: 2,
    items: [],
  };
}

export function createDefaultTab(label: string): DesignerTab {
  return {
    id: generateId(),
    label,
    icon: 'layers',
    sections: [createDefaultSection()],
  };
}
