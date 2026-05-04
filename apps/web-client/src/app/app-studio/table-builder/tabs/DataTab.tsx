import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, FileSpreadsheet } from 'lucide-react';
import { TableBuilderCanvas } from '../data/TableBuilderCanvas';
import { SpreadsheetView } from '../data/SpreadsheetView';
import { useRefreshCollection } from '../CollectionContext';

type DataView = 'schema' | 'records';

interface SubTabDefinition {
  slug: DataView;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const SUB_TABS: SubTabDefinition[] = [
  {
    slug: 'schema',
    label: 'Schema',
    description: 'Properties, types, relationships, and inheritance for this Collection.',
    icon: Database,
  },
  {
    slug: 'records',
    label: 'Records',
    description:
      'Browse the actual records. Read-only by default; entering edit mode emits an audit-log row (ADR-16).',
    icon: FileSpreadsheet,
  },
];

const DEFAULT_VIEW: DataView = 'schema';

const isValidView = (value: string | null): value is DataView =>
  value === 'schema' || value === 'records';

/**
 * Data tab content. Houses two sub-tabs per ADR-16: Schema (the visual
 * TableBuilderCanvas — properties, inheritance, schema preview) and
 * Records (the read-only-by-default spreadsheet over actual records).
 *
 * The active sub-tab is URL-driven via ?view=schema|records so deep
 * links into either surface are stable, and back/forward navigation
 * works as expected.
 */
export const DataTab: React.FC = () => {
  const refresh = useRefreshCollection();
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const view: DataView = isValidView(raw) ? raw : DEFAULT_VIEW;

  const setView = (next: DataView) => {
    const nextParams = new URLSearchParams(params);
    if (next === DEFAULT_VIEW) {
      nextParams.delete('view');
    } else {
      nextParams.set('view', next);
    }
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
        {view === 'schema' ? (
          <TableBuilderCanvas onCollectionChanged={() => void refresh()} />
        ) : (
          <SpreadsheetView />
        )}
      </div>
    </div>
  );
};
