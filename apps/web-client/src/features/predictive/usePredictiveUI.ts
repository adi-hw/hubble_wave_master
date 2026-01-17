/**
 * usePredictiveUI - Predictive UI Hook
 * HubbleWave Platform - Phase 7
 *
 * Tracks user behavior and provides predictive suggestions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UserAction {
  action: string;
  route: string;
  context: Record<string, unknown>;
  timestamp: number;
}

export interface PredictiveSuggestion {
  id: string;
  type: 'action' | 'navigation' | 'search' | 'report';
  label: string;
  description: string;
  confidence: number;
  icon?: string;
  route?: string;
  action?: () => void;
}

interface UsePredictiveUIOptions {
  userId: string;
  enabled?: boolean;
  maxSuggestions?: number;
  onSuggestionAccepted?: (suggestion: PredictiveSuggestion) => void;
}

interface UsePredictiveUIReturn {
  suggestions: PredictiveSuggestion[];
  isAnalyzing: boolean;
  trackAction: (action: string, context?: Record<string, unknown>) => void;
  acceptSuggestion: (suggestion: PredictiveSuggestion) => void;
  dismissSuggestion: (suggestionId: string) => void;
  clearSuggestions: () => void;
}

const STORAGE_KEY = 'hw_user_behavior';
const MAX_STORED_ACTIONS = 500;

export function usePredictiveUI(options: UsePredictiveUIOptions): UsePredictiveUIReturn {
  const { userId, enabled = true, maxSuggestions = 5, onSuggestionAccepted } = options;

  const [suggestions, setSuggestions] = useState<PredictiveSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const actionsRef = useRef<UserAction[]>([]);

  // Load stored actions on mount
  useEffect(() => {
    if (!enabled) return;

    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
      if (stored) {
        actionsRef.current = JSON.parse(stored);
      }
    } catch {
      console.error('Failed to load behavior data');
    }

    // Start tracking route changes
    const handleRouteChange = () => {
      trackAction('navigation', { route: window.location.pathname });
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, [enabled, userId]);

  // Analyze patterns periodically
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      analyzeAndGenerateSuggestions();
    }, 10000);

    return () => clearInterval(interval);
  }, [enabled]);

  const trackAction = useCallback(
    (action: string, context: Record<string, unknown> = {}) => {
      if (!enabled) return;

      const newAction: UserAction = {
        action,
        route: window.location.pathname,
        context,
        timestamp: Date.now(),
      };

      actionsRef.current.push(newAction);

      // Limit stored actions
      if (actionsRef.current.length > MAX_STORED_ACTIONS) {
        actionsRef.current = actionsRef.current.slice(-MAX_STORED_ACTIONS);
      }

      // Persist to localStorage
      try {
        localStorage.setItem(
          `${STORAGE_KEY}_${userId}`,
          JSON.stringify(actionsRef.current.slice(-200))
        );
      } catch {
        // Storage full or not available
      }

      // Trigger immediate analysis after certain actions
      if (['form_submit', 'record_view', 'navigation'].includes(action)) {
        analyzeAndGenerateSuggestions();
      }
    },
    [enabled, userId]
  );

  const analyzeAndGenerateSuggestions = useCallback(() => {
    setIsAnalyzing(true);

    const actions = actionsRef.current;
    const newSuggestions: PredictiveSuggestion[] = [];
    const currentRoute = window.location.pathname;
    const currentHour = new Date().getHours();

    // Pattern Analysis: Route sequences
    const routeSequences = analyzeRouteSequences(actions);
    const predictedNextRoute = predictNextRoute(currentRoute, routeSequences);

    if (predictedNextRoute) {
      newSuggestions.push({
        id: `nav_${Date.now()}`,
        type: 'navigation',
        label: `Go to ${formatRouteName(predictedNextRoute)}`,
        description: 'Based on your usual workflow',
        confidence: 0.8,
        route: predictedNextRoute,
      });
    }

    // Context-based suggestions
    const contextSuggestions = getContextualSuggestions(currentRoute);
    newSuggestions.push(...contextSuggestions);

    // Time-based suggestions
    const timeSuggestions = getTimeBasedSuggestions(currentHour);
    newSuggestions.push(...timeSuggestions);

    // Action-based suggestions (based on recent activity)
    const recentActions = actions.slice(-10);
    const actionSuggestions = getActionBasedSuggestions(recentActions);
    newSuggestions.push(...actionSuggestions);

    // Sort by confidence and limit
    const sortedSuggestions = newSuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);

    setSuggestions(sortedSuggestions);
    setIsAnalyzing(false);
  }, [maxSuggestions]);

  const acceptSuggestion = useCallback(
    (suggestion: PredictiveSuggestion) => {
      trackAction('suggestion_accepted', {
        suggestionId: suggestion.id,
        type: suggestion.type,
      });

      if (suggestion.action) {
        suggestion.action();
      } else if (suggestion.route) {
        window.location.href = suggestion.route;
      }

      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

      if (onSuggestionAccepted) {
        onSuggestionAccepted(suggestion);
      }
    },
    [trackAction, onSuggestionAccepted]
  );

  const dismissSuggestion = useCallback(
    (suggestionId: string) => {
      trackAction('suggestion_dismissed', { suggestionId });
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    },
    [trackAction]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isAnalyzing,
    trackAction,
    acceptSuggestion,
    dismissSuggestion,
    clearSuggestions,
  };
}

// Helper functions

function analyzeRouteSequences(actions: UserAction[]): Map<string, Map<string, number>> {
  const sequences = new Map<string, Map<string, number>>();

  for (let i = 0; i < actions.length - 1; i++) {
    const current = actions[i].route;
    const next = actions[i + 1].route;

    if (!sequences.has(current)) {
      sequences.set(current, new Map());
    }

    const nextCounts = sequences.get(current)!;
    nextCounts.set(next, (nextCounts.get(next) || 0) + 1);
  }

  return sequences;
}

function predictNextRoute(
  currentRoute: string,
  sequences: Map<string, Map<string, number>>
): string | null {
  const nextCounts = sequences.get(currentRoute);
  if (!nextCounts || nextCounts.size === 0) return null;

  let maxCount = 0;
  let predictedRoute: string | null = null;

  nextCounts.forEach((count, route) => {
    if (count > maxCount && route !== currentRoute) {
      maxCount = count;
      predictedRoute = route;
    }
  });

  return predictedRoute;
}

function formatRouteName(route: string): string {
  const parts = route.split('/').filter(Boolean);
  if (parts.length === 0) return 'Dashboard';

  return parts[0]
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getContextualSuggestions(currentRoute: string): PredictiveSuggestion[] {
  const suggestions: PredictiveSuggestion[] = [];

  if (currentRoute.startsWith('/assets/')) {
    suggestions.push({
      id: `ctx_wo_${Date.now()}`,
      type: 'action',
      label: 'Create Work Order',
      description: 'For this asset',
      confidence: 0.75,
      icon: 'wrench',
    });

    suggestions.push({
      id: `ctx_hist_${Date.now()}`,
      type: 'navigation',
      label: 'View Maintenance History',
      description: 'See past maintenance',
      confidence: 0.7,
      route: `${currentRoute}/history`,
    });
  }

  if (currentRoute.startsWith('/work-orders')) {
    suggestions.push({
      id: `ctx_parts_${Date.now()}`,
      type: 'navigation',
      label: 'Check Parts Inventory',
      description: 'View available parts',
      confidence: 0.65,
      route: '/inventory/parts',
    });
  }

  return suggestions;
}

function getTimeBasedSuggestions(hour: number): PredictiveSuggestion[] {
  const suggestions: PredictiveSuggestion[] = [];

  // Morning (8-10 AM)
  if (hour >= 8 && hour < 10) {
    suggestions.push({
      id: `time_morning_${Date.now()}`,
      type: 'report',
      label: 'Daily Status Report',
      description: 'Your morning check',
      confidence: 0.6,
      route: '/reports/daily-status',
    });
  }

  // End of day (4-6 PM)
  if (hour >= 16 && hour < 18) {
    suggestions.push({
      id: `time_eod_${Date.now()}`,
      type: 'report',
      label: 'End of Day Summary',
      description: "Review today's activities",
      confidence: 0.6,
      route: '/reports/daily-summary',
    });
  }

  // Weekly (Monday morning)
  const now = new Date();
  if (now.getDay() === 1 && hour >= 8 && hour < 12) {
    suggestions.push({
      id: `time_weekly_${Date.now()}`,
      type: 'report',
      label: 'Weekly Planning',
      description: 'Plan your week ahead',
      confidence: 0.55,
      route: '/planning/weekly',
    });
  }

  return suggestions;
}

function getActionBasedSuggestions(recentActions: UserAction[]): PredictiveSuggestion[] {
  const suggestions: PredictiveSuggestion[] = [];

  // Check for repeated searches
  const searches = recentActions.filter((a) => a.action === 'search');
  if (searches.length >= 2) {
    const lastQuery = searches[searches.length - 1]?.context?.query as string | undefined;
    if (lastQuery) {
      suggestions.push({
        id: `action_search_${Date.now()}`,
        type: 'search',
        label: `Continue searching "${lastQuery}"`,
        description: 'Refine your search',
        confidence: 0.5,
        route: `/search?q=${encodeURIComponent(lastQuery)}`,
      });
    }
  }

  // Check for form abandonment
  const formStarts = recentActions.filter((a) => a.action === 'form_start');
  const formSubmits = recentActions.filter((a) => a.action === 'form_submit');

  if (formStarts.length > formSubmits.length) {
    const lastForm = formStarts[formStarts.length - 1];
    suggestions.push({
      id: `action_form_${Date.now()}`,
      type: 'action',
      label: 'Continue Unfinished Form',
      description: 'You started but did not submit',
      confidence: 0.65,
      route: lastForm.route,
    });
  }

  return suggestions;
}

export default usePredictiveUI;
