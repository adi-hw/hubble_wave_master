import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { Button } from '../../components/ui/Button';
import { useToastHelpers } from '../../components/ui/Toast';
import {
  getDashboard,
  getMetricPoints,
  type DashboardDefinition,
  type MetricPoint,
} from '../../services/insights.service';

type DashboardWidget = {
  id: string;
  type: 'metric' | 'trend' | 'table';
  title: string;
  metricCode?: string;
  width?: number;
  height?: number;
  drilldown?: {
    collectionCode?: string;
    route?: string;
  };
};

type DashboardLayout = {
  version: number;
  widgets: DashboardWidget[];
};

export function DashboardViewerPage() {
  const { success: showSuccess, error: showError } = useToastHelpers();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardDefinition | null>(null);
  const [metricValues, setMetricValues] = useState<Record<string, MetricPoint | null>>({});
  const [loading, setLoading] = useState(true);

  const layout = useMemo<DashboardLayout>(() => {
    const raw = (dashboard?.layout || {}) as DashboardLayout;
    return {
      version: raw.version || 1,
      widgets: Array.isArray(raw.widgets) ? raw.widgets : [],
    };
  }, [dashboard]);

  const loadDashboard = useCallback(async () => {
    if (!code) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const loaded = await getDashboard(code);
      setDashboard(loaded);

      const metricCodes = Array.from(
        new Set(
          (loaded?.layout as DashboardLayout | undefined)?.widgets
            ?.map((widget) => widget.metricCode)
            .filter((value): value is string => Boolean(value)) || [],
        ),
      );

      const points = await Promise.all(
        metricCodes.map(async (metricCode) => {
          const data = await getMetricPoints(metricCode);
          return {
            metricCode,
            point: data.length ? data[data.length - 1] : null,
          };
        }),
      );

      const nextValues: Record<string, MetricPoint | null> = {};
      points.forEach((entry) => {
        nextValues[entry.metricCode] = entry.point;
      });
      setMetricValues(nextValues);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboard';
      showError(message);
    } finally {
      setLoading(false);
    }
  }, [code, showError]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleDrilldown = useCallback(
    (widget: DashboardWidget) => {
      const route = widget.drilldown?.route?.trim();
      if (route) {
        navigate(route);
        return;
      }
      const collectionCode = widget.drilldown?.collectionCode?.trim();
      if (collectionCode) {
        navigate(`/${collectionCode}.list`);
        return;
      }
      showSuccess('No drilldown configured for this widget');
    },
    [navigate, showSuccess],
  );

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <GlassCard className="p-6 text-sm text-muted-foreground">Loading dashboard...</GlassCard>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <GlassCard className="p-6 text-sm text-muted-foreground">Dashboard not found.</GlassCard>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-sm text-muted-foreground">{dashboard.description}</p>
          )}
        </div>
        <Button variant="secondary" onClick={() => navigate('/studio/dashboards')}>
          Back to Builder
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {layout.widgets.map((widget) => {
          const value = widget.metricCode ? metricValues[widget.metricCode] : null;
          return (
            <GlassCard
              key={widget.id}
              className="p-4 space-y-2 cursor-pointer hover:border-primary transition"
              onClick={() => handleDrilldown(widget)}
            >
              <div className="text-sm text-muted-foreground uppercase tracking-wide">
                {widget.type}
              </div>
              <div className="text-lg font-semibold text-foreground">
                {widget.title || 'Untitled Widget'}
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {value ? value.value.toFixed(2) : '--'}
              </div>
              {widget.metricCode && (
                <div className="text-xs text-muted-foreground">
                  Metric: {widget.metricCode}
                </div>
              )}
              {(widget.drilldown?.route || widget.drilldown?.collectionCode) && (
                <div className="text-xs text-muted-foreground">
                  Drilldown ready
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardViewerPage;
