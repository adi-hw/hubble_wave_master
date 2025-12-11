/**
 * NavItem Component
 *
 * Single navigation item (link, folder, separator).
 * Supports favorites, badges, and expansion state.
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { Icon } from '../Icon';
import { ResolvedNavNode } from '../../types/navigation-v2';

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
  const [isExpanded, setIsExpanded] = useState(node.isExpanded ?? depth === 0);
  const [showFavorite, setShowFavorite] = useState(false);

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

  // Render separator
  if (isSeparator) {
    return (
      <div
        className="my-2 mx-3 border-t"
        style={{ borderColor: 'var(--hw-border, #e2e8f0)' }}
      />
    );
  }

  // Render group header (when collapsed, show as icon only)
  if (isGroup && !hasChildren) {
    return null; // Empty groups are hidden
  }

  // Calculate indentation
  const paddingLeft = collapsed ? 12 : 12 + depth * 12;

  // Group header style
  if (isGroup) {
    return (
      <div className="mt-4 first:mt-0">
        {!collapsed && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-slate-50"
            style={{
              color: 'var(--hw-text-muted, #94a3b8)',
              paddingLeft,
            }}
          >
            {hasChildren && (
              <span className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
            )}
            <span className="truncate">{node.label}</span>
            {node.badge && (
              <span
                className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded-full"
                style={{
                  backgroundColor: 'var(--hw-primary, #0ea5e9)',
                  color: 'white',
                }}
              >
                {node.badge}
              </span>
            )}
          </button>
        )}

        {/* Children */}
        {(isExpanded || collapsed) && hasChildren && (
          <div className={collapsed ? 'space-y-1 mt-1' : 'space-y-0.5 mt-1'}>
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

  // Regular nav item - use div to avoid nested button issue with favorite star
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
      onMouseEnter={() => setShowFavorite(true)}
      onMouseLeave={() => setShowFavorite(false)}
      title={collapsed ? node.label : undefined}
      className={`
        w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 cursor-pointer
        ${isActive
          ? 'bg-primary-50 text-primary-700 shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
      style={{
        paddingLeft: collapsed ? undefined : paddingLeft,
      }}
    >
      {/* Icon */}
      {node.icon && (
        <span
          className={`flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-slate-400'}`}
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
            <span
              className="px-1.5 py-0.5 text-[10px] font-medium rounded-full"
              style={{
                backgroundColor: 'var(--hw-primary, #0ea5e9)',
                color: 'white',
              }}
            >
              {node.badge}
            </span>
          )}

          {/* Favorite star */}
          {onToggleFavorite && node.moduleKey && (showFavorite || node.isFavorite) && (
            <button
              onClick={handleFavoriteClick}
              className={`
                flex-shrink-0 p-0.5 rounded transition-colors
                ${node.isFavorite
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-slate-400'
                }
              `}
            >
              <Star
                className="h-4 w-4"
                fill={node.isFavorite ? 'currentColor' : 'none'}
              />
            </button>
          )}

          {/* Expand/collapse for items with children */}
          {hasChildren && (
            <span className="flex-shrink-0 text-slate-400">
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
