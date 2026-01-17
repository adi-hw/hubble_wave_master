import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { GlassInput, GlassSelect, GlassTextarea } from '../../components/ui/glass';
import { Button } from '../../components/ui/Button';
import { useToastHelpers } from '../../components/ui/Toast';
import {
  createDashboard,
  listDashboards,
  listMetrics,
  updateDashboard,
  type DashboardDefinition,
  type MetricDefinition,
} from '../../services/insights.service';

type WidgetType = 'metric' | 'trend' | 'table';

type DashboardWidget = {
  id: string;
  type: WidgetType;
  title: string;
  metricCode?: string;
  width: number;
  height: number;
  drilldown?: {
    collectionCode?: string;
    route?: string;
  };
};

type DashboardLayout = {
  version: 1;
  widgets: DashboardWidget[];
};

const widgetTypeOptions: Array<{ value: WidgetType; label: string }> = [
  { value: 'metric', label: 'Metric' },
  { value: 'trend', label: 'Trend' },
  { value: 'table', label: 'Table' },
];

const emptyLayout: DashboardLayout = {
  version: 1,
  widgets: [],
};

const createWidget = (): DashboardWidget => ({
  id: crypto.randomUUID(),
  type: 'metric',
  title: '',
  metricCode: '',
  width: 6,
  height: 2,
  drilldown: {},
});

