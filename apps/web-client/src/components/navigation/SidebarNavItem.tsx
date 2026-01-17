/**
 * SidebarNavItem Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready sidebar navigation item with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - Keyboard navigation support
 */

import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Icon } from '../Icon';
import { ResolvedNavNode } from '../../types/navigation';

export interface SidebarNavItemProps {
  node: ResolvedNavNode;
  depth?: number;
  collapsed?: boolean;
  favorites: string[];
  onToggleFavorite?: (moduleKey: string) => void;
  onNavigate?: (moduleKey: string) => void;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  node,
  depth = 0,
  collapsed = false,
  favorites,
  onToggleFavorite,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = React.useState(node.isExpanded ?? depth < 2);

  const hasChildren = node.children && node.children.length > 0;
  const isGroup = node.type === 'group' || node.type === 'smart_group';
  const isSeparator = node.type === 'separator';
  const isActive = node.route ? location.pathname.startsWith(node.route) : false;
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

  if (isSeparator) {
    return (
      <div
        className="my-2 mx-4 border-t border-border"
        role="separator"
      />
    );
  }

  // Group header (Top Level)
  if (isGroup && depth === 0) {
    return (
      <div className="mt-6 first:mt-2">
        {!collapsed && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors min-h-[36px] text-muted-foreground hover:text-foreground"
            aria-expanded={isExpanded}
            aria-label={`${node.label} section, ${isExpanded ? 'expanded' : 'collapsed'}`}
          >
            {node.icon && (
              <span className="text-muted-foreground/70">
                <Icon name={node.icon} className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="flex-1 text-left">{node.label}</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                isExpanded ? '' : '-rotate-90'
              }`}
              aria-hidden="true"
            />
          </button>
        )}

        {(isExpanded || collapsed) && hasChildren && (
          <div className="mt-1 space-y-0.5" role="group" aria-label={node.label}>
            {node.children!.map((child) => (
              <SidebarNavItem
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
    const nestedPaddingClass = depth === 1 ? 'pl-7' : depth === 2 ? 'pl-10' : 'pl-[52px]';
    return (
      <div className="mt-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-full flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md mx-2 transition-colors min-h-[36px]',
            'text-muted-foreground hover:bg-muted hover:text-foreground',
            nestedPaddingClass
          )}
          aria-expanded={isExpanded}
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 transition-transform duration-200 text-muted-foreground/70',
              isExpanded && 'rotate-90'
            )}
            aria-hidden="true"
          />
          <span className="flex-1 text-left">{node.label}</span>
        </button>

        {isExpanded && hasChildren && (
          <div className="mt-0.5 space-y-0.5" role="group" aria-label={node.label}>
            {node.children!.map((child) => (
              <SidebarNavItem
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
  const itemPaddingClass = collapsed ? '' : depth === 0 ? 'pl-4' : depth === 1 ? 'pl-7' : depth === 2 ? 'pl-10' : 'pl-[52px]';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={collapsed ? node.label : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 min-h-[44px]',
        collapsed ? 'mx-1 justify-center' : 'mx-2 justify-start',
        itemPaddingClass,
        isActive
          ? 'bg-primary/10 text-primary font-medium shadow-sm ring-1 ring-inset ring-primary/10'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {node.icon && (
        <span
          className={cn(
            'flex-shrink-0',
            isActive ? 'text-primary' : 'text-muted-foreground/70'
          )}
        >
          <Icon name={node.icon} className="h-4 w-4" />
        </span>
      )}

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{node.label}</span>

          {onToggleFavorite && node.moduleKey && (
            <button
              onClick={handleFavoriteClick}
              className={cn(
                'flex-shrink-0 p-0.5 rounded transition-all duration-150 min-h-[28px] min-w-[28px] flex items-center justify-center',
                isFavorite
                  ? 'text-warning-text hover:text-warning-text'
                  : 'text-muted-foreground/70 opacity-0 group-hover:opacity-100 hover:text-warning-text'
              )}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
            >
              <Star
                className="h-3.5 w-3.5"
                fill={isFavorite ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>
          )}
        </>
      )}
    </div>
  );
};
