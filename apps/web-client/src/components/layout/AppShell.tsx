/**
 * AppShell - Main Application Shell
 *
 * Uses the new Navigation V2 system with template-based navigation,
 * smart groups (favorites, recent), and role-based visibility.
 */

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { NavigationProvider, useNavigation } from '../../contexts/NavigationContext';
import { SidebarFlyoutV2 } from './SidebarFlyoutV2';
import { BottomNavBar } from './BottomNavBar';
import { ThemeProvider } from './ThemeProvider';
import { AppHeader } from '../../layout/AppHeader';
import { Loader2 } from 'lucide-react';
import { NavItem, NavSection } from '../../types/navigation';

/**
 * Convert V2 navigation to legacy BottomNavBar format
 */
const convertToLegacyBottomNav = (
  navigation: ReturnType<typeof useNavigation>['navigation']
): NavItem[] => {
  if (!navigation) return [];

  const items: NavItem[] = [];

  for (const node of navigation.nodes) {
    if (node.type === 'module' && node.route) {
      items.push({
        code: node.key,
        label: node.label,
        icon: node.icon ?? 'Circle',
        path: node.route,
      });
    }
    if (node.type === 'group' && node.children) {
      for (const child of node.children.slice(0, 2)) {
        if (child.type === 'module' && child.route) {
          items.push({
            code: child.key,
            label: child.label,
            icon: child.icon ?? 'Circle',
            path: child.route,
          });
        }
      }
    }
  }

  return items.slice(0, 5);
};

/**
 * Convert V2 navigation to legacy sections format
 */
const convertToLegacySections = (
  navigation: ReturnType<typeof useNavigation>['navigation']
): NavSection[] => {
  if (!navigation) return [];

  return navigation.nodes
    .filter((node) => node.type === 'group' && node.children?.length)
    .map((node) => ({
      name: node.label,
      items: (node.children ?? [])
        .filter((child) => child.type === 'module')
        .map((child) => ({
          code: child.key,
          label: child.label,
          icon: child.icon ?? 'Circle',
          path: child.route,
        })),
    }));
};

/**
 * Inner shell component that uses navigation context
 */
const AppShellInner: React.FC = () => {
  const { navigation, loading } = useNavigation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (loading && !navigation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin mb-4" />
        <p className="text-sm text-slate-500">Loading workspace...</p>
      </div>
    );
  }

  // Convert for legacy BottomNavBar component
  const legacyBottomNav = convertToLegacyBottomNav(navigation);
  const legacySections = convertToLegacySections(navigation);

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader />

      <div className="flex min-h-screen pt-14">
        <SidebarFlyoutV2
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />

        <main className="flex-1 min-h-[calc(100vh-3.5rem)] overflow-auto bg-slate-50">
          <div className="h-full">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNavBar bottomNav={legacyBottomNav} sections={legacySections} />
    </div>
  );
};

/**
 * Main AppShell component that provides navigation context
 */
export const AppShell: React.FC = () => {
  return (
    <ThemeProvider>
      <NavigationProvider>
        <AppShellInner />
      </NavigationProvider>
    </ThemeProvider>
  );
};
