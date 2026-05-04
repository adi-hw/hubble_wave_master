import type { LucideIcon } from 'lucide-react';
import { Database, FileText, Shield, GitBranch } from 'lucide-react';
import type { StudioCollection } from '../CollectionContext';

export type TabSlug = 'data' | 'forms' | 'policies' | 'flows';

export interface TabDefinition {
  slug: TabSlug;
  label: string;
  description: string;
  icon: LucideIcon;
  /**
   * Permission slug that gates this tab. Slice A treats all tabs as
   * admin-gated (consistent with the rest of /studio routes); the slug
   * becomes load-bearing in Slice E when §6.6 ships per-feature
   * permissions and CollectionAccessGuard branches on them.
   */
  permission: string;
}

export const TAB_REGISTRY: TabDefinition[] = [
  {
    slug: 'data',
    label: 'Data',
    description: 'Properties, relationships, and inheritance for this Collection.',
    icon: Database,
    permission: 'metadata.collections.edit',
  },
  {
    slug: 'forms',
    label: 'Forms',
    description: 'Record Form layout - sections, Property order, conditional visibility.',
    icon: FileText,
    permission: 'metadata.forms.edit',
  },
  {
    slug: 'policies',
    label: 'Policies and Rules',
    description: 'Access rules, Display Rules, and Automation Rules scoped to this Collection.',
    icon: Shield,
    permission: 'metadata.policies.edit',
  },
  {
    slug: 'flows',
    label: 'Flows',
    description: 'Process Flows and Automation Rules triggered by records in this Collection.',
    icon: GitBranch,
    permission: 'metadata.flows.edit',
  },
];

export const DEFAULT_TAB: TabSlug = 'data';

export const isValidTab = (value: string | undefined): value is TabSlug =>
  !!value && TAB_REGISTRY.some((t) => t.slug === value);

export type TabAvailability =
  | { available: true }
  | { available: false; reason: string };

/**
 * Decide whether a user may use a given tab for the given Collection.
 *
 * Policy (Slice A defaults — to be revisited by Slice E §6.6):
 *
 * 1. Deprecated Collections are read-only. All tabs report
 *    `available: false` with a "Collection is deprecated" reason. The
 *    shell still mounts the tab content (read-only); the unavailable
 *    flag lets tabs that need write access surface a banner.
 * 2. Permission gating is delegated to `hasPermission`. In Slice A this
 *    is effectively the admin role; Slice E swaps in per-tab slugs.
 * 3. Draft Collections expose every tab. Forms and Policies authored
 *    against a draft schema are perfectly valid — the engine resolves
 *    references at runtime against published revisions only (ADR-5).
 *
 * Why: future-proof signature — the gating function is the single
 * choke point, so adding e.g. "Flows tab requires the Collection to
 * have at least one trigger property" is a one-line change here, not
 * a tab-component edit.
 */
export const getTabAvailability = (
  tab: TabDefinition,
  collection: StudioCollection,
  hasPermission: (slug: string) => boolean,
): TabAvailability => {
  if (collection.status === 'deprecated') {
    return {
      available: false,
      reason: 'This Collection is deprecated. Restore it to make changes.',
    };
  }
  if (!hasPermission(tab.permission)) {
    return {
      available: false,
      reason: `Requires the ${tab.permission} permission.`,
    };
  }
  return { available: true };
};
