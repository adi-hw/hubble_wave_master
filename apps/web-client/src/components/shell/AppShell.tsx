/**
 * AppShell - Application Shell
 *
 * A modern application shell with:
 * - CSS Grid-based layout (sidebar, header, content)
 * - Dynamic navigation based on permissions
 * - Command palette (⌘K)
 * - AVA chat panel (⌘J)
 * - Notification center
 * - Breadcrumb navigation
 * - Responsive design (mobile bottom nav)
 * - Glassmorphic styling
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MotionProvider } from '@hubblewave/ui';
import { NavigationProvider, useNavigation } from '../../contexts/NavigationContext';
import { ThemeProvider } from '../layout/ThemeProvider';
import { UserPreferencesProvider, useUserPreferences } from '../../contexts/UserPreferencesContext';
import { LocalizationProvider } from '../../contexts/LocalizationContext';
import { SidebarFlyout } from '../layout/SidebarFlyout';
import { BottomNavBar } from '../layout/BottomNavBar';
import { AppHeader } from './AppHeader';
import { CommandPalette } from './CommandPalette';
import { AvaPanel } from './AvaPanel';
import { AvaChrome } from '@hubblewave/ui';
import { Breadcrumbs } from './Breadcrumbs';
import { ErrorBoundary } from './ErrorBoundary';
import { NavItem, NavSection } from '../../types/navigation';
import { cn } from '../../lib/utils';
import { useShellState } from '../../hooks/useShellState';

interface AppShellProps {
  children?: React.ReactNode;
}

/**
 * Convert navigation to BottomNavBar format
 */
const convertToBottomNav = (
  navigation: ReturnType<typeof useNavigation>['navigation']
): NavItem[] => {
  const fallback: NavItem[] = [
    { code: 'home', label: 'Home', icon: 'Home', path: '/' },
    { code: 'work', label: 'Work', icon: 'ListTodo', path: '/work' },
    { code: 'search', label: 'Search', icon: 'Search', path: '/search' },
    { code: 'ava', label: 'AVA', icon: 'Sparkles', path: '/assistant' },
    { code: 'profile', label: 'Profile', icon: 'User', path: '/settings/profile' },
  ];

  if (!navigation) return fallback;

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

  // Merge fallback (ensuring key presence and mobile actions) with discovered routes
  const merged: Record<string, NavItem> = {};
  fallback.forEach((item) => {
    merged[item.code] = item;
  });
  items.forEach((item) => {
    if (!merged[item.code]) {
      merged[item.code] = item;
    } else {
      merged[item.code] = { ...merged[item.code], path: item.path ?? merged[item.code].path };
    }
  });

  return Object.values(merged).slice(0, 5);
};

/**
 * Convert navigation to sections format
 */
