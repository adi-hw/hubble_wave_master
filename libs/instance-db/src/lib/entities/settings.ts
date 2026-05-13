// libs/instance-db/src/lib/entities/settings.ts
//
// Settings-area entities: authentication settings and events, navigation
// profiles, instance settings, navigation nodes/patches, instance
// customization, configuration change history, theme and branding,
// user preferences, audit logs (access-rule, access, property), and
// runtime anomaly observability.
//
// Public API surface is unchanged — entities continue to be exported via
// the package barrel `@hubblewave/instance-db`. This file exists to make
// area ownership explicit and to ease future code navigation. See Plan
// Fix 24 PR-A for the restructure rationale.

export { AuthSettings, AuthEvent, AuditLog, NavProfile, NavProfileItem, InstanceSetting } from './settings.entity';
export { NavNode, NavPatch } from './navigation.entity';
export { InstanceCustomization, ConfigChangeHistory } from './instance-config.entity';

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

export { AccessRuleAuditLog, AccessAuditLog, PropertyAuditLog } from './audit.entity';

export { RuntimeAnomaly } from './runtime-anomaly.entity';
