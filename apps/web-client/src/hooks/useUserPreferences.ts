/**
 * useUserPreferences hook
 *
 * Re-exports the useUserPreferences hook from the context for convenience.
 * This provides access to all user preference functionality.
 */

export { useUserPreferences } from '../contexts/UserPreferencesContext';
export type {
  UserPreferences,
  UpdateUserPreferencesDto,
  PinnedNavigationItem,
  AddPinnedItemDto,
  DensityMode,
  SidebarPosition,
  NotificationPreferences,
  AccessibilitySettings,
  TablePreferences,
  DashboardPreferences,
} from '../contexts/UserPreferencesContext';
