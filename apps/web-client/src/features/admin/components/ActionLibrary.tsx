import React, { useMemo, useState } from 'react';
import {
  CheckCircle,
  Clock,
  FileText,
  GitBranch,
  Globe,
  Hourglass,
  Mail,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Table,
  Trash2,
  Zap,
} from 'lucide-react';
import { BUILT_IN_ACTIONS, type ActionDefinition } from '@hubblewave/shared-types/action-contract';

/**
 * Plan §8.1.3 — searchable, categorized Action Library.
 *
 * Sources its catalog from `BUILT_IN_ACTIONS` in
 * `libs/shared-types/action-contract.ts` so canvas, dispatcher, and
 * library never drift apart. The static `STEP_TYPES` array previously
 * lived inline in `FlowStudio.tsx`; this component supersedes it as
 * the authoritative palette surface.
 *
 * UX:
 *  - Free-text search filters by code, name, and description.
 *  - Categorized sections with collapsible headers (record / control /
 *    notification / approval / decision / integration / ai / flow).
 *  - Each tile shows the action icon, name, AI-callable badge, and
 *    on-hover description.
 *  - Click OR drag-and-drop to add to canvas (delegated to caller via
 *    `onAdd`).
 */
export interface ActionLibraryProps {
  /** Triggered when an action is clicked. */
  onAdd?: (action: ActionDefinition) => void;
  /** Triggered on drag-start so the canvas can drop-handle the action. */
  onDragStart?: (action: ActionDefinition, event: React.DragEvent<HTMLButtonElement>) => void;
  /**
   * Hide actions that don't satisfy the `aiCallable` derived flag.
   * Used by AI-build surfaces where only typed-IO actions are usable.
   */
  aiOnly?: boolean;
}

type Category =
  | 'control'
  | 'record'
  | 'notification'
  | 'approval'
  | 'decision'
  | 'flow'
  | 'integration'
  | 'ai';

const CATEGORY_ORDER: ReadonlyArray<Category> = [
  'control',
  'record',
  'decision',
  'approval',
  'notification',
  'flow',
  'integration',
  'ai',
];

const CATEGORY_META: Record<
  Category,
  { label: string; description: string; icon: React.ComponentType<{ size?: number }> }
> = {
  control: {
    label: 'Control',
    description: 'Start / End / Condition / Wait - flow lifecycle nodes.',
    icon: GitBranch,
  },
  record: {
    label: 'Record',
    description: 'Create / update / delete / look up a Collection record.',
    icon: FileText,
  },
  decision: {
    label: 'Decision',
    description: 'Evaluate a Decision Table to choose a branch.',
    icon: Table,
  },
  approval: {
    label: 'Approval',
    description: 'Author or wait on a record approval task.',
    icon: CheckCircle,
  },
  notification: {
    label: 'Notification',
    description: 'Send email / push / in-app notification through a template.',
    icon: Mail,
  },
  flow: {
    label: 'Flow',
    description: 'Invoke a sub-flow synchronously and inherit its outputs.',
    icon: Zap,
  },
  integration: {
    label: 'Integration',
    description: 'Call an external HTTP endpoint via a registered Connector.',
    icon: Globe,
  },
  ai: {
    label: 'AI',
    description: 'Run an AVA prompt as a deterministic flow step.',
    icon: Sparkles,
  },
};

const ACTION_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  CreateRecord: Plus,
  UpdateRecord: FileText,
  DeleteRecord: Trash2,
  LookUpRecord: Search,
  SetFieldValue: Pencil,
  SendNotification: Mail,
  CreateApproval: CheckCircle,
  WaitForApproval: Hourglass,
  CallFlowModule: Zap,
  HTTPRequest: Globe,
  RunAVAPrompt: Sparkles,
  MakeDecision: Table,
};

