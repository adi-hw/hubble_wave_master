/**
 * NavItem Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready navigation item with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - Keyboard navigation support
 */

import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { Icon } from '../Icon';
import { ResolvedNavNode } from '../../types/navigation';
import { cn } from '../../lib/utils';

interface NavItemProps {
  node: ResolvedNavNode;
  depth?: number;
  collapsed?: boolean;
  onToggleFavorite?: (moduleKey: string) => void;
  onNavigate?: (moduleKey: string) => void;
}

export const NavItem: React.FC<NavItemProps> = ({
  node,
  depth = 0,
  collapsed = false,
  onToggleFavorite,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = React.useState(node.isExpanded ?? depth === 0);
  const [showFavorite, setShowFavorite] = React.useState(false);

  const hasChildren = node.children && node.children.length > 0;
  const isGroup = node.type === 'group' || node.type === 'smart_group';
  const isSeparator = node.type === 'separator';

  // Check if this item or any child is active
  const isActive = node.route && location.pathname.startsWith(node.route);
  const hasActiveChild = node.children?.some(
    (child) => child.route && location.pathname.startsWith(child.route)
  );

  // Auto-expand if has active child
  React.useEffect(() => {
    if (hasActiveChild && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasActiveChild, isExpanded]);

  const handleClick = useCallback(() => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else if (node.route) {
      navigate(node.route);
      if (onNavigate && node.moduleKey) {
        onNavigate(node.moduleKey);
      }
    }
  }, [hasChildren, isExpanded, node.route, node.moduleKey, navigate, onNavigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite && node.moduleKey) {
      onToggleFavorite(node.moduleKey);
    }
  }, [onToggleFavorite, node.moduleKey]);

  const handleFavoriteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleFavorite && node.moduleKey) {
        onToggleFavorite(node.moduleKey);
      }
    }
  }, [onToggleFavorite, node.moduleKey]);

  // Render separator
  if (isSeparator) {
    return (
      <div
        className="my-2 mx-3 border-t border-border"
        role="separator"
        aria-hidden="true"
      />
    );
  }

  // Render group header (when collapsed, show as icon only)
  if (isGroup && !hasChildren) {
    return null; // Empty groups are hidden
  }

  // Group header style
  if (isGroup) {
    return (
      <div className="mt-4 first:mt-0" role="group" aria-label={node.label}>
        {!collapsed && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors min-h-[44px] text-muted-foreground hover:bg-muted',
              depth === 1 && 'pl-6',
              depth === 2 && 'pl-9',
              depth >= 3 && 'pl-12'
            )}
            aria-expanded={isExpanded}
            aria-controls={`nav-group-${node.key}`}
          >
            {hasChildren && (
              <span className="flex-shrink-0" aria-hidden="true">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
            )}
            <span className="truncate">{node.label}</span>
            {node.badge && (
              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary text-primary-foreground">
                {node.badge}
              </span>
            )}
          </button>
        )}

        {/* Children */}
        {(isExpanded || collapsed) && hasChildren && (
          <div
            id={`nav-group-${node.key}`}
            className={collapsed ? 'space-y-1 mt-1' : 'space-y-0.5 mt-1'}
            role="list"
          >
            {node.children!.map((child) => (
              <NavItem
                key={child.key}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                onToggleFavorite={onToggleFavorite}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular nav item
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setShowFavorite(true)}
      onMouseLeave={() => setShowFavorite(false)}
      title={collapsed ? node.label : undefined}
      className={cn(
        'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 cursor-pointer min-h-[44px]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
        'hover:bg-muted',
        collapsed ? 'justify-center' : '',
        isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground',
        !collapsed && depth === 1 && 'pl-6',
        !collapsed && depth === 2 && 'pl-9',
        !collapsed && depth >= 3 && 'pl-12'
      )}
      aria-current={isActive ? 'page' : undefined}
      aria-expanded={hasChildren ? isExpanded : undefined}
    >
      {/* Icon */}
      {node.icon && (
        <span
          className={cn(
            'flex-shrink-0',
            isActive ? 'text-primary' : 'text-muted-foreground'
          )}
          aria-hidden="true"
        >
          <Icon name={node.icon} className="h-5 w-5" />
        </span>
      )}

      {/* Label */}
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">{node.label}</span>

          {/* Badge */}
          {node.badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary text-primary-foreground">
              {node.badge}
            </span>
          )}

          {/* Favorite star */}
          {onToggleFavorite && node.moduleKey && (showFavorite || node.isFavorite) && (
            <button
              onClick={handleFavoriteClick}
              onKeyDown={handleFavoriteKeyDown}
              className={cn(
                'flex-shrink-0 p-1 rounded transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center',
                node.isFavorite ? 'text-warning-text' : 'text-muted-foreground'
              )}
              aria-label={node.isFavorite ? `Remove ${node.label} from favorites` : `Add ${node.label} to favorites`}
              aria-pressed={node.isFavorite}
            >
              <Star
                className="h-4 w-4"
                fill={node.isFavorite ? 'currentColor' : 'none'}
              />
            </button>
          )}

          {/* Expand/collapse for items with children */}
          {hasChildren && (
            <span className="flex-shrink-0 text-muted-foreground" aria-hidden="true">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default NavItem;
