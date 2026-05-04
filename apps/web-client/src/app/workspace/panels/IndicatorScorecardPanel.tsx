import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PanelShell, PanelPlaceholder } from './PanelShell';
import {
  getMetricPoints,
  listMetrics,
  type MetricDefinition,
} from '../../../services/insights.service';

interface Props {
  config: Record<string, unknown>;
}

interface IndicatorState {
  code: string;
  name?: string;
  value: number | null;
  error?: string;
}

/**
 * Plan §10.2 — scorecard of svc-insights indicators. Resolves each
 * configured indicator code to its latest aggregated point via
 * `/insights/metrics/:code/points?limit=1`, plus the metric
 * definition for the human-readable name. Indicators the actor
 * can't read surface as `Forbidden` instead of mixing into the
 * scorecard.
 */
export const IndicatorScorecardPanel: React.FC<Props> = ({ config }) => {
  const codes = (config.indicatorCodes as string[] | undefined) ?? [];
  const [indicators, setIndicators] = useState<IndicatorState[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (codes.length === 0) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const definitions = await listMetrics();
        const defByCode = new Map<string, MetricDefinition>(definitions.map((d) => [d.code, d]));
        const results = await Promise.all(
          codes.map(async (code): Promise<IndicatorState> => {
            try {
              // direction='desc' + limit=1 returns the latest point.
              // Without `direction`, svc-insights orders ASC and the
              // single returned point is the OLDEST in retention.
              const points = await getMetricPoints(code, { limit: 1, direction: 'desc' });
              return {
                code,
                name: defByCode.get(code)?.name,
                value: points[0]?.value ?? null,
              };
            } catch (err) {
              return {
                code,
                name: defByCode.get(code)?.name,
                value: null,
                error: err instanceof Error ? err.message : 'Fetch failed',
              };
            }
          }),
        );
        if (!cancelled) setIndicators(results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // codes is an array from props — JSON.stringify so identity
    // changes don't trigger spurious refetches.
  }, [JSON.stringify(codes)]);

  if (codes.length === 0) {
    return (
      <PanelShell title="Indicators">
        <PanelPlaceholder message="Bind one or more indicator codes in the panel config." />
      </PanelShell>
    );
  }

  return (
    <PanelShell title="Indicators" subtitle={`${codes.length} indicator${codes.length === 1 ? '' : 's'}`}>
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 px-3 py-2">
          {indicators.map((ind) => (
            <div key={ind.code} className="rounded border border-border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">{ind.name ?? ind.code}</div>
              <div className="text-xl font-semibold text-foreground">
                {ind.error ? '—' : ind.value !== null ? ind.value.toLocaleString() : '—'}
              </div>
              {ind.error ? (
                <div className="text-xs text-destructive">{ind.error}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
};