const SYNTHETIC_CONTROL_ACTIONS: ActionDefinition[] = [
  {
    code: 'start',
    name: 'Start',
    description: 'Entry node. Every flow has exactly one Start.',
    category: 'flow',
    inputs: [],
    outputs: [],
  },
  {
    code: 'end',
    name: 'End',
    description: 'Terminal node. Marks the flow as completed.',
    category: 'flow',
    inputs: [],
    outputs: [],
  },
  {
    code: 'condition',
    name: 'Condition',
    description: 'Branch on a boolean expression evaluated against context.',
    category: 'flow',
    inputs: [],
    outputs: [],
  },
  {
    code: 'wait',
    name: 'Wait',
    description: 'Pause for a duration before continuing.',
    category: 'flow',
    inputs: [],
    outputs: [],
  },
];

const SYNTHETIC_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  start: Play,
  end: CheckCircle,
  condition: GitBranch,
  wait: Clock,
};

const isAiCallableAction = (definition: ActionDefinition): boolean => {
  // Mirrors `isAiCallable` from the shared contract; recomputed in the
  // UI to avoid bundling the whole helper function for one boolean.
  const allParams = [...definition.inputs, ...definition.outputs];
  if (allParams.length === 0) return false;
  return allParams.every(
    (p) => p.type !== 'json' && (p.type !== 'array' || (p.itemType !== undefined && p.itemType !== 'json')),
  );
};

export const ActionLibrary: React.FC<ActionLibraryProps> = ({ onAdd, onDragStart, aiOnly = false }) => {
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all: Array<{ category: Category; action: ActionDefinition; aiCallable: boolean }> = [];
    for (const c of SYNTHETIC_CONTROL_ACTIONS) {
      all.push({ category: 'control', action: c, aiCallable: false });
    }
    for (const a of BUILT_IN_ACTIONS) {
      all.push({ category: a.category as Category, action: a, aiCallable: isAiCallableAction(a) });
    }
    return all.filter((entry) => {
      if (aiOnly && !entry.aiCallable) return false;
      if (!q) return true;
      const haystack = `${entry.action.code} ${entry.action.name} ${entry.action.description}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, aiOnly]);

  const grouped = useMemo(() => {
    const map = new Map<Category, Array<{ action: ActionDefinition; aiCallable: boolean }>>();
    for (const entry of items) {
      const list = map.get(entry.category) ?? [];
      list.push({ action: entry.action, aiCallable: entry.aiCallable });
      map.set(entry.category, list);
    }
    return map;
  }, [items]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-3 py-2">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions..."
            className="w-full rounded border border-border bg-card py-1.5 pl-7 pr-2 text-sm"
          />
        </div>
        {aiOnly ? (
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            AI-callable subset only - typed primitives, no opaque JSON
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        {items.length === 0 ? (
          <div className="rounded border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            No actions match "{query}". Try a different keyword.
          </div>
        ) : (
          CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => {
            const list = grouped.get(c)!;
            const meta = CATEGORY_META[c];
            return (
              <div key={c} className="mb-3">
                <div className="mb-1 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <meta.icon size={10} />
                  {meta.label}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {list.map(({ action, aiCallable }) => {
                    const Icon =
                      ACTION_ICON[action.code] ?? SYNTHETIC_ICON[action.code] ?? Zap;
                    return (
                      <button
                        key={action.code}
                        type="button"
                        onClick={() => onAdd?.(action)}
                        draggable={!!onDragStart}
                        onDragStart={(e) => onDragStart?.(action, e)}
                        title={action.description}
                        className="group flex items-start gap-2 rounded border border-border bg-card p-2 text-left transition-colors hover:bg-muted"
                      >
                        <Icon size={14} />
                        <div className="flex-1">
                          <div className="text-xs font-medium text-foreground">{action.name}</div>
                          <div className="line-clamp-2 text-[10px] text-muted-foreground">
                            {action.description}
                          </div>
                        </div>
                        {aiCallable ? (
                          <span
                            className="rounded bg-purple-100 px-1 py-0.5 text-[8px] font-bold text-purple-700"
                            title="AI-callable: typed primitives only"
                          >
                            AI
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
