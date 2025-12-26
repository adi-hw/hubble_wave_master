// ============================================================
// Instance Database Entities
// ============================================================

// ─────────────────────────────────────────────────────────────────
// Core Identity
// ─────────────────────────────────────────────────────────────────
export { User, UserStatus } from './user.entity';

// ─────────────────────────────────────────────────────────────────
// RBAC (Role-Based Access Control)
// ─────────────────────────────────────────────────────────────────
export { Role, RoleScope } from './role.entity';
export { Permission } from './permission.entity';
export { RolePermission, UserRole, AssignmentSource } from './role-permission.entity';
export { Group, GroupType, GroupMember, GroupRole } from './group.entity';

// ─────────────────────────────────────────────────────────────────
// Schema Engine (Collections & Properties)
// ─────────────────────────────────────────────────────────────────
export { CollectionDefinition, OwnerType } from './collection-definition.entity';
export { PropertyDefinition, DefaultValueType } from './property-definition.entity';
export { PropertyType, PropertyTypeCategory, ChoiceList, ChoiceItem } from './property-type.entity';
export { SchemaChangeLog, SchemaEntityType, SchemaChangeType, SchemaChangeSource, PerformedByType } from './schema-change-log.entity';
export { SchemaSyncState, SyncResult, DriftDetails } from './schema-sync-state.entity';

// ─────────────────────────────────────────────────────────────────
// Access Control
// ─────────────────────────────────────────────────────────────────
export { CollectionAccessRule, PropertyAccessRule, UserSession } from './access-rule.entity';
export { AccessCondition, AccessConditionGroup } from './access-conditions.entity';

// ─────────────────────────────────────────────────────────────────
// Authentication & Settings
// ─────────────────────────────────────────────────────────────────
export { AuthSettings, AuthEvent, AuditLog, NavProfile, NavProfileItem, InstanceSetting } from './settings.entity';
export { NavNode, NavPatch } from './navigation.entity';
export { PasswordPolicy, LdapConfig, SsoProvider } from './auth-config.entity';
export { InstanceCustomization, ConfigChangeHistory } from './instance-config.entity';

// ─────────────────────────────────────────────────────────────────
// Auth Tokens
// ─────────────────────────────────────────────────────────────────
export {
  PasswordHistory,
  PasswordResetToken,
  EmailVerificationToken,
  RefreshToken,
  ApiKey,
  MfaMethod,
  UserInvitation,
} from './auth-tokens.entity';

// ─────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────
export {
  ThemeDefinition,
  UserThemePreference,
  InstanceBranding,
  ThemeConfig,
  ThemeType,
  ContrastLevel,
  ColorScheme,
  ColorSchemePref,
  PreferenceSource,
} from './theme.entity';

// ─────────────────────────────────────────────────────────────────
// User Preferences
// ─────────────────────────────────────────────────────────────────
export {
  UserPreference,
  DensityMode,
  SidebarPosition,
  DateFormat,
  TimeFormat,
  StartOfWeek,
  NotificationFrequency,
  PinnedNavigationItem,
  KeyboardShortcut,
  NotificationPreferences,
  AccessibilitySettings,
  TablePreferences,
  DashboardPreferences,
} from './user-preference.entity';

// ─────────────────────────────────────────────────────────────────
// Modules
// ─────────────────────────────────────────────────────────────────
export { ModuleEntity, ModuleSecurity, ModuleType, ModuleTargetConfig } from './module.entity';

// ─────────────────────────────────────────────────────────────────
// Forms
// ─────────────────────────────────────────────────────────────────
export { FormDefinition, FormVersion } from './form.entity';

// ─────────────────────────────────────────────────────────────────
// Audit Logs
// ─────────────────────────────────────────────────────────────────
export { AccessRuleAuditLog, AccessAuditLog, PropertyAuditLog } from './audit.entity';

// ─────────────────────────────────────────────────────────────────
// AVA (AI Virtual Assistant)
// ─────────────────────────────────────────────────────────────────
export { AVAAuditTrail, AVAPermissionConfig, AVAGlobalSettings, AVAActionType, AVAActionStatus } from './ava.entity';

// ============================================================
// Entity Array for TypeORM Configuration
// ============================================================

import { User } from './user.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';
import { RolePermission, UserRole } from './role-permission.entity';
import { Group, GroupMember, GroupRole } from './group.entity';
import { CollectionDefinition } from './collection-definition.entity';
import { PropertyDefinition } from './property-definition.entity';
import { PropertyType, ChoiceList, ChoiceItem } from './property-type.entity';
import { SchemaChangeLog } from './schema-change-log.entity';
import { SchemaSyncState } from './schema-sync-state.entity';
import { CollectionAccessRule, PropertyAccessRule, UserSession } from './access-rule.entity';
import { AccessCondition, AccessConditionGroup } from './access-conditions.entity';
import { AuthSettings, AuthEvent, AuditLog, NavProfile, NavProfileItem, InstanceSetting } from './settings.entity';
import { NavNode, NavPatch } from './navigation.entity';
import { PasswordPolicy, LdapConfig, SsoProvider } from './auth-config.entity';
import { InstanceCustomization, ConfigChangeHistory } from './instance-config.entity';
import {
  PasswordHistory,
  PasswordResetToken,
  EmailVerificationToken,
  RefreshToken,
  ApiKey,
  UserInvitation,
  MfaMethod,
} from './auth-tokens.entity';
import { ThemeDefinition, UserThemePreference, InstanceBranding } from './theme.entity';
import { UserPreference } from './user-preference.entity';
import { ModuleEntity, ModuleSecurity } from './module.entity';
import { FormDefinition, FormVersion } from './form.entity';
import { AccessRuleAuditLog, AccessAuditLog, PropertyAuditLog } from './audit.entity';
import { AVAAuditTrail, AVAPermissionConfig, AVAGlobalSettings } from './ava.entity';

/**
 * All instance database entities
 * Use this array when configuring TypeORM
 */
export const instanceEntities = [
  // Core Identity
  User,

  // RBAC
  Role,
  Permission,
  RolePermission,
  UserRole,
  Group,
  GroupMember,
  GroupRole,

  // Schema Engine
  CollectionDefinition,
  PropertyDefinition,
  PropertyType,
  ChoiceList,
  ChoiceItem,
  SchemaChangeLog,
  SchemaSyncState,

  // Access Control
  CollectionAccessRule,
  PropertyAccessRule,
  UserSession,
  AccessCondition,
  AccessConditionGroup,

  // Authentication & Settings
  AuthSettings,
  AuthEvent,
  AuditLog,
  NavProfile,
  NavProfileItem,
  NavNode,    // [NEW]
  NavPatch,   // [NEW]
  InstanceSetting,
  PasswordPolicy,
  LdapConfig,
  SsoProvider,
  InstanceCustomization,
  ConfigChangeHistory,

  // Auth Tokens
  PasswordHistory,
  PasswordResetToken,
  EmailVerificationToken,
  RefreshToken,
  ApiKey,
  UserInvitation,
  MfaMethod,

  // UI & Forms
  ThemeDefinition,
  UserThemePreference,
  InstanceBranding,
  UserPreference,
  FormDefinition,
  FormVersion,

  // Business Logic
  ModuleEntity,
  ModuleSecurity,

  // Audit Logs
  AccessRuleAuditLog,
  AccessAuditLog,
  PropertyAuditLog,

  // AVA (AI Virtual Assistant)
  AVAAuditTrail,
  AVAPermissionConfig,
  AVAGlobalSettings,
];
