import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PanelShell, PanelPlaceholder } from './PanelShell';
import api from '../../../services/api';

interface Props {
  config: Record<string, unknown>;
}

/**
 * Aggregate metric over a collection. `count` runs against
 * `/api/data/grid/count` (already RLS-aware). `sum` / `avg` ship
 * with the broader aggregate slice — until then they show a
 * "metric not yet wired" message rather than a misleading dash.
 */
export const MetricsPanel: React.FC<Props> = ({ config }) => {
  const collectionCode = config.collectionCode as string | undefined;
  const metric = (config.metric as string | undefined)?.toLowerCase();
  const propertyCode = config.propertyCode as string | undefined;
  const filter = config.filter as Record<string, unknown> | undefined;

  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!collectionCode || !metric) return;
    const allowed = new Set(['count', 'sum', 'avg', 'min', 'max']);
    if (!allowed.has(metric)) {
      setError(`Metric "${metric}" is not supported (allowed: count / sum / avg / min / max)`);
      return;
    }
    if (metric !== 'count' && !propertyCode) {
      setError(`${metric} requires a propertyCode in the panel config`);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setValue(null);
    void (async () => {
      try {
        // Single endpoint serves count / sum / avg / min / max — same
        // RLS pipeline as `/grid/count`. The catalog now matches the
        // runtime exactly.
        const res = await api.post<{ value: number | null }>('/data/grid/aggregate', {
          collection: collectionCode,
          column: propertyCode,
          function: metric,
          filters: Array.isArray(filter) ? filter : [],
        });
        if (!cancelled) setValue(res.data?.value ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Aggregate query failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionCode, metric, propertyCode, JSON.stringify(filter ?? null)]);

  if (!collectionCode || !metric) {
    return (
      <PanelShell title="Metric">
        <PanelPlaceholder message="Bind a collection and metric in the panel config." />
      </PanelShell>
    );
  }

  return (
    <PanelShell title={`${metric.toUpperCase()} — ${collectionCode}`}>
      <div className="flex h-full items-center justify-center px-3 py-2">
        <div className="text-center">
          {loading ? (
            <Loader2 size={20} className="mx-auto animate-spin text-muted-foreground" />
          ) : error ? (
            <div className="text-xs text-destructive">{error}</div>
          ) : (
            <>
              <div className="text-3xl font-semibold text-foreground">
                {value !== null ? value.toLocaleString() : '—'}
              </div>
              <div className="text-xs text-muted-foreground">
                {propertyCode ? `${metric}(${propertyCode})` : metric}
              </div>
            </>
          )}
        </div>
      </div>
    </PanelShell>
  );
};
