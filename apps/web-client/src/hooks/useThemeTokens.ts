/**
 * useThemeTokens - Legacy hook for theme tokens
 *
 * NOTE: This hook is deprecated. Use useThemePreference() instead.
 * Kept for backwards compatibility.
 */
import { useThemePreference } from './useThemePreference';

export function useThemeTokens() {
  const { resolved, loading } = useThemePreference();
  return { theme: resolved, loading };
}
