import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { viewApi, ResolvedView } from '../../services/viewApi';
import { offeringsApi, OfferingRecord } from '../../services/experienceHubApi';
import { GridCardView } from '../data/views/GridCardView';
import { AvaAssistPanel } from '../ava';
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

export const OfferingsBrowsePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [offerings, setOfferings] = useState<OfferingRecord[]>([]);
  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [resolvedView, setResolvedView] = useState<ResolvedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters = JSON.stringify([
          { property: 'is_active', operator: 'equals', value: true },
        ]);

        const [schema, view, list] = await Promise.all([
          api.get<SchemaResponse>('/data/collections/offerings/schema'),
          viewApi
            .resolve({ kind: 'list', collection: 'offerings', route: location.pathname })
            .catch(() => null),
          offeringsApi.list({ pageSize: 200, filters }),
        ]);

        if (!active) return;

        setProperties(schema.properties);
        setResolvedView(view);
        setOfferings(list.data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load offerings');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [location.pathname]);

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
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr] h-full">
      <div className="flex flex-col gap-6 min-h-0">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
                Experience Hub
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                Request Offerings
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Explore curated offerings and launch requests with governed forms and approvals.
              </p>
            </div>
            <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-2xl border border-border bg-card overflow-hidden">
          <GridCardView
            data={offerings}
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
            collectionCode="offerings"
            onRowClick={(row) => navigate(`/experience/offerings/${row.id}`)}
          />
        </div>
      </div>

      <AvaAssistPanel
        title="Experience Guide"
        subtitle="Ask AVA to find the right offering or status"
        context={{ page: 'Experience Hub - Offerings', collectionId: 'offerings' }}
      />
    </div>
  );
};

export default OfferingsBrowsePage;
