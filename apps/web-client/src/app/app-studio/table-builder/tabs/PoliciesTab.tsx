import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, ScrollText, Zap } from 'lucide-react';
import { AccessRulesPage } from '../../../../features/admin';
import { DisplayRulesPanel } from '../policies/DisplayRulesPanel';
import { AutomationRuleBuilder } from '../../automation/AutomationRuleBuilder';

type PolicyView = 'access' | 'display' | 'automation';

const SUB_TABS: Array<{
  slug: PolicyView;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    slug: 'access',
    label: 'Access Rules',
    description: 'Row-level RBAC/ABAC rules controlling who can see and edit records.',
    icon: Lock,
  },
  {
    slug: 'display',
    label: 'Display Rules',
    description:
      'Conditional show / hide / mandatory / readonly / setValue actions applied at form runtime.',
    icon: ScrollText,
  },
  {
    slug: 'automation',
    label: 'Automation Rules',
    description: 'Server-side rules that enforce invariants and trigger actions on record events.',
    icon: Zap,
  },
];

const isValidView = (value: string | null): value is PolicyView =>
  value === 'access' || value === 'display' || value === 'automation';

/**
 * Policies and Rules tab content. Hosts two sub-tabs:
 *   - Access Rules (row-level RBAC/ABAC) — the original Slice A
 *     content, unchanged.
 *   - Display Rules (Phase 2 §7.3) — conditional form-time policies.
 *
 * Phase 4 will add Automation Rules as a third sub-tab; the SUB_TABS
 * list is the single registration point for additions.
 */
export const PoliciesTab: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get('policy');
  const view: PolicyView = isValidView(raw) ? raw : 'access';

  const setView = (next: PolicyView) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'access') nextParams.delete('policy');
    else nextParams.set('policy', next);
    setParams(nextParams, { replace: true });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2 sm:px-4">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.slug;
          return (
            <button
              key={tab.slug}
              type="button"
              onClick={() => setView(tab.slug)}
              title={tab.description}
              className={[
                'inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              ].join(' ')}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'access' ? (
          <AccessRulesPage />
        ) : view === 'display' ? (
          <DisplayRulesPanel />
        ) : (
          <AutomationRuleBuilder />
        )}
      </div>
    </div>
  );
};