export function DashboardStudioPage() {
  const { success: showSuccess, error: showError } = useToastHelpers();
  const toastRef = useRef({ showSuccess, showError });
  const [dashboards, setDashboards] = useState<DashboardDefinition[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    code: '',
    name: '',
    description: '',
  });
  const [layout, setLayout] = useState<DashboardLayout>(emptyLayout);

  const metricOptions = useMemo(
    () =>
      metrics.map((metric) => ({
        value: metric.code,
        label: `${metric.name} (${metric.code})`,
      })),
    [metrics],
  );

  useEffect(() => {
    toastRef.current = { showSuccess, showError };
  }, [showSuccess, showError]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardData, metricData] = await Promise.all([listDashboards(), listMetrics()]);
      setDashboards(dashboardData);
      setMetrics(metricData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboards';
      toastRef.current.showError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = useCallback(() => {
    setEditingCode(null);
    setFormState({ code: '', name: '', description: '' });
    setLayout(emptyLayout);
  }, []);

  const handleEdit = useCallback((dashboard: DashboardDefinition) => {
    setEditingCode(dashboard.code);
    setFormState({
      code: dashboard.code,
      name: dashboard.name,
      description: dashboard.description || '',
    });
    const nextLayout = (dashboard.layout as DashboardLayout) || emptyLayout;
    setLayout({
      version: 1,
      widgets: Array.isArray(nextLayout.widgets) ? nextLayout.widgets : [],
    });
  }, []);

  const handleAddWidget = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      widgets: [...prev.widgets, createWidget()],
    }));
  }, []);

  const handleWidgetChange = useCallback((id: string, updates: Partial<DashboardWidget>) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((widget) =>
        widget.id === id ? { ...widget, ...updates } : widget,
      ),
    }));
  }, []);

  const handleWidgetDrilldownChange = useCallback(
    (id: string, updates: NonNullable<DashboardWidget['drilldown']>) => {
      setLayout((prev) => ({
        ...prev,
        widgets: prev.widgets.map((widget) =>
          widget.id === id
            ? { ...widget, drilldown: { ...(widget.drilldown || {}), ...updates } }
            : widget,
        ),
      }));
    },
    [],
  );

  const handleWidgetRemove = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((widget) => widget.id !== id),
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formState.code.trim() || !formState.name.trim()) {
      showError('Code and name are required.');
      return;
    }

    const payload = {
      code: formState.code.trim(),
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      layout,
      metadata: { status: 'published', source: 'studio' },
    };

    try {
      if (editingCode) {
        const updated = await updateDashboard(editingCode, {
          name: payload.name,
          description: payload.description,
          layout: payload.layout,
          metadata: payload.metadata,
        });
        setDashboards((prev) =>
          prev.map((item) => (item.code === updated.code ? updated : item)),
        );
        showSuccess(`Updated ${updated.name}`);
      } else {
        const created = await createDashboard(payload);
        setDashboards((prev) => [created, ...prev]);
        showSuccess(`Created ${created.name}`);
      }
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dashboard save failed';
      showError(message);
    }
  }, [editingCode, formState, layout, resetForm, showError, showSuccess]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboards</h1>
          <p className="text-sm text-muted-foreground">
            Build reusable dashboards with metric widgets and governed layouts.
          </p>
        </div>
        <Button variant="secondary" onClick={resetForm} disabled={loading}>
          Reset
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <GlassInput
              label="Code"
              value={formState.code}
              disabled={!!editingCode}
              onChange={(event) => setFormState((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="operations_dashboard"
            />
            <GlassInput
              label="Name"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Operations Overview"
            />
          </div>
          <GlassTextarea
            label="Description"
            value={formState.description}
            onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Explain the business objective for this dashboard."
          />

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Widgets</h2>
            <Button variant="primary" onClick={handleAddWidget}>
              Add Widget
            </Button>
          </div>

          {layout.widgets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Add widgets to define the dashboard layout.
            </div>
          ) : (
            <div className="space-y-4">
              {layout.widgets.map((widget) => (
                <div key={widget.id} className="rounded-xl border border-border bg-card p-4 space-y-4">
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex-1 min-w-[220px]">
                      <GlassInput
                        label="Title"
                        value={widget.title}
                        onChange={(event) =>
                          handleWidgetChange(widget.id, { title: event.target.value })
                        }
                        placeholder="Widget title"
                      />
                    </div>
                    <div className="min-w-[180px]">
                      <GlassSelect
                        label="Type"
                        value={widget.type}
                        options={widgetTypeOptions}
                        onChange={(event) =>
                          handleWidgetChange(widget.id, { type: event.target.value as WidgetType })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <GlassSelect
                      label="Metric"
                      value={widget.metricCode || ''}
                      options={metricOptions}
                      placeholder="Select metric"
                      onChange={(event) =>
                        handleWidgetChange(widget.id, { metricCode: event.target.value })
                      }
                    />
                    <GlassInput
                      label="Width"
                      type="number"
                      min={1}
                      max={12}
                      value={widget.width}
                      onChange={(event) =>
                        handleWidgetChange(widget.id, { width: Number(event.target.value) })
                      }
                    />
                    <GlassInput
                      label="Height"
                      type="number"
                      min={1}
                      max={6}
                      value={widget.height}
                      onChange={(event) =>
                        handleWidgetChange(widget.id, { height: Number(event.target.value) })
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <GlassInput
                      label="Drilldown Collection"
                      value={widget.drilldown?.collectionCode || ''}
                      onChange={(event) =>
                        handleWidgetDrilldownChange(widget.id, {
                          collectionCode: event.target.value.trim(),
                        })
                      }
                      placeholder="work_items"
                    />
                    <GlassInput
                      label="Drilldown Route"
                      value={widget.drilldown?.route || ''}
                      onChange={(event) =>
                        handleWidgetDrilldownChange(widget.id, {
                          route: event.target.value.trim(),
                        })
                      }
                      placeholder="/work_items.list"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button variant="ghost" onClick={() => handleWidgetRemove(widget.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="primary" onClick={handleSubmit} disabled={loading}>
              {editingCode ? 'Update Dashboard' : 'Create Dashboard'}
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Existing Dashboards</h2>
            <span className="text-xs text-muted-foreground">
              {loading ? 'Loading...' : `${dashboards.length} total`}
            </span>
          </div>
          {dashboards.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No dashboards created yet.</p>
          ) : (
            <div className="space-y-3">
              {dashboards.map((dashboard) => (
                <div
                  key={dashboard.code}
                  className="rounded-xl border border-border bg-card p-4 space-y-1"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{dashboard.name}</div>
                      <div className="text-xs text-muted-foreground">{dashboard.code}</div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => handleEdit(dashboard)}>
                      Edit
                    </Button>
                  </div>
                  {dashboard.description && (
                    <p className="text-xs text-muted-foreground">{dashboard.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

export default DashboardStudioPage;
