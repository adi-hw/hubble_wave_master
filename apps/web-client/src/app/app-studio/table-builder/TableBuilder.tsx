import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../../auth/AuthContext';
import { apiGet } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { CollectionProvider, type StudioCollection } from './CollectionContext';
import {
  DEFAULT_TAB,
  TAB_REGISTRY,
  type TabSlug,
  getTabAvailability,
  isValidTab,
} from './tabs/tab-registry';
import { DataTab } from './tabs/DataTab';
import { FormsTab } from './tabs/FormsTab';
import { PoliciesTab } from './tabs/PoliciesTab';
import { FlowsTab } from './tabs/FlowsTab';
import {
  STATUS_PILL_NEUTRAL,
  STATUS_PILL_PENDING,
  STATUS_PILL_SUCCESS,
} from '../../../lib/styling';

const TAB_CONTENT: Record<TabSlug, React.FC> = {
  data: DataTab,
  forms: FormsTab,
  policies: PoliciesTab,
  flows: FlowsTab,
};

const STATUS_TONE: Record<StudioCollection['status'], string> = {
  draft: STATUS_PILL_PENDING,
  published: STATUS_PILL_SUCCESS,
  deprecated: STATUS_PILL_NEUTRAL,
};

/**
 * TableBuilder — Phase 1 Slice A shell that hosts the four-tab
 * Collection editing surface mandated by ADR-13. Slice A wires
 * existing pages as tab content; Slice B (§6.1) replaces the Data
 * tab with the visual TableBuilderCanvas, and later phases swap in
 * the remaining builders.
 *
 * Mounted at /studio/c/:code and /studio/c/:code/:tab — the
 * code-based URL is the canonical Studio entry point per ADR-11.
 */
export const TableBuilder: React.FC = () => {
  const { code, tab } = useParams<{ code: string; tab?: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [collection, setCollection] = useState<StudioCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!code) {
      setError('Missing collection code in URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<StudioCollection>(
        `/collections/by-code/${encodeURIComponent(code)}`,
      );
      setCollection(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to resolve collection';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        <Loader2 size={16} className="mr-2 animate-spin" />
        Resolving Collection "{code}"...
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="mb-2 font-medium">Collection not available</div>
          <p className="mb-3">{error ?? 'Collection could not be loaded.'}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/studio/apps')}
          >
            Back to App Studio
          </Button>
        </div>
      </div>
    );
  }

  if (!tab) {
    return <Navigate to={`/studio/c/${code}/${DEFAULT_TAB}`} replace />;
  }

  if (!isValidTab(tab)) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="mb-2 font-medium">Unknown tab</div>
          <p className="mb-3">
            "{tab}" is not a valid tab. Supported tabs:{' '}
            {TAB_REGISTRY.map((t) => t.slug).join(', ')}.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/studio/c/${code}/${DEFAULT_TAB}`)}
          >
            Open Data tab
          </Button>
        </div>
      </div>
    );
  }

  const ActiveTab = TAB_CONTENT[tab];
  const activeTabDefinition = TAB_REGISTRY.find((t) => t.slug === tab) ?? TAB_REGISTRY[0];
  const activeTabAvailability = getTabAvailability(
    activeTabDefinition,
    collection,
    hasPermission,
  );

  return (
    <CollectionProvider collection={collection} refreshCollection={load}>
      <div className="flex h-full min-h-0 flex-col bg-background">
        <header className="border-b border-border bg-card">
          <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-3 text-sm text-muted-foreground">
              <Link
                to="/studio/apps"
                className="inline-flex shrink-0 items-center gap-1 transition-colors hover:text-foreground"
              >
                <ArrowLeft size={14} />
                App Studio
              </Link>
              <span className="shrink-0 text-muted-foreground/50">/</span>
              <span className="truncate font-medium text-foreground">
                {collection.name}
              </span>
            </div>
            <span
              className={`w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[collection.status]}`}
            >
              {collection.status}
            </span>
          </div>
          <div className="px-4 pt-2 text-xs text-muted-foreground sm:px-6">
            <span className="font-mono">{collection.code}</span>
            {collection.description ? (
              <>
                <span className="mx-2 text-muted-foreground/50">|</span>
                <span>{collection.description}</span>
              </>
            ) : null}
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto px-2 sm:px-4">
            {TAB_REGISTRY.map((definition) => {
              const Icon = definition.icon;
              const availability = getTabAvailability(
                definition,
                collection,
                hasPermission,
              );
              const active = tab === definition.slug;
              const disabled = !availability.available;
              return (
                <button
                  key={definition.slug}
                  type="button"
                  disabled={disabled}
                  title={
                    availability.available ? definition.description : availability.reason
                  }
                  onClick={() => {
                    if (disabled) return;
                    navigate(`/studio/c/${code}/${definition.slug}`);
                  }}
                  className={[
                    'inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors sm:px-4',
                    active
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground',
                    !active && !disabled
                      ? 'hover:border-border hover:text-foreground'
                      : '',
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <Icon size={14} />
                  {definition.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="min-h-0 flex-1 overflow-auto">
          {activeTabAvailability.available ? (
            <ActiveTab />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <div className="mb-2 font-medium text-foreground">
                  {activeTabDefinition.label} unavailable
                </div>
                <p>{activeTabAvailability.reason}</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </CollectionProvider>
  );
};

export default TableBuilder;
