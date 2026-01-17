/**
 * NavigationTree Component
 *
 * Recursive navigation tree renderer with smart group support.
 */

import React from 'react';
import { Star, Clock, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { NavItem } from './NavItem';
import { ResolvedNavigation, ResolvedNavNode } from '../../types/navigation';

interface NavigationTreeProps {
  navigation: ResolvedNavigation;
  collapsed?: boolean;
  showSmartGroups?: boolean;
  onToggleFavorite?: (moduleKey: string) => void;
  onNavigate?: (moduleKey: string) => void;
}

interface SmartGroupSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ResolvedNavNode[];
  collapsed?: boolean;
  defaultExpanded?: boolean;
  onToggleFavorite?: (moduleKey: string) => void;
  onNavigate?: (moduleKey: string) => void;
}

const SmartGroupSection: React.FC<SmartGroupSectionProps> = ({
  title,
  icon,
  items,
  collapsed = false,
  defaultExpanded = true,
  onToggleFavorite,
  onNavigate,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  if (items.length === 0) return null;

  return (
    <div className="mb-4">
      {!collapsed && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors min-h-[44px] text-muted-foreground hover:bg-muted"
          aria-expanded={isExpanded}
          aria-label={`${title} section, ${items.length} items`}
        >
          <span className="flex-shrink-0">{icon}</span>
          <span className="flex-1 text-left truncate">{title}</span>
          <span className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        </button>
      )}

      {(isExpanded || collapsed) && (
        <div className="space-y-0.5 mt-1">
          {items.map((item) => (
            <NavItem
              key={item.key}
              node={item}
              depth={0}
              collapsed={collapsed}
              onToggleFavorite={onToggleFavorite}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const NavigationTree: React.FC<NavigationTreeProps> = ({
  navigation,
  collapsed = false,
  showSmartGroups = true,
  onToggleFavorite,
  onNavigate,
}) => {
  const { nodes, smartGroups } = navigation;

  return (
    <div className="py-2">
      {/* Smart Groups */}
      {showSmartGroups && smartGroups && (
        <>
          {/* Favorites */}
          {smartGroups.favorites?.length > 0 && (
            <SmartGroupSection
              title="Favorites"
              icon={<Star className="h-3 w-3" />}
              items={smartGroups.favorites}
              collapsed={collapsed}
              defaultExpanded={true}
              onToggleFavorite={onToggleFavorite}
              onNavigate={onNavigate}
            />
          )}

          {/* Recent */}
          {smartGroups.recent?.length > 0 && (
            <SmartGroupSection
              title="Recent"
              icon={<Clock className="h-3 w-3" />}
              items={smartGroups.recent}
              collapsed={collapsed}
              defaultExpanded={false}
              onToggleFavorite={onToggleFavorite}
              onNavigate={onNavigate}
            />
          )}

          {/* Frequent */}
          {smartGroups.frequent?.length > 0 && (
            <SmartGroupSection
              title="Frequently Used"
              icon={<TrendingUp className="h-3 w-3" />}
              items={smartGroups.frequent}
              collapsed={collapsed}
              defaultExpanded={false}
              onToggleFavorite={onToggleFavorite}
              onNavigate={onNavigate}
            />
          )}
        </>
      )}

      {/* Main Navigation Tree */}
      <div className="space-y-1">
        {nodes.map((node) => (
          <NavItem
            key={node.key}
            node={node}
            depth={0}
            collapsed={collapsed}
            onToggleFavorite={onToggleFavorite}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
};

export default NavigationTree;
