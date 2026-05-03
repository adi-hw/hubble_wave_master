import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AppWindow,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Application,
  ApplicationStatus,
  applicationsApi,
} from '../../../lib/applications';
import { CreateApplicationDialog } from './CreateApplicationDialog';

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  deprecated: 'Deprecated',
};

const STATUS_TONE: Record<ApplicationStatus, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  deprecated: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_ICON: Record<
  ApplicationStatus,
  React.ComponentType<{ className?: string; size?: number }>
> = {
  draft: CircleAlert,
  published: CircleCheck,
  deprecated: CircleSlash,
};

export const AppStudioHome: React.FC = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const list = await applicationsApi.list();
      setApplications(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load applications';
      setError(message);
      setApplications([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!applications) return [];
    const q = search.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q),
    );
  }, [applications, search]);

  const onCreated = useCallback(
    (created: Application) => {
      setCreateOpen(false);
      void load();
      navigate(`/studio/apps/${created.id}`);
    },
    [load, navigate],
  );

  return (
    <div className="min-h-full bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/studio" className="hover:underline">
                Studio
              </Link>
              <ChevronRight size={14} />
              <span>Applications</span>
            </div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <AppWindow className="text-primary" size={24} />
              App Studio
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Applications are the unit of metadata grouping inside this instance.
              Each Collection, Form, Process Flow, and Workspace lives under exactly one
              Application.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={refreshing}
              aria-label="Refresh applications"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              New Application
            </Button>
          </div>
        </header>

        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              placeholder="Search by code, name, or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Filter applications"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {applications == null
              ? 'Loading…'
              : `${filtered.length} of ${applications.length}`}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {applications == null ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={AppWindow}
            title={search ? 'No matching applications' : 'No applications yet'}
            description={
              search
                ? 'Try a different search term, or clear the filter.'
                : 'Create your first Application to start grouping Collections, Forms, and Process Flows.'
            }
            actionLabel={search ? undefined : 'Create Application'}
            onAction={search ? undefined : () => setCreateOpen(true)}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map((app) => {
              const StatusIcon = STATUS_ICON[app.status];
              return (
                <li key={app.id}>
                  <Link
                    to={`/studio/apps/${app.id}`}
                    className="group flex h-full flex-col rounded-lg border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-base font-semibold text-foreground">
                            {app.name}
                          </h2>
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {app.code}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[app.status]}`}
                      >
                        <StatusIcon size={12} />
                        {STATUS_LABEL[app.status]}
                      </span>
                    </div>
                    {app.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {app.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
                      <span>
                        Source:{' '}
                        <span className="font-mono">{app.source}</span>
                      </span>
                      <span className="opacity-0 transition group-hover:opacity-100">
                        Open →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CreateApplicationDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreated}
        existingCodes={(applications ?? []).map((a) => a.code)}
      />
    </div>
  );
};

export default AppStudioHome;
