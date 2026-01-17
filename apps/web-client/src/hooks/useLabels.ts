/**
 * useLabels - Hook for accessing platform labels
 *
 * Provides type-safe access to labels and utilities.
 * Future: Can be extended to support i18n with locale switching.
 */

import { useMemo } from 'react';
import { labels, formatLabel, EntityLabel } from '../lib/labels';
import { useLocalization } from '../contexts/LocalizationContext';

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
  const { translate } = useLocalization();

  return useMemo(
    () => ({
      labels,

      entity: (name: keyof typeof labels.entities, count?: number) => {
        const usePlural = count !== undefined && count !== 1;
        const key = `${String(name)}.${usePlural ? 'plural' : 'singular'}`;
        const fallback = usePlural ? labels.entities[name].plural : labels.entities[name].singular;
        return translate('labels.entities', key, fallback);
      },

      getEntity: (name: keyof typeof labels.entities) => labels.entities[name],

      format: formatLabel,

      action: (name: keyof typeof labels.actions) =>
        translate('labels.actions', String(name), labels.actions[name]),

      status: (name: keyof typeof labels.status) =>
        translate('labels.status', String(name), labels.status[name]),

      field: (name: keyof typeof labels.fields) =>
        translate('labels.fields', String(name), labels.fields[name]),

      ui: (name: keyof typeof labels.ui) =>
        translate('labels.ui', String(name), labels.ui[name]),

      message: (name: keyof typeof labels.messages) =>
        translate('labels.messages', String(name), labels.messages[name]),

      placeholder: (name: keyof typeof labels.placeholders) =>
        translate('labels.placeholders', String(name), labels.placeholders[name]),
    }),
    [translate]
  );
}

export default useLabels;
