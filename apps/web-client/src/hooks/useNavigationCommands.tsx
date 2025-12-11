/**
 * useNavigationCommands Hook
 *
 * Generates command palette commands from the V2 navigation system.
 * Converts navigation nodes to searchable command items.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { CircleDot } from 'lucide-react';
import { useNavigationV2 } from './useNavigationV2';
import { CommandItem, CommandGroup } from '../components/ui/CommandPalette';
import { ResolvedNavNode } from '../types/navigation-v2';

// Dynamic icon component resolver
const getIconComponent = (iconName?: string): React.ReactNode => {
  if (!iconName) return null;

  // Capitalize first letter and handle kebab-case
  const normalizedName = iconName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const IconComponent = (LucideIcons as unknown as Record<string, React.FC<{ className?: string }>>)[
    normalizedName
  ];

  if (IconComponent) {
    return <IconComponent className="h-4 w-4" />;
  }

  // Fallback to CircleDot icon
  return <CircleDot className="h-4 w-4" />;
};

/**
 * Flatten navigation tree to command items
 */
const flattenNavToCommands = (
  nodes: ResolvedNavNode[],
  navigate: (path: string) => void,
  parentPath: string[] = []
): CommandItem[] => {
  const commands: CommandItem[] = [];

  for (const node of nodes) {
    const currentPath = [...parentPath, node.label];

    // Add navigable nodes as commands
    if (node.type === 'module' || node.type === 'link') {
      const route = node.route || node.url;
      if (route) {
        commands.push({
          id: `nav-${node.key}`,
          label: `Go to ${node.label}`,
          description: currentPath.length > 1 ? currentPath.slice(0, -1).join(' > ') : undefined,
          icon: getIconComponent(node.icon),
          category: 'Navigation',
          keywords: [
            node.label.toLowerCase(),
            node.key,
            ...(node.moduleKey ? [node.moduleKey] : []),
          ],
          action: () => {
            if (node.url?.startsWith('http')) {
              window.open(node.url, '_blank');
            } else {
              navigate(route);
            }
          },
        });
      }
    }

    // Recursively process children
    if (node.children && node.children.length > 0) {
      commands.push(...flattenNavToCommands(node.children, navigate, currentPath));
    }

    // Process smart group items
    if (node.smartGroupItems && node.smartGroupItems.length > 0) {
      commands.push(...flattenNavToCommands(node.smartGroupItems, navigate, currentPath));
    }
  }

  return commands;
};

/**
 * Hook to generate command palette commands from navigation
 */
export function useNavigationCommands(): {
  navigationCommands: CommandItem[];
  navigationGroups: CommandGroup[];
  recentCommands: CommandItem[];
  favoriteCommands: CommandItem[];
  isLoading: boolean;
} {
  const { nav, loading } = useNavigationV2();
  const navigate = useNavigate();

  const navigationCommands = useMemo(() => {
    if (!nav?.nodes) return [];
    return flattenNavToCommands(nav.nodes, navigate);
  }, [nav?.nodes, navigate]);

  // Group commands by their location in the nav tree
  const navigationGroups = useMemo(() => {
    if (!nav?.nodes) return [];

    const groups: CommandGroup[] = [];

    for (const node of nav.nodes) {
      if (node.type === 'group' && node.children && node.children.length > 0) {
        const groupCommands = flattenNavToCommands(node.children, navigate, [node.label]);
        if (groupCommands.length > 0) {
          groups.push({
            id: `group-${node.key}`,
            label: node.label,
            commands: groupCommands,
          });
        }
      }
    }

    return groups;
  }, [nav?.nodes, navigate]);

  // Recent module commands
  const recentCommands = useMemo(() => {
    if (!nav?.recentModules) return [];

    return nav.recentModules.slice(0, 5).map((module) => ({
      id: `recent-${module.key}`,
      label: `Go to ${module.label}`,
      description: 'Recently accessed',
      icon: getIconComponent(module.icon),
      category: 'Recent',
      keywords: [module.label.toLowerCase(), module.key],
      action: () => {
        if (module.route) {
          navigate(module.route);
        }
      },
    }));
  }, [nav?.recentModules, navigate]);

  // Favorite module commands
  const favoriteCommands = useMemo(() => {
    if (!nav?.favorites || !nav?.nodes) return [];

    // Find modules that match favorites
    const allModules = flattenNavToCommands(nav.nodes, navigate);
    return allModules.filter((cmd) => {
      const moduleKey = cmd.keywords?.find((k) => nav.favorites?.includes(k));
      return !!moduleKey;
    });
  }, [nav?.favorites, nav?.nodes, navigate]);

  return {
    navigationCommands,
    navigationGroups,
    recentCommands,
    favoriteCommands,
    isLoading: loading,
  };
}

export default useNavigationCommands;