const convertToSections = (
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
 * Inner shell component with all features
 */
const AppShellInner: React.FC<AppShellProps> = ({ children }) => {
  const { navigation, loading } = useNavigation();
  const location = useLocation();
  const { preferences } = useUserPreferences();

  // UI State from preferences
  const {
    sidebarCollapsed,
    toggleSidebar,
    sidebarPosition,
    mobileSidebarOpen,
    openMobileSidebar,
    closeMobileSidebar,
  } = useShellState();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [avaPanelOpen, setAvaPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Preference-based display settings
  const showBreadcrumbs = preferences?.showBreadcrumbs ?? true;
  const showFooter = preferences?.showFooter ?? true;
  const contentWidth = preferences?.contentWidth ?? 'full';

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        setAvaPanelOpen(false);
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeElement = document.activeElement;
        const isInput =
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.getAttribute('contenteditable') === 'true';
        if (!isInput) {
          e.preventDefault();
          setCommandPaletteOpen(true);
          setAvaPanelOpen(false);
        }
      }

      // AVA Panel: ⌘J / Ctrl+J
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setAvaPanelOpen((prev) => !prev);
        setCommandPaletteOpen(false);
      }

      // Close panels on Escape
      if (e.key === 'Escape') {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (avaPanelOpen) {
          setAvaPanelOpen(false);
        }
      }

      // Toggle sidebar: [ key
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeElement = document.activeElement;
        const isInput = activeElement?.tagName === 'INPUT' ||
                       activeElement?.tagName === 'TEXTAREA' ||
                       activeElement?.getAttribute('contenteditable') === 'true';
        if (!isInput) {
          toggleSidebar();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, avaPanelOpen, toggleSidebar]);

  // Auto-collapse sidebar on tablet - use ref to avoid stale closure
  const sidebarCollapsedRef = useRef(sidebarCollapsed);
  sidebarCollapsedRef.current = sidebarCollapsed;

  const handleTabletResize = useCallback(() => {
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    if (isTablet && !sidebarCollapsedRef.current) {
      toggleSidebar();
    }
  }, [toggleSidebar]);

  useEffect(() => {
    handleTabletResize();
    window.addEventListener('resize', handleTabletResize);
    return () => window.removeEventListener('resize', handleTabletResize);
  }, [handleTabletResize]);

  // Convert navigation for mobile components
  const bottomNavItems = useMemo(() => convertToBottomNav(navigation), [navigation]);
  const navSections = useMemo(() => convertToSections(navigation), [navigation]);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (mobileSidebarOpen) {
      closeMobileSidebar();
    }
  }, [location.pathname, mobileSidebarOpen, closeMobileSidebar]);

  // Context for AVA
  const avaContext = useMemo(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);

    return {
      page: segments[0] || 'Home',
      recordType: segments.length > 1 ? segments[0] : undefined,
      recordId: segments.length > 2 ? segments[2] : undefined,
    };
  }, [location.pathname]);

  // Loading state
  if (loading && !navigation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-card">
        <div className="relative">
          <div className="absolute inset-0 opacity-20 blur-xl rounded-full bg-primary" />
          <Loader2 className="h-8 w-8 animate-spin mb-4 relative z-10 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          Loading workspace...
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell h-screen relative overflow-hidden bg-card">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 z-[var(--z-header)]"
      >
        Skip to main content
      </a>
      {/* Ambient Background Effects - 2070 Generation Aesthetic */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Primary gradient orb - top right */}
        <div
          className="absolute -top-[20%] -right-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-primary opacity-[0.08] blur-[80px]"
        />
        {/* Accent gradient orb - bottom left */}
        <div
          className="absolute -bottom-[20%] -left-[10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-accent opacity-[0.06] blur-[80px]"
        />
        {/* Subtle noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%270%200%20256%20256%27%20xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter%20id=%27noise%27%3E%3CfeTurbulence%20type=%27fractalNoise%27%20baseFrequency=%270.9%27%20numOctaves=%274%27%20stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20filter=%27url(%23noise)%27/%3E%3C/svg%3E')]"
        />
      </div>

      {/* Header - Glass Surface (Fixed) */}
      <AppHeader
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenAva={() => setAvaPanelOpen(true)}
        onToggleSidebar={() => (isMobile ? openMobileSidebar() : toggleSidebar())}
        sidebarCollapsed={sidebarCollapsed}
      />

      {/* Main Layout - Flexbox based */}
      <div
        className={cn(
          'flex h-[calc(100vh-var(--header-height,64px))] relative z-10 mt-[var(--header-height,64px)]',
          sidebarPosition === 'right' && 'flex-row-reverse'
        )}
      >
        {/* Sidebar - Hidden on mobile */}
        {!isMobile && (
          <SidebarFlyout
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={closeMobileSidebar}
          />
        )}

        {/* Mobile Sidebar Overlay */}
        {isMobile && mobileSidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-overlay/50 z-40"
              onClick={closeMobileSidebar}
            />
            <div className="fixed left-0 top-0 h-full z-50">
              <SidebarFlyout
                collapsed={false}
                onToggle={toggleSidebar}
                mobileOpen={mobileSidebarOpen}
                onMobileClose={closeMobileSidebar}
              />
            </div>
          </>
        )}

        {/* Main Content Area */}
        <main
          id="main-content"
          className={cn(
            'flex-1 min-w-0 overflow-auto flex flex-col',
            'transition-all duration-300 ease-out',
            isMobile && 'pb-[var(--bottom-nav-height,56px)]'
          )}
        >
          {/* Content Container */}
          <div
            className={cn(
              'flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6',
              contentWidth === 'narrow' && 'max-w-4xl mx-auto w-full',
              contentWidth === 'wide' && 'max-w-7xl mx-auto w-full'
            )}
          >
            {/* Breadcrumbs - conditionally rendered */}
            {showBreadcrumbs && (
              <div className="mb-6">
                <Breadcrumbs />
              </div>
            )}

            {/* Page Content with fade-in animation */}
            {/* Page Content with fade-in animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full"
              >
                {children || <Outlet />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer - conditionally rendered */}
          {showFooter && !isMobile && (
            <footer className="shrink-0 px-6 py-4 text-center text-xs border-t border-border text-muted-foreground bg-muted">
              <div className="flex items-center justify-center gap-4">
                <span>&copy; {new Date().getFullYear()} HubbleWave</span>
                <span className="opacity-50">|</span>
                <span>Envision at your own ease</span>
              </div>
            </footer>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNavBar
        bottomNav={bottomNavItems}
        sections={navSections}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        onOpenAva={() => setAvaPanelOpen(true)}
      />

      {/* Command Palette Overlay */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenAva={() => {
          setCommandPaletteOpen(false);
          setAvaPanelOpen(true);
        }}
      />

      {/* AVA Panel */}
      <AvaPanel
        open={avaPanelOpen}
        onClose={() => setAvaPanelOpen(false)}
        context={avaContext}
      />

      {/* AVA Chrome Floating Action Button */}
      <AvaChrome 
        onClick={() => setAvaPanelOpen(true)} 
        isOpen={avaPanelOpen} 
      />
    </div>
  );
};

/**
 * Main AppShell component with providers and error boundary
 */
export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to console in development, could send to error service in production
        console.error('AppShell Error:', error);
        console.error('Component Stack:', errorInfo.componentStack);
      }}
    >
      <ThemeProvider>
        <UserPreferencesProvider>
          <LocalizationProvider>
            <NavigationProvider>
              <MotionProvider>
                <AppShellInner>{children}</AppShellInner>
              </MotionProvider>
            </NavigationProvider>
          </LocalizationProvider>
        </UserPreferencesProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default AppShell;
