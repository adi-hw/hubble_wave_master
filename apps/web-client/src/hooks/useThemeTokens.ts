/**
 * useThemeTokens - Theme token accessor hook
 *
 * Provides access to resolved theme tokens. Delegates to useThemePreference.
 */
import { useThemePreference } from './useThemePreference';

export function useThemeTokens() {
  const { resolved, loading } = useThemePreference();
  return { theme: resolved, loading };
}
