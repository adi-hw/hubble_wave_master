/**
 * SidebarFlyout V2
 *
 * Modern ServiceNow-inspired navigation sidebar with:
 * - Application filter (All Apps dropdown)
 * - Smart groups (Favorites, Recent)
 * - Collapsible groups with icons
 * - Search functionality
 * - Profile switching
 * - Sleek, modern design using HubbleWave design tokens
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
import { cn } from '../../lib/utils';

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
    return (
      <div
        className="my-2 mx-4"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      />
    );
  }

  // Group header
  if (isGroup && depth === 0) {
    return (
      <div className="mt-6 first:mt-2">
        {!collapsed && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="sidebar-group-title w-full flex items-center gap-2"
          >
            {node.icon && (
              <span style={{ color: 'var(--text-muted)' }}>
                <Icon name={node.icon} className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="flex-1 text-left">{node.label}</span>
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                !isExpanded && '-rotate-90'
              )}
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
          className="w-full flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md mx-2 transition-colors"
          style={{
            paddingLeft: `${16 + depth * 12}px`,
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 transition-transform duration-200',
              isExpanded && 'rotate-90'
            )}
            style={{ color: 'var(--text-muted)' }}
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
      className={cn(
        'group relative flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150',
        collapsed && 'justify-center mx-1'
      )}
      style={{
        paddingLeft: collapsed ? undefined : paddingLeft,
        backgroundColor: isActive ? 'var(--bg-selected)' : undefined,
        color: isActive ? 'var(--text-brand)' : 'var(--text-secondary)',
        fontWeight: isActive ? 500 : undefined,
        boxShadow: isActive ? 'var(--shadow-xs)' : undefined,
        border: isActive ? '1px solid var(--border-primary)' : '1px solid transparent',
      }}
      onMouseOver={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseOut={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {/* Icon */}
      {node.icon && (
        <span
          className="flex-shrink-0"
          style={{
            color: isActive ? 'var(--text-brand)' : 'var(--text-muted)',
          }}
        >
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
              className={cn(
                'flex-shrink-0 p-0.5 rounded transition-all duration-150',
                !isFavorite && 'opacity-0 group-hover:opacity-100'
              )}
              style={{
                color: isFavorite
                  ? 'var(--color-warning-500)'
                  : 'var(--text-muted)',
              }}
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
        className="sidebar-group-title w-full flex items-center gap-2"
      >
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        <span className="flex-1 text-left">{title}</span>
        {items.length > 0 && (
          <span
            className="px-1.5 py-0.5 text-[10px] font-medium rounded-full"
            style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              color: 'var(--text-tertiary)',
            }}
          >
            {items.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform duration-200',
            !isExpanded && '-rotate-90'
          )}
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
            <p
              className="px-4 py-2 text-xs italic"
              style={{ color: 'var(--text-muted)' }}
            >
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
      className={cn(
        'sidebar relative hidden md:flex flex-col flex-shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 transition-all duration-200 ease-in-out',
        widthClass
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full flex items-center justify-center transition-all duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-muted)',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-strong)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
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
        <div
          className="px-3 py-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {/* Profile Switcher */}
          {profiles.length > 1 && (
            <div className="relative mb-2">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface-secondary)',
                  color: 'var(--text-primary)',
                }}
              >
                <Layers
                  className="h-4 w-4"
                  style={{ color: 'var(--text-muted)' }}
                />
                <span className="flex-1 text-left truncate">
                  {activeProfile?.name || 'Navigation'}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    showProfileMenu && 'rotate-180'
                  )}
                  style={{ color: 'var(--text-muted)' }}
                />
              </button>

              {showProfileMenu && (
                <div
                  className="dropdown absolute left-0 right-0 top-full mt-1 z-50 py-1"
                >
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => {
                        switchProfile(profile.id);
                        setShowProfileMenu(false);
                      }}
                      className={cn(
                        'dropdown-item w-full',
                        profile.id === activeProfile?.id && 'active'
                      )}
                    >
                      {profile.id === activeProfile?.id && (
                        <span style={{ color: 'var(--text-brand)' }}>✓</span>
                      )}
                      <span className={profile.id === activeProfile?.id ? '' : 'ml-5'}>
                        {profile.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="input w-full pl-9 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {/* Error State */}
        {error && !loading && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm mb-3" style={{ color: 'var(--text-danger)' }}>
              {error}
            </p>
            <button onClick={refresh} className="btn-primary btn-sm">
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !navigation && (
          <div className="px-4 py-4">
            <div className="animate-pulse space-y-4">
              <div
                className="h-8 rounded-lg"
                style={{ backgroundColor: 'var(--bg-surface-secondary)' }}
              />
              <div
                className="h-8 rounded-lg"
                style={{ backgroundColor: 'var(--bg-surface-secondary)' }}
              />
              <div
                className="h-8 rounded-lg"
                style={{ backgroundColor: 'var(--bg-surface-secondary)' }}
              />
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
                  className="w-full p-3 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
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

    </nav>
  );
};

export default SidebarFlyoutV2;
