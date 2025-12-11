/**
 * SidebarFlyout V2
 *
 * Modern ServiceNow-inspired navigation sidebar with:
 * - Application filter (All Apps dropdown)
 * - Smart groups (Favorites, Recent)
 * - Collapsible groups with icons
 * - Search functionality
 * - Profile switching
 * - Sleek, modern design
 */

import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Star,
  Clock,
  Search,
  X,
  Layers,
  Box,
  Settings,
  Paintbrush,
} from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import { Icon } from '../Icon';
import { ResolvedNavNode } from '../../types/navigation-v2';

interface SidebarFlyoutV2Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

// Helper to get application icon
const getAppIcon = (key: string) => {
  switch (key) {
    case 'eam':
      return <Box className="h-4 w-4" />;
    case 'admin':
      return <Settings className="h-4 w-4" />;
    case 'studio':
      return <Paintbrush className="h-4 w-4" />;
    default:
      return <Layers className="h-4 w-4" />;
  }
};

// Navigation Item Component
interface NavItemProps {
  node: ResolvedNavNode;
  depth?: number;
  collapsed?: boolean;
  favorites: string[];
  onToggleFavorite?: (moduleKey: string) => void;
  onNavigate?: (moduleKey: string) => void;
}

const NavItemComponent: React.FC<NavItemProps> = ({
  node,
  depth = 0,
  collapsed = false,
  favorites,
  onToggleFavorite,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(node.isExpanded ?? depth < 2);
  const [isHovered, setIsHovered] = useState(false);

  const hasChildren = node.children && node.children.length > 0;
  const isGroup = node.type === 'group' || node.type === 'smart_group';
  const isSeparator = node.type === 'separator';
  const isActive = node.route && location.pathname.startsWith(node.route);
  const isFavorite = node.moduleKey ? favorites.includes(node.moduleKey) : false;

  // Auto-expand if has active child
  const hasActiveChild = node.children?.some(
    (child) => child.route && location.pathname.startsWith(child.route)
  );

  React.useEffect(() => {
    if (hasActiveChild && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasActiveChild]);

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else if (node.route) {
      navigate(node.route);
      if (onNavigate && node.moduleKey) {
        onNavigate(node.moduleKey);
      }
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite && node.moduleKey) {
      onToggleFavorite(node.moduleKey);
    }
  };

  if (isSeparator) {
    return <div className="my-2 mx-4 border-t border-slate-200/60" />;
  }

  // Group header
  if (isGroup && depth === 0) {
    return (
      <div className="mt-6 first:mt-2">
        {!collapsed && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
          >
            {node.icon && (
              <span className="text-slate-400">
                <Icon name={node.icon} className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="flex-1 text-left">{node.label}</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                isExpanded ? '' : '-rotate-90'
              }`}
            />
          </button>
        )}

        {(isExpanded || collapsed) && hasChildren && (
          <div className="mt-1 space-y-0.5">
            {node.children!.map((child) => (
              <NavItemComponent
                key={child.key}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Nested group (subgroup)
  if (isGroup && depth > 0) {
    return (
      <div className="mt-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md mx-2 transition-colors"
          style={{ paddingLeft: `${16 + depth * 12}px` }}
        >
          <ChevronRight
            className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
          <span className="flex-1 text-left">{node.label}</span>
        </button>

        {isExpanded && hasChildren && (
          <div className="mt-0.5 space-y-0.5">
            {node.children!.map((child) => (
              <NavItemComponent
                key={child.key}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular nav item (module/link)
  const paddingLeft = collapsed ? 12 : 16 + depth * 12;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={collapsed ? node.label : undefined}
      className={`
        group relative flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm cursor-pointer
        transition-all duration-150
        ${isActive
          ? 'bg-gradient-to-r from-sky-500/10 to-indigo-500/10 text-sky-700 font-medium shadow-sm ring-1 ring-sky-500/20'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }
        ${collapsed ? 'justify-center mx-1' : ''}
      `}
      style={{ paddingLeft: collapsed ? undefined : paddingLeft }}
    >
      {/* Icon */}
      {node.icon && (
        <span className={`flex-shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
          <Icon name={node.icon} className="h-4 w-4" />
        </span>
      )}

      {/* Label */}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{node.label}</span>

          {/* Favorite star */}
          {onToggleFavorite && node.moduleKey && (isHovered || isFavorite) && (
            <button
              onClick={handleFavoriteClick}
              className={`
                flex-shrink-0 p-0.5 rounded transition-all duration-150
                ${isFavorite
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                }
              `}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className="h-3.5 w-3.5"
                fill={isFavorite ? 'currentColor' : 'none'}
              />
            </button>
          )}
        </>
      )}
    </div>
  );
};

