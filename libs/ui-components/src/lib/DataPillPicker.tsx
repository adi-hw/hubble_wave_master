import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Variable } from 'lucide-react';

export type DataPillKind = 'trigger' | 'step' | 'user' | 'system';

export interface DataPill {
  /**
   * Stable token the canvas binds and the engine resolves at
   * execution time. Conventional shape is "{trigger.field}",
   * "{steps.N.output}", "{user.email}", "{system.now}".
   */
  token: string;
  label: string;
  kind: DataPillKind;
  /** Optional pre-formatted preview ("Created at: 2026-04-28..."). */
  preview?: string;
  /** Type hint for typed action validation. */
  type?: 'string' | 'integer' | 'boolean' | 'date' | 'datetime' | 'reference' | 'json';
}

export interface DataPillCategory {
  kind: DataPillKind;
  label: string;
  description?: string;
  pills: DataPill[];
}

interface DataPillPickerProps {
  open: boolean;
  categories: DataPillCategory[];
  onSelect: (pill: DataPill) => void;
  onClose: () => void;
  /** Anchor element for popover positioning. */
  anchorEl?: HTMLElement | null;
}

const KIND_ICON: Record<DataPillKind, string> = {
  trigger: '⚡',
  step: '↑',
  user: '👤',
  system: '⚙',
};

/**
 * Hierarchical variable reference picker. Every Flow Action panel,
 * Form Builder default-value editor, Automation Rule condition
 * builder, and Display Rule condition builder uses this same
 * component so the variable taxonomy stays consistent.
 *
 * The `categories` prop is the registration point — callers
 * compose the available pill set per context (a Flow Action
 * outputs Step pills referencing earlier steps; a Form Builder
 * default-value editor surfaces Trigger + User + System only).
 */
export const DataPillPicker: React.FC<DataPillPickerProps> = ({
  open,
  categories,
  onSelect,
  onClose,
  anchorEl,
}) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<DataPillKind>>(
    () => new Set(categories.map((c) => c.kind)),
  );
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!popoverRef.current) return;
      if (e.target instanceof Node && popoverRef.current.contains(e.target)) return;
      if (anchorEl && e.target instanceof Node && anchorEl.contains(e.target)) return;
      onClose();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, onClose, anchorEl]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        pills: cat.pills.filter(
          (p) =>
            p.label.toLowerCase().includes(q) || p.token.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.pills.length > 0);
  }, [categories, search]);

  const toggleCategory = (kind: DataPillKind) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute z-40 w-80 rounded-lg border border-border bg-card shadow-lg"
      role="dialog"
      aria-label="Data pill picker"
    >
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search
            size={12}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variables…"
            className="w-full rounded border border-border bg-card py-1 pl-7 pr-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-auto p-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No variables match.
          </div>
        ) : (
          filtered.map((cat) => {
            const isExpanded = expanded.has(cat.kind) || !!search;
            return (
              <section key={cat.kind} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.kind)}
                  className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
                >
                  {isExpanded ? (
                    <ChevronDown size={12} aria-hidden />
                  ) : (
                    <ChevronRight size={12} aria-hidden />
                  )}
                  <span>{KIND_ICON[cat.kind]}</span>
                  <span>{cat.label}</span>
                  <span className="ml-auto text-muted-foreground/70">{cat.pills.length}</span>
                </button>
                {isExpanded ? (
                  <ul className="ml-4">
                    {cat.pills.map((pill) => (
                      <li key={pill.token}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(pill);
                            onClose();
                          }}
                          className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-primary/10"
                        >
                          <Variable
                            size={12}
                            className="mt-0.5 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="flex-1">
                            <span className="block text-foreground">{pill.label}</span>
                            <span className="block font-mono text-xs text-muted-foreground">
                              {pill.token}
                            </span>
                            {pill.preview ? (
                              <span className="block text-xs text-muted-foreground/80">
                                {pill.preview}
                              </span>
                            ) : null}
                          </span>
                          {pill.type ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {pill.type}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};

/**
 * Helper that builds the canonical static categories (User + System)
 * any context can include. Trigger and Step pills are
 * context-specific and supplied by the caller.
 */
export const buildBaseCategories = (): DataPillCategory[] => [
  {
    kind: 'user',
    label: 'Current User',
    description: 'Identity and profile fields of the executing user.',
    pills: [
      { token: '{user.id}', label: 'User ID', kind: 'user', type: 'reference' },
      { token: '{user.email}', label: 'Email', kind: 'user', type: 'string' },
      { token: '{user.name}', label: 'Name', kind: 'user', type: 'string' },
      { token: '{user.timezone}', label: 'Timezone', kind: 'user', type: 'string' },
    ],
  },
  {
    kind: 'system',
    label: 'System',
    description: 'Platform-supplied execution-time primitives.',
    pills: [
      { token: '{system.now}', label: 'Now (ISO datetime)', kind: 'system', type: 'datetime' },
      { token: '{system.today}', label: 'Today (ISO date)', kind: 'system', type: 'date' },
      { token: '{system.uuid}', label: 'New UUID', kind: 'system', type: 'string' },
      { token: '{system.environment}', label: 'Environment', kind: 'system', type: 'string' },
    ],
  },
];
