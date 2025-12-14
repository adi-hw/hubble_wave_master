/**
 * useBreakpoint - Responsive Breakpoint Hooks
 *
 * Provides hooks for responsive design matching Tailwind CSS breakpoints.
 * Uses matchMedia for efficient, reactive breakpoint detection.
 */

import { useState, useEffect, useMemo } from 'react';

/**
 * Tailwind CSS default breakpoints
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * Get the current breakpoint based on window width
 */
function getCurrentBreakpoint(width: number): Breakpoint | 'xs' {
  if (width >= breakpoints['2xl']) return '2xl';
  if (width >= breakpoints.xl) return 'xl';
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  if (width >= breakpoints.sm) return 'sm';
  return 'xs';
}

/**
 * Hook to detect if viewport matches a media query
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

/**
 * Hook to check if viewport is at or above a breakpoint
 * @example const isDesktop = useBreakpoint('lg'); // true if >= 1024px
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const minWidth = breakpoints[breakpoint];
  return useMediaQuery(`(min-width: ${minWidth}px)`);
}

/**
 * Hook to check if viewport is below a breakpoint
 * @example const isMobile = useBreakpointDown('md'); // true if < 768px
 */
export function useBreakpointDown(breakpoint: Breakpoint): boolean {
  const minWidth = breakpoints[breakpoint];
  return useMediaQuery(`(max-width: ${minWidth - 1}px)`);
}

/**
 * Hook to check if viewport is between two breakpoints
 * @example const isTablet = useBreakpointBetween('md', 'lg'); // true if 768px-1023px
 */
export function useBreakpointBetween(min: Breakpoint, max: Breakpoint): boolean {
  const minWidth = breakpoints[min];
  const maxWidth = breakpoints[max];
  return useMediaQuery(`(min-width: ${minWidth}px) and (max-width: ${maxWidth - 1}px)`);
}

/**
 * Hook to get the current breakpoint name
 * @returns Current breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 */
export function useCurrentBreakpoint(): Breakpoint | 'xs' {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint | 'xs'>(() => {
    if (typeof window === 'undefined') return 'md';
    return getCurrentBreakpoint(window.innerWidth);
  });

  useEffect(() => {
    const handleResize = () => {
      setCurrentBreakpoint(getCurrentBreakpoint(window.innerWidth));
    };

    // Debounced resize handler
    let timeoutId: number;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return currentBreakpoint;
}

/**
 * Hook to get window dimensions
 */
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Debounced resize handler
    let timeoutId: number;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return size;
}

/**
 * Convenience hooks for common breakpoints
 */
export function useIsMobile(): boolean {
  return useBreakpointDown('md'); // < 768px
}

export function useIsTablet(): boolean {
  return useBreakpointBetween('md', 'lg'); // 768px - 1023px
}

export function useIsDesktop(): boolean {
  return useBreakpoint('lg'); // >= 1024px
}

export function useIsLargeDesktop(): boolean {
  return useBreakpoint('xl'); // >= 1280px
}

/**
 * Hook to conditionally render based on breakpoint
 * Returns an object with boolean flags for common device types
 */
export function useResponsive() {
  const currentBreakpoint = useCurrentBreakpoint();

  return useMemo(
    () => ({
      breakpoint: currentBreakpoint,
      isMobile: currentBreakpoint === 'xs' || currentBreakpoint === 'sm',
      isTablet: currentBreakpoint === 'md',
      isDesktop: currentBreakpoint === 'lg' || currentBreakpoint === 'xl' || currentBreakpoint === '2xl',
      isSmallScreen: currentBreakpoint === 'xs' || currentBreakpoint === 'sm' || currentBreakpoint === 'md',
      isLargeScreen: currentBreakpoint === 'lg' || currentBreakpoint === 'xl' || currentBreakpoint === '2xl',
    }),
    [currentBreakpoint]
  );
}

export default useBreakpoint;