// Smart Group Component
interface SmartGroupProps {
  title: string;
  icon: React.ReactNode;
  items: ResolvedNavNode[];
  collapsed?: boolean;
  defaultExpanded?: boolean;
  favorites: string[];
  onToggleFavorite?: (moduleKey: string) => void;
  onNavigate?: (moduleKey: string) => void;
  emptyMessage?: string;
}

const SmartGroup: React.FC<SmartGroupProps> = ({
  title,
  icon,
  items,
  collapsed = false,
  defaultExpanded = true,
  favorites,
  onToggleFavorite,
  onNavigate,
  emptyMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (collapsed) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
      >
        <span className="text-slate-400">{icon}</span>
        <span className="flex-1 text-left">{title}</span>
        {items.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded-full">
            {items.length}
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${
            isExpanded ? '' : '-rotate-90'
          }`}
        />
      </button>

      {isExpanded && (
        <div className="mt-1 space-y-0.5">
          {items.length > 0 ? (
            items.map((item) => (
              <NavItemComponent
                key={item.key}
                node={item}
                depth={1}
                collapsed={collapsed}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                onNavigate={onNavigate}
              />
            ))
          ) : (
            <p className="px-4 py-2 text-xs text-slate-400 italic">
              {emptyMessage || 'No items'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const SidebarFlyoutV2: React.FC<SidebarFlyoutV2Props> = ({
  collapsed = false,
  onToggle,
}) => {
  const {
    navigation,
    loading,
    error,
    profiles,
    activeProfile,
    switchProfile,
    toggleFavorite,
    recordNavigation,
    refresh,
    isV2,
  } = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const favorites = navigation?.favorites || [];

  // Get favorite items from navigation
  const favoriteItems = useMemo(() => {
    if (!navigation) return [];

    const items: ResolvedNavNode[] = [];
    const findModules = (nodes: ResolvedNavNode[]) => {
      for (const node of nodes) {
        if (node.moduleKey && favorites.includes(node.moduleKey)) {
          items.push(node);
        }
        if (node.children) {
          findModules(node.children);
        }
      }
    };
    findModules(navigation.nodes);
    return items;
  }, [navigation, favorites]);

  // Get recent items
  const recentItems = useMemo(() => {
    if (!navigation?.recentModules) return [];
    return navigation.recentModules.slice(0, 5).map((r) => ({
      key: r.key,
      label: r.label,
      icon: r.icon,
      type: 'module' as const,
      route: r.route,
      moduleKey: r.key,
    }));
  }, [navigation?.recentModules]);

  // Filter navigation by search
  const filteredNavigation = useMemo(() => {
    if (!navigation || !searchQuery.trim()) return navigation;

    const query = searchQuery.toLowerCase();
    const filterNodes = (nodes: ResolvedNavNode[]): ResolvedNavNode[] => {
      const result: ResolvedNavNode[] = [];

      for (const node of nodes) {
        const matchesLabel = node.label.toLowerCase().includes(query);
        const filteredChildren = node.children ? filterNodes(node.children) : [];

        if (matchesLabel || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children,
            isExpanded: true,
          });
        }
      }

      return result;
    };

    return {
      ...navigation,
      nodes: filterNodes(navigation.nodes),
    };
  }, [navigation, searchQuery]);

  const widthClass = collapsed ? 'w-16' : 'w-64';

  return (
    <nav
      className={`
        relative hidden md:flex flex-col flex-shrink-0
        ${widthClass} h-[calc(100vh-3.5rem)] sticky top-14
        bg-white border-r border-slate-200
        transition-all duration-200 ease-in-out
      `}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="
          absolute -right-3 top-6 z-10
          h-6 w-6 rounded-full
          bg-white border border-slate-200 shadow-sm
          text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:shadow
          flex items-center justify-center
          transition-all duration-150
        "
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Header with Profile/App Switcher */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-slate-100">
          {/* Profile Switcher */}
          {profiles.length > 1 && (
            <div className="relative mb-2">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <Layers className="h-4 w-4 text-slate-400" />
                <span className="flex-1 text-left text-slate-700 truncate">
                  {activeProfile?.name || 'Navigation'}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

              {showProfileMenu && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => {
                        switchProfile(profile.id);
                        setShowProfileMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${
                        profile.id === activeProfile?.id ? 'bg-sky-50 text-sky-700' : 'text-slate-700'
                      }`}
                    >
                      {profile.id === activeProfile?.id && (
                        <span className="text-sky-500">✓</span>
                      )}
                      <span className={profile.id === activeProfile?.id ? '' : 'ml-5'}>{profile.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-sky-300 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300">
        {/* Error State */}
        {error && !loading && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-red-500 mb-3">{error}</p>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !navigation && (
          <div className="px-4 py-4">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-slate-100 rounded-lg" />
              <div className="h-8 bg-slate-100 rounded-lg" />
              <div className="h-8 bg-slate-100 rounded-lg" />
            </div>
          </div>
        )}

        {/* Navigation */}
        {filteredNavigation && !collapsed && (
          <>
            {/* Smart Groups */}
            {isV2 && !searchQuery && (
              <>
                <SmartGroup
                  title="Favorites"
                  icon={<Star className="h-3.5 w-3.5" />}
                  items={favoriteItems}
                  collapsed={collapsed}
                  defaultExpanded={true}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  onNavigate={recordNavigation}
                  emptyMessage="Click ★ on any item to add favorites"
                />

                {recentItems.length > 0 && (
                  <SmartGroup
                    title="Recent"
                    icon={<Clock className="h-3.5 w-3.5" />}
                    items={recentItems}
                    collapsed={collapsed}
                    defaultExpanded={false}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onNavigate={recordNavigation}
                  />
                )}
              </>
            )}

            {/* Main Navigation Tree */}
            <div>
              {filteredNavigation.nodes
                .filter((node) => {
                  // Filter out smart_group nodes when V2 is enabled (they're rendered above)
                  if (isV2 && !searchQuery && node.type === 'smart_group') {
                    return false;
                  }
                  return true;
                })
                .map((node) => (
                  <NavItemComponent
                    key={node.key}
                    node={node}
                    depth={0}
                    collapsed={collapsed}
                    favorites={favorites}
                    onToggleFavorite={isV2 ? toggleFavorite : undefined}
                    onNavigate={isV2 ? recordNavigation : undefined}
                  />
                ))}
            </div>
          </>
        )}

        {/* Collapsed state - just icons */}
        {collapsed && filteredNavigation && (
          <div className="space-y-1 px-1">
            {filteredNavigation.nodes
              .filter((node) => node.type === 'group')
              .map((node) => (
                <button
                  key={node.key}
                  title={node.label}
                  className="w-full p-3 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  {node.icon ? (
                    <Icon name={node.icon} className="h-5 w-5 mx-auto" />
                  ) : (
                    getAppIcon(node.key)
                  )}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="truncate">{activeProfile?.name || 'Navigation'}</span>
            {loading && (
              <div className="h-3 w-3 border-2 border-slate-300 border-t-sky-500 rounded-full animate-spin" />
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default SidebarFlyoutV2;
