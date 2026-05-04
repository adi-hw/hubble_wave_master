import React, { useEffect, useState } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PanelShell, PanelPlaceholder } from './PanelShell';
import {
  listDashboards,
  type DashboardDefinition,
} from '../../../services/insights.service';

interface Props {
  config: Record<string, unknown>;
}

/**
 * Plan §10.2 — tile grid linking to the user's visible dashboards.
 * Backend: `GET /insights/dashboards` returns the list filtered by
 * the actor's read scope (no separate `/visible` endpoint exists;
 * the list endpoint already enforces visibility via RolesGuard /
 * extractContext).
 */
export const DashboardsOverviewPanel: React.FC<Props> = ({ config }) => {
  const max = (config.maxDashboards as number | undefined) ?? 6;
  const [dashboards, setDashboards] = useState<DashboardDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const all = await listDashboards();
        if (!cancelled) setDashboards(all.slice(0, max));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboards');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [max]);

  return (
    <PanelShell title="Dashboards" subtitle={`up to ${max}`}>
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <PanelPlaceholder message={error} />
      ) : dashboards.length === 0 ? (
        <PanelPlaceholder message="No dashboards visible." />
      ) : (
        <div className="grid grid-cols-2 gap-2 px-3 py-2">
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              to={`/insights/dashboards/${dashboard.code}`}
              className="flex items-start gap-2 rounded border border-border bg-muted/20 p-3 hover:border-primary hover:bg-primary/10"
            >
              <BarChart3 size={14} className="mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{dashboard.name}</div>
                {dashboard.description ? (
                  <div className="text-xs text-muted-foreground">{dashboard.description}</div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PanelShell>
  );
};
