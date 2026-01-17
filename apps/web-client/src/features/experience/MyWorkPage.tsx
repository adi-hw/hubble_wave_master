import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { viewApi, ResolvedView } from '../../services/viewApi';
import { workApi, WorkItemRecord } from '../../services/experienceHubApi';
import { GridCardView } from '../data/views/GridCardView';
import {
  SchemaProperty,
  extractListColumns,
  getPropertyDataType,
} from './experienceUtils';

type SchemaResponse = {
  collection: {
    code: string;
    name?: string;
    label?: string;
    description?: string;
  };
  properties: SchemaProperty[];
};

type WorkScope = 'requested' | 'assigned';

export const MyWorkPage = () => {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [workItems, setWorkItems] = useState<WorkItemRecord[]>([]);
  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [resolvedView, setResolvedView] = useState<ResolvedView | null>(null);
  const [scope, setScope] = useState<WorkScope>('requested');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!auth.user?.id) {
        setError('User context unavailable');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const filters = JSON.stringify([
          {
            property: scope === 'assigned' ? 'assigned_to' : 'requested_by',
            operator: 'equals',
            value: auth.user.id,
          },
        ]);

        const [schema, view, list] = await Promise.all([
          api.get<SchemaResponse>('/data/collections/work_items/schema'),
          viewApi
            .resolve({ kind: 'list', collection: 'work_items', route: location.pathname })
            .catch(() => null),
          workApi.list({ pageSize: 200, filters }),
        ]);

        if (!active) return;

        setProperties(schema.properties);
        setResolvedView(view);
        setWorkItems(list.data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load work items');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [auth.user?.id, location.pathname, scope]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
              Experience Hub
            </div>
            <h1 className="text-2xl font-semibold text-foreground">My Work</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Track the requests you submitted and the work assigned to you.
            </p>
          </div>
          <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Briefcase className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScope('requested')}
            className={`btn btn-sm ${scope === 'requested' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Requested by me
          </button>
          <button
            type="button"
            onClick={() => setScope('assigned')}
            className={`btn btn-sm ${scope === 'assigned' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Assigned to me
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-border bg-card overflow-hidden">
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
          onRowClick={(row) => navigate(`/experience/work/${row.id}`)}
        />
      </div>
    </div>
  );
};

export default MyWorkPage;
