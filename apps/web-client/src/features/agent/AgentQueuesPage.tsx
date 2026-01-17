import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Filter, ListChecks, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { viewApi, ResolvedView } from '../../services/viewApi';
import { GridCardView } from '../data/views/GridCardView';
import { AvaAssistPanel } from '../ava';
import { agentConsoleApi, type QueueDefinitionRecord } from '../../services/agentConsoleApi';
import { type WorkItemRecord } from '../../services/experienceHubApi';
import { SchemaProperty, extractListColumns, getPropertyDataType } from '../experience/experienceUtils';

type SchemaResponse = {
  collection: {
    code: string;
    name?: string;
    label?: string;
  };
  properties: SchemaProperty[];
};

type QueueFilter = Record<string, unknown> | Array<Record<string, unknown>>;

const readQueueFilters = (filters: unknown): QueueFilter | undefined => {
  if (!filters) return undefined;
  if (Array.isArray(filters)) return filters as Array<Record<string, unknown>>;
  if (typeof filters === 'object') return filters as Record<string, unknown>;
  if (typeof filters === 'string') {
    try {
      const parsed = JSON.parse(filters);
      if (parsed && (Array.isArray(parsed) || typeof parsed === 'object')) {
        return parsed as QueueFilter;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
};

export const AgentQueuesPage = () => {
  const { queueCode } = useParams<{ queueCode?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [queues, setQueues] = useState<QueueDefinitionRecord[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<QueueDefinitionRecord | null>(null);
  const [workItems, setWorkItems] = useState<WorkItemRecord[]>([]);
  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [resolvedView, setResolvedView] = useState<ResolvedView | null>(null);
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [loadingWork, setLoadingWork] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueues = useCallback(async () => {
    setLoadingQueues(true);
    setError(null);
    try {
      const filters = JSON.stringify([{ property: 'is_active', operator: 'equals', value: true }]);
      const result = await agentConsoleApi.listQueues({ pageSize: 200, filters });
      const items = result.data || [];
      setQueues(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queues');
    } finally {
      setLoadingQueues(false);
    }
  }, []);

  const loadSchemaAndView = useCallback(async () => {
    const [schema, view] = await Promise.all([
      api.get<SchemaResponse>('/data/collections/work_items/schema'),
      viewApi
        .resolve({ kind: 'list', collection: 'work_items', route: location.pathname })
        .catch(() => null),
    ]);
    setProperties(schema.properties || []);
    setResolvedView(view);
  }, [location.pathname]);

  const loadWorkItems = useCallback(async (queue: QueueDefinitionRecord | null) => {
    if (!queue) {
      setWorkItems([]);
      return;
    }
    setLoadingWork(true);
    setError(null);
    try {
      const filters = readQueueFilters(queue.filters);
      const sort = queue.sort ? JSON.stringify(queue.sort) : undefined;
      const response = await agentConsoleApi.listWorkItems({
        pageSize: 200,
        filters: filters ? JSON.stringify(filters) : undefined,
        sort,
      });
      setWorkItems(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work items');
    } finally {
      setLoadingWork(false);
    }
  }, []);

  useEffect(() => {
    void loadQueues();
    void loadSchemaAndView();
  }, [loadQueues, loadSchemaAndView]);

  useEffect(() => {
    if (!queues.length) {
      setSelectedQueue(null);
      return;
    }
    const candidate = queueCode
      ? queues.find((queue) => queue.code === queueCode)
      : queues[0];
    setSelectedQueue(candidate || queues[0]);
  }, [queueCode, queues]);

  useEffect(() => {
    void loadWorkItems(selectedQueue);
  }, [selectedQueue, loadWorkItems]);

  const visibleProperties = useMemo(() => {
    if (!properties.length) return [];
    const permissions = resolvedView?.fieldPermissions || {};
    const columnCodes = extractListColumns(resolvedView);
    if (!columnCodes.length) {
      return properties
        .filter((prop) => permissions[prop.code]?.canRead !== false)
        .map((prop) => ({
          ...prop,
          dataType: getPropertyDataType(prop),
        }));
    }
    const map = new Map(properties.map((prop) => [prop.code, prop]));
    return columnCodes
      .map((code) => map.get(code))
      .filter((prop): prop is SchemaProperty => Boolean(prop))
      .filter((prop) => permissions[prop.code]?.canRead !== false)
      .map((prop) => ({
        ...prop,
        dataType: getPropertyDataType(prop),
      }));
  }, [properties, resolvedView]);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
              Agent Console
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Queues</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Work through assigned queues with governed filters and SLA awareness.
            </p>
          </div>
          <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <ListChecks className="h-6 w-6" />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] h-full min-h-0">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr] min-h-0">
          <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Queues</h2>
              {loadingQueues && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="space-y-2">
              {queues.length === 0 && !loadingQueues && (
                <div className="text-sm text-muted-foreground">No active queues.</div>
              )}
              {queues.map((queue) => (
                <button
                  key={queue.id}
                  type="button"
                  onClick={() => {
                    setSelectedQueue(queue);
                    if (queue.code) {
                      navigate(`/agent/queues/${queue.code}`);
                    }
                  }}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                    selectedQueue?.id === queue.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="text-sm font-medium">{queue.name || queue.code || 'Queue'}</div>
                  <div className="text-xs opacity-80">{queue.description || 'Queue definition'}</div>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card shadow-sm overflow-hidden min-h-0">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {selectedQueue?.name || 'Work Items'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedQueue?.description || 'Filtered by queue definition'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="h-3 w-3" />
                {selectedQueue?.filters ? 'Filters active' : 'No filters'}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {loadingWork ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <GridCardView
                  data={workItems}
                  properties={visibleProperties.map((prop) => ({
                    id: prop.id,
                    code: prop.code,
                    label: prop.label || prop.name || prop.code,
                    name: prop.name,
                    dataType: getPropertyDataType(prop),
                    propertyType: prop.propertyType?.code,
                    description: prop.config?.description as string | undefined,
                    options: prop.config?.choices,
                    choiceList: prop.config?.choices,
                  }))}
                  loading={false}
                  collectionCode="work_items"
                  onRowClick={(row) => navigate(`/agent/work/${row.id}`)}
                />
              )}
            </div>
          </section>
        </div>

        <AvaAssistPanel
          title="Agent Copilot"
          subtitle="Summarize queues, spot SLA risks, and take action"
          context={{ page: 'Agent Console - Queues', collectionId: 'work_items' }}
        />
      </div>
    </div>
  );
};

export default AgentQueuesPage;
