/**
 * ModulesDrawerV2 - Mobile navigation drawer using V2 navigation system
 *
 * Full-screen drawer for mobile devices that displays the complete navigation tree.
 * Supports:
 * - Hierarchical navigation with expandable groups
 * - Smart groups (favorites, recent)
 * - Profile switching
 * - Search
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ChevronRight,
  ChevronDown,
  Search,
  Star,
  Clock,
  Loader2,
  User,
} from 'lucide-react';
import { useNavigationV2 } from '../../hooks/useNavigationV2';
import { ResolvedNavNode } from '../../types/navigation-v2';
import { Icon } from '../Icon';

interface ModulesDrawerV2Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Recursive nav item component for mobile
 */
const MobileNavItem: React.FC<{
  node: ResolvedNavNode;
  level: number;
  onNavigate: (route: string) => void;
  favorites: string[];
  onToggleFavorite: (key: string) => void;
}> = ({ node, level, onNavigate, favorites, onToggleFavorite }) => {
  const [expanded, setExpanded] = useState(level === 0);
  const hasChildren = (node.children && node.children.length > 0) ||
                      (node.smartGroupItems && node.smartGroupItems.length > 0);
  const isFavorite = favorites.includes(node.moduleKey || node.key);

  if (node.type === 'separator') {
    return (
      <div
        className="my-3 mx-3 border-t"
        style={{ borderColor: 'var(--hw-border)' }}
      />
    );
  }

  // Smart group with items
  if (node.type === 'smart_group') {
    const items = node.smartGroupItems || [];
    if (items.length === 0) return null;

    const icon = node.smartGroupType === 'favorites' ? Star : Clock;
    const IconComponent = icon;

    return (
      <div className="mb-4">
        <div
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--hw-text-muted)' }}
        >
          <IconComponent className="h-3.5 w-3.5" />
          {node.label}
        </div>
        <div className="space-y-1">
          {items.map((item) => (
            <MobileNavItem
              key={item.key}
              node={item}
              level={level + 1}
              onNavigate={onNavigate}
              favorites={favorites}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </div>
    );
  }

  // Group with children
  if (node.type === 'group') {
    return (
      <div className="mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
          style={{
            backgroundColor: expanded ? 'var(--hw-bg-subtle)' : 'transparent',
          }}
        >
          <span
            className="flex items-center gap-2.5 text-sm font-medium"
            style={{ color: 'var(--hw-text)' }}
          >
            {node.icon && <Icon name={node.icon} className="h-4.5 w-4.5" />}
            {node.label}
          </span>
          {hasChildren && (
            expanded ? (
              <ChevronDown className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
            ) : (
              <ChevronRight className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
            )
          )}
        </button>
        {expanded && hasChildren && (
          <div className="ml-4 mt-1 space-y-1 border-l pl-3" style={{ borderColor: 'var(--hw-border)' }}>
            {node.children?.map((child) => (
              <MobileNavItem
                key={child.key}
                node={child}
                level={level + 1}
                onNavigate={onNavigate}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Module or link
  const route = node.route || node.url;

  return (
    <div className="flex items-center group">
      <button
        onClick={() => {
          if (node.url?.startsWith('http')) {
            window.open(node.url, '_blank');
          } else if (route) {
            onNavigate(route);
          }
        }}
        className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors text-left"
        style={{
          paddingLeft: `${level * 0.5 + 0.75}rem`,
        }}
      >
        {node.icon && (
          <Icon
            name={node.icon}
            className="h-4 w-4 flex-shrink-0 text-slate-500"
          />
        )}
        <span className="text-sm" style={{ color: 'var(--hw-text-secondary)' }}>
          {node.label}
        </span>
      </button>
      {node.type === 'module' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(node.moduleKey || node.key);
          }}
          className="p-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Star
            className="h-4 w-4"
            style={{
              color: isFavorite ? 'var(--hw-warning)' : 'var(--hw-text-muted)',
              fill: isFavorite ? 'var(--hw-warning)' : 'transparent',
            }}
          />
        </button>
      )}
    </div>
  );
};

export const ModulesDrawerV2: React.FC<ModulesDrawerV2Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const {
    nav,
    loading,
    activeProfile,
    profiles,
    switchProfile,
    toggleFavorite,
    searchNavigation,
  } = useNavigationV2();

  const [searchQuery, setSearchQuery] = useState('');
  const [showProfilePicker, setShowProfilePicker] = useState(false);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchNavigation(searchQuery);
  }, [searchQuery, searchNavigation]);

  const handleNavigate = (route: string) => {
    navigate(route);
    onClose();
    setSearchQuery('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="absolute inset-x-0 bottom-0 top-14 rounded-t-3xl border-t overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--hw-surface)',
          borderColor: 'var(--hw-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--hw-border)' }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
              Navigation
            </h2>
            {activeProfile && profiles.length > 1 && (
              <button
                onClick={() => setShowProfilePicker(!showProfilePicker)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                style={{
                  backgroundColor: 'var(--hw-bg-subtle)',
                  color: 'var(--hw-text-muted)',
                }}
              >
                <User className="h-3 w-3" />
                {activeProfile.name}
                <ChevronDown className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
          >
            <X className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
          </button>
        </div>

        {/* Profile Picker Dropdown */}
        {showProfilePicker && profiles.length > 1 && (
          <div
            className="px-5 py-3 border-b"
            style={{
              borderColor: 'var(--hw-border)',
              backgroundColor: 'var(--hw-bg-subtle)',
            }}
          >
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--hw-text-muted)' }}>
              Switch Profile
            </div>
            <div className="space-y-1">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    switchProfile(profile.id);
                    setShowProfilePicker(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    backgroundColor: profile.id === activeProfile?.id
                      ? 'var(--hw-primary-subtle)'
                      : 'transparent',
                    color: profile.id === activeProfile?.id
                      ? 'var(--hw-primary)'
                      : 'var(--hw-text-secondary)',
                  }}
                >
                  <span>{profile.name}</span>
                  {profile.isDefault && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                    >
                      Default
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-5 py-3">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
          >
            <Search className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search navigation..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--hw-text)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--hw-text-muted)' }} />
            </div>
          ) : searchResults ? (
            // Search Results
            <div>
              <div
                className="text-xs font-medium mb-3"
                style={{ color: 'var(--hw-text-muted)' }}
              >
                {searchResults.length} results for "{searchQuery}"
              </div>
              {searchResults.length === 0 ? (
                <div
                  className="text-sm text-center py-8"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  No matching items found
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((result) => (
                    <button
                      key={result.key}
                      onClick={() => result.route && handleNavigate(result.route)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                      style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                    >
                      {result.icon && (
                        <Icon
                          name={result.icon}
                          className="h-4 w-4 text-slate-500"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate" style={{ color: 'var(--hw-text)' }}>
                          {result.label}
                        </div>
                        {result.path.length > 0 && (
                          <div
                            className="text-xs truncate"
                            style={{ color: 'var(--hw-text-muted)' }}
                          >
                            {result.path.join(' > ')}
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: 'var(--hw-text-muted)' }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : nav?.nodes ? (
            // Navigation Tree
            <div className="space-y-2">
              {nav.nodes.map((node) => (
                <MobileNavItem
                  key={node.key}
                  node={node}
                  level={0}
                  onNavigate={handleNavigate}
                  favorites={nav.favorites || []}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div
              className="text-sm text-center py-8"
              style={{ color: 'var(--hw-text-muted)' }}
            >
              No navigation available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModulesDrawerV2;
