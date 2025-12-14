/**
 * useLabels - Hook for accessing platform labels
 *
 * Provides type-safe access to labels and utilities.
 * Future: Can be extended to support i18n with locale switching.
 */

import { useMemo } from 'react';
import { labels, getEntityLabel, formatLabel, EntityLabel } from '../lib/labels';

export interface UseLabelsReturn {
  /** All labels */
  labels: typeof labels;

  /** Get entity label with optional count for pluralization */
  entity: (name: keyof typeof labels.entities, count?: number) => string;

  /** Get entity labels object */
  getEntity: (name: keyof typeof labels.entities) => EntityLabel;

  /** Format a label with interpolation */
  format: (template: string, values: Record<string, string | number>) => string;

  /** Get action label */
  action: (name: keyof typeof labels.actions) => string;

  /** Get status label */
  status: (name: keyof typeof labels.status) => string;

  /** Get field label */
  field: (name: keyof typeof labels.fields) => string;

  /** Get UI text */
  ui: (name: keyof typeof labels.ui) => string;

  /** Get message */
  message: (name: keyof typeof labels.messages) => string;

  /** Get placeholder */
  placeholder: (name: keyof typeof labels.placeholders) => string;
}

/**
 * Hook for accessing platform labels
 *
 * @example
 * const { labels, entity, action } = useLabels();
 * return (
 *   <Button>{action('create')} {entity('collection')}</Button>
 * );
 */
export function useLabels(): UseLabelsReturn {
  return useMemo(
    () => ({
      labels,

      entity: (name: keyof typeof labels.entities, count?: number) =>
        getEntityLabel(name, count),

      getEntity: (name: keyof typeof labels.entities) => labels.entities[name],

      format: formatLabel,

      action: (name: keyof typeof labels.actions) => labels.actions[name],

      status: (name: keyof typeof labels.status) => labels.status[name],

      field: (name: keyof typeof labels.fields) => labels.fields[name],

      ui: (name: keyof typeof labels.ui) => labels.ui[name],

      message: (name: keyof typeof labels.messages) => labels.messages[name],

      placeholder: (name: keyof typeof labels.placeholders) =>
        labels.placeholders[name],
    }),
    []
  );
}

export default useLabels;
