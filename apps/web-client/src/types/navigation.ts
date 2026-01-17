/**
 * Navigation Types
 *
 * These types align with the backend navigation system.
 */

/**
 * Navigation node types (lowercase for API compatibility)
 */
export type NavNodeType =
  | 'module'
  | 'group'
  | 'separator'
  | 'link'
  | 'smart_group'
  | 'table'
  | 'form'
  | 'report'
  | 'dashboard';

/**
 * Smart group types
 */
export type SmartGroupType = 'favorites' | 'recent' | 'frequent';

/**
 * Resolved navigation node (from backend)
 */
export interface ResolvedNavNode {
  key: string;
  type: NavNodeType;
  label: string;
  icon?: string;
  route?: string;
  url?: string;
  badge?: string | number;
  children?: ResolvedNavNode[];
  isFavorite?: boolean;
  isExpanded?: boolean;
  moduleKey?: string;
  smartGroupType?: SmartGroupType;
  smartGroupItems?: ResolvedNavNode[];
  metadata?: Record<string, unknown>;
}

/**
 * Recent module entry
 */
export interface RecentModule {
  key: string;
  label: string;
  icon?: string;
  route?: string;
  accessedAt: string;
}

/**
 * Resolved navigation (from backend)
 */
export interface ResolvedNavigation {
  profileId: string;
  profileSlug?: string;
  profileName: string;
  nodes: ResolvedNavNode[];
  favorites?: string[];
  recentModules?: RecentModule[];
  smartGroups?: {
    favorites: ResolvedNavNode[];
    recent: ResolvedNavNode[];
    frequent: ResolvedNavNode[];
  };
  resolvedAt?: string;
}

/**
 * Navigation profile summary
 */
export interface NavProfileSummary {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  isLocked: boolean;
}

/**
 * Navigation search result
 */
export interface NavSearchResult {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  route?: string;
  type: NavNodeType;
  /** Path/breadcrumb to this item */
  path: string[];
  score: number;
}

/**
 * Switch profile request
 */
export interface SwitchProfileRequest {
  profileId: string;
}

/**
 * Toggle favorite request
 */
export interface ToggleFavoriteRequest {
  moduleKey: string;
}

/**
 * Record navigation request
 */
export interface RecordNavigationRequest {
  moduleKey: string;
}

/**
 * Navigation cache stats
 */
export interface NavigationCacheStats {
  navigation: { size: number; maxSize: number };
  profile: { size: number; maxSize: number };
  module: { size: number; maxSize: number };
}

/**
 * Navigation context for the hook
 */
export interface NavigationContextValue {
  /** Resolved navigation tree (alias for navigation) */
  nav: ResolvedNavigation | null;
  /** Resolved navigation tree */
  navigation: ResolvedNavigation | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Available profiles */
  profiles: NavProfileSummary[];
  /** Active profile */
  activeProfile: NavProfileSummary | null;
  /** Switch to a different profile */
  switchProfile: (profileId: string) => Promise<void>;
  /** Toggle favorite status */
  toggleFavorite: (moduleKey: string) => Promise<void>;
  /** Record navigation (for recent/frequent) */
  recordNavigation: (moduleKey: string) => Promise<void>;
  /** Search navigation */
  searchNavigation: (query: string) => NavSearchResult[];
  /** Refresh navigation */
  refresh: () => Promise<void>;
}

/**
 * Navigation item for bottom navigation bar
 */
export interface NavItem {
  code: string;
  label: string;
  icon: string;
  path?: string;
}

/**
 * Navigation section for grouped navigation
 */
export interface NavSection {
  name: string;
  items: NavItem[];
}

/**
 * Navigation response from UI service
 */
export interface NavigationResponse {
  sections: NavSection[];
  bottomNav: NavItem[];
}
