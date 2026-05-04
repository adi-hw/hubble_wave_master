import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitBranch, ListChecks, Table, Zap } from 'lucide-react';
import { AutomationRuleBuilder } from '../../automation/AutomationRuleBuilder';
import { DecisionTablesPanel } from '../flows/DecisionTablesPanel';
import { GuidedProcessesPanel } from '../flows/GuidedProcessesPanel';
import { ProcessFlowsPanel } from '../flows/ProcessFlowsPanel';

type FlowView = 'flows' | 'automations' | 'decisions' | 'guided';

const SUB_TABS: Array<{
  slug: FlowView;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    slug: 'flows',
    label: 'Process Flows',
    description: 'Visual flows composed of typed Action steps from the platform catalog.',
    icon: GitBranch,
  },
  {
    slug: 'automations',
    label: 'Automation Rules',
    description: 'Synchronous, record-scoped rules that fire on data changes.',
    icon: Zap,
  },
  {
    slug: 'decisions',
    label: 'Decision Tables',
    description: 'Typed decision matrices invoked from flows and AVA prompts.',
    icon: Table,
  },
  {
    slug: 'guided',
    label: 'Guided Processes',
    description: 'Multi-stage playbooks runtime users follow on a record.',
    icon: ListChecks,
  },
];

const isValidView = (value: string | null): value is FlowView =>
  value === 'flows' || value === 'automations' || value === 'decisions' || value === 'guided';

/**
 * Flows tab content. Process Flows (visual designer-backed
 * ProcessFlowDefinition artifacts) is the default view; Automation
 * Rules, Decision Tables, and Guided Processes occupy sibling
 * sub-tabs. Metadata surfaces live here; runtime experiences are
 * wired in their respective downstream phases.
 */
export const FlowsTab: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get('flow');
  const view: FlowView = isValidView(raw) ? raw : 'flows';

  const setView = (next: FlowView) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'flows') nextParams.delete('flow');
    else nextParams.set('flow', next);
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
        {view === 'flows' ? (
          <ProcessFlowsPanel />
        ) : view === 'automations' ? (
          <AutomationRuleBuilder />
        ) : view === 'decisions' ? (
          <DecisionTablesPanel />
        ) : (
          <GuidedProcessesPanel />
        )}
      </div>
    </div>
  );
};
