import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  LayoutDashboard,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  WorkspaceDefinition,
  WorkspaceStatus,
  workspacesApi,
} from '../../../services/workspaces';

const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  deprecated: 'Deprecated',
};

const STATUS_TONE: Record<WorkspaceStatus, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  deprecated: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_ICON: Record<
  WorkspaceStatus,
  React.ComponentType<{ className?: string; size?: number }>
> = {
  draft: CircleAlert,
  published: CircleCheck,
  deprecated: CircleSlash,
};

/**
 * Phase 5 §10 list page for Workspaces. Pairs with the per-workspace
 * builder at `/studio/workspaces/:workspaceId`. Workspace creation is
 * scoped to an Application — point users at the Application detail
 * page when no workspaces exist yet.
 */
export const WorkspacesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const list = await workspacesApi.list(undefined, true);
      setWorkspaces(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workspaces';
      setError(message);
      setWorkspaces([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!workspaces) return [];
    const q = search.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(
      (w) =>
        w.code.toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q) ||
        (w.description ?? '').toLowerCase().includes(q),
    );
  }, [workspaces, search]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Studio &gt; Workspaces
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <LayoutDashboard className="h-6 w-6" /> Workspaces
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Workspaces are multi-page authoring surfaces (home / list / record / search /
            analytics / custom) scoped to an Application. Create one from an
            Application's detail page; edit it here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={refreshing}
            aria-label="Refresh workspaces"
          >
            <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive-text"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code, name, or description"
          className="max-w-md"
        />
        {workspaces ? (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {workspaces.length}
          </span>
        ) : null}
      </div>

      {workspaces === null ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title={
            workspaces.length === 0
              ? 'No workspaces yet'
              : 'No workspaces match your search'
          }
          description={
            workspaces.length === 0
              ? 'Open an Application from App Studio and create a workspace there. The builder lives at /studio/workspaces/<id>.'
              : 'Try clearing the search box or refreshing.'
          }
          actionLabel={workspaces.length === 0 ? 'Open App Studio' : undefined}
          onAction={
            workspaces.length === 0 ? () => navigate('/studio/apps') : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((w) => {
            const Icon = STATUS_ICON[w.status];
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/studio/workspaces/${w.id}`)}
                  className="flex w-full items-center gap-4 rounded border border-border bg-card px-4 py-3 text-left transition hover:border-primary"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{w.name}</span>
                      <code className="text-xs text-muted-foreground">{w.code}</code>
                    </div>
                    {w.description ? (
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {w.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[w.status]}`}
                  >
                    <Icon className="h-3 w-3" />
                    {STATUS_LABEL[w.status]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {w.isActive ? 'Active' : 'Inactive'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
