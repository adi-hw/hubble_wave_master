import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { Icon } from '../Icon';
import { ResolvedNavNode } from '../../types/navigation-v2';

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
  const [isExpanded, setIsExpanded] = useState(node.isExpanded ?? depth < 2);
  const [isHovered, setIsHovered] = useState(false);

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

  // Group header (Top Level)
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
