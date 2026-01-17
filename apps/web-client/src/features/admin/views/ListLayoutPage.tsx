import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { viewApi, ViewDefinitionListItem, ViewScope } from '../../../services/viewApi';
import metadataApi from '../../../services/metadataApi';
import { api } from '../../../lib/api';
import { ViewConfigurator } from '../../../components/views/ViewConfigurator';
import { TableColumn } from '../../../components/table/types';
import { ListViewConfig, ViewConfig } from '../../../components/views/types';
import { useToastHelpers } from '../../../components/ui/Toast';

interface CollectionApiResponse {
  id: string;
  code: string;
  name: string;
}

interface SchemaResponse {
  collection: {
    id: string;
    code: string;
    name: string;
  };
  properties: Array<{
    id: string;
    code: string;
    name: string;
    dataType?: string;
    config?: Record<string, unknown>;
  }>;
}

interface ListViewDefinition {
  id: string;
  code: string;
  label: string;
  description?: string;
  scope: ViewScope;
  scopeKey?: string | null;
  priority?: number;
  config: Record<string, unknown>;
  revisionId?: string;
  updatedAt?: string;
}

const LIST_VIEW_LABEL = 'List View';

const SCOPE_LABELS: Record<ViewScope, string> = {
  system: 'System',
  instance: 'Instance',
  role: 'Role',
  group: 'Group',
  personal: 'Personal',
};

const toViewCode = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
};

const mapDefinitionToListView = (item: ViewDefinitionListItem): ListViewDefinition => {
  const layoutPayload =
    item.latestRevision?.layout
    || item.latestPublishedRevision?.layout
    || {};
  const primaryVariant = item.variants[0];
  const scope = primaryVariant?.scope || 'instance';
  return {
    id: item.definition.id,
    code: item.definition.code,
    label: item.definition.name,
    description: item.definition.description || undefined,
    scope,
    scopeKey: primaryVariant?.scopeKey ?? null,
    priority: primaryVariant?.priority,
    config: typeof layoutPayload === 'object' && layoutPayload ? layoutPayload : {},
    revisionId: item.latestRevision?.id || item.latestPublishedRevision?.id,
    updatedAt: item.definition.updatedAt,
  };
};

const buildDefaultColumns = (properties: SchemaResponse['properties']): TableColumn[] => {
  return properties.map((prop) => ({
    code: prop.code,
    label: prop.name || prop.code,
    type: prop.dataType || (prop.config?.dataType as string) || 'string',
    width: 160,
    hidden: false,
  }));
};

const mapLayoutColumns = (
  properties: SchemaResponse['properties'],
  layout: Record<string, unknown>
): TableColumn[] => {
  const layoutColumns =
    (layout.columns as Array<Record<string, unknown>> | undefined)
    || ((layout.list as Record<string, unknown> | undefined)?.columns as Array<Record<string, unknown>> | undefined)
    || [];

  if (!Array.isArray(layoutColumns) || layoutColumns.length === 0) {
    return buildDefaultColumns(properties);
  }

  const propertyMap = new Map(properties.map((prop) => [prop.code, prop]));
  const columns: TableColumn[] = [];

  layoutColumns.forEach((column) => {
    const code = (column.property_code || column.code) as string | undefined;
    if (!code) return;
    const prop = propertyMap.get(code);
    if (!prop) return;

    columns.push({
      code,
      label: (column.label as string) || prop.name || prop.code,
      type: (column.type as string) || prop.dataType || (prop.config?.dataType as string) || 'string',
      width: (column.width as number) || 160,
      hidden: column.visible === false || column.hidden === true,
    });
  });

  return columns.length > 0 ? columns : buildDefaultColumns(properties);
};

const buildListConfig = (
  view: ListViewDefinition | null,
  collectionCode: string,
  properties: SchemaResponse['properties']
): ListViewConfig => {
  const layout = view?.config && typeof view.config === 'object' ? view.config : {};
  const listLayout = (layout.list as Record<string, unknown>) || layout;

  return {
    id: view?.id || 'list-view',
    name: view?.label || LIST_VIEW_LABEL,
    type: 'list',
    collectionCode,
    columns: mapLayoutColumns(properties, listLayout),
    filters: (listLayout.filters as any) || undefined,
    sortBy: (listLayout.sort as { field?: string } | undefined)?.field,
    sortDir: (listLayout.sort as { direction?: 'asc' | 'desc' } | undefined)?.direction,
    pageSize: (listLayout.display as { pageSize?: number } | undefined)?.pageSize,
    showRowNumbers: (listLayout.display as { showRowNumbers?: boolean } | undefined)?.showRowNumbers,
    enableInlineEdit: (listLayout.display as { enableInlineEdit?: boolean } | undefined)?.enableInlineEdit,
  };
};

const toListLayoutPayload = (config: ListViewConfig) => {
  return {
    columns: config.columns.map((column) => ({
      property_code: column.code,
      label: column.label,
      width: column.width,
      visible: !column.hidden,
    })),
    filters: config.filters || null,
    sort: config.sortBy ? { field: config.sortBy, direction: config.sortDir || 'asc' } : null,
    display: {
      pageSize: config.pageSize,
      showRowNumbers: config.showRowNumbers,
      enableInlineEdit: config.enableInlineEdit,
    },
  };
};

export const ListLayoutPage: React.FC = () => {
  const { id: collectionId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [collection, setCollection] = useState<CollectionApiResponse | null>(null);
  const [properties, setProperties] = useState<SchemaResponse['properties']>([]);
  const [views, setViews] = useState<ListViewDefinition[]>([]);
  const [activeViewId, setActiveViewId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewEditorOpen, setViewEditorOpen] = useState(false);
  const [viewNameDraft, setViewNameDraft] = useState('');
  const [viewScopeDraft, setViewScopeDraft] = useState<ViewScope>('instance');
  const [viewScopeKeyDraft, setViewScopeKeyDraft] = useState('');
  const { success: showSuccess, error: showError } = useToastHelpers();

  const returnTo = searchParams.get('return');

  const loadData = useCallback(async () => {
    if (!collectionId) return;
    setLoading(true);
    setError(null);

    try {
      const collectionRes = await metadataApi.get<CollectionApiResponse>(`/collections/${collectionId}`);
      const collectionData = collectionRes.data;
      setCollection(collectionData);

      const schemaRes = await api.get<SchemaResponse>(`/data/collections/${collectionData.code}/schema`);
      setProperties(schemaRes.properties || []);

      const viewList = await viewApi.listDefinitions({ kind: 'list', collection: collectionData.code });
      const listViews = viewList.map(mapDefinitionToListView);
      setViews(listViews);
      if (listViews.length > 0) {
        setActiveViewId(listViews[0].id);
      }
    } catch (err) {
      console.error('Failed to load list builder data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load list builder');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeView = useMemo(
    () => views.find((view) => view.id === activeViewId) || views[0] || null,
    [activeViewId, views]
  );

  const listConfig = useMemo(() => {
    if (!collection || !activeView) {
      return null;
    }
    return buildListConfig(activeView, collection.code, properties);
  }, [activeView, collection, properties]);

  const handleClose = useCallback(() => {
    if (returnTo) {
      navigate(returnTo);
    } else if (collectionId) {
      navigate(`/studio/collections/${collectionId}/views`);
    } else {
      navigate('/studio/collections');
    }
  }, [collectionId, navigate, returnTo]);

  const openViewEditor = () => {
    setViewNameDraft('');
    setViewScopeDraft('instance');
    setViewScopeKeyDraft('');
    setViewEditorOpen(true);
  };

  const closeViewEditor = () => {
    setViewEditorOpen(false);
    setViewNameDraft('');
    setViewScopeDraft('instance');
    setViewScopeKeyDraft('');
  };

  const saveView = async () => {
    if (!collection || !viewNameDraft.trim()) return;
    if ((viewScopeDraft === 'role' || viewScopeDraft === 'group' || viewScopeDraft === 'personal') && !viewScopeKeyDraft.trim()) {
      showError('Scope key is required for role, group, and personal scopes.');
      return;
    }

    try {
      const code = toViewCode(viewNameDraft.trim());
      const layoutPayload = { list: toListLayoutPayload(buildListConfig(null, collection.code, properties)) };
      await viewApi.createDraft({
        code,
        name: viewNameDraft.trim(),
        description: undefined,
        kind: 'list',
        target_collection_code: collection.code,
        layout: layoutPayload,
        variant: {
          scope: viewScopeDraft,
          scope_key: viewScopeKeyDraft || undefined,
        },
      });
      await viewApi.publish(code);
      await loadData();
      showSuccess('List view created.');
      closeViewEditor();
    } catch (err) {
      console.error('Failed to create list view:', err);
      showError('Failed to create list view.');
    }
  };

  const handleSaveLayout = async (config: ViewConfig) => {
    if (!collection || !activeView || config.type !== 'list') return;

    try {
      const layoutPayload = { list: toListLayoutPayload(config as ListViewConfig) };
      await viewApi.createDraft({
        code: activeView.code,
        name: activeView.label,
        description: activeView.description,
        kind: 'list',
        target_collection_code: collection.code,
        layout: layoutPayload,
        variant: {
          scope: activeView.scope,
          scope_key: activeView.scopeKey || undefined,
          priority: activeView.priority,
        },
      });
      await viewApi.publish(activeView.code);
      await loadData();
      showSuccess('List layout saved.');
    } catch (err) {
      console.error('Failed to save list layout:', err);
      showError('Failed to save list layout.');
    }
  };

  if (!collectionId) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">Missing collection id.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card border-border">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={handleClose}
              className="transition-colors hover:text-foreground"
            >
              Back
            </button>
            <span>/</span>
            <span className="text-foreground">{collection?.name || 'Collection'}</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">List Builder</h1>
          <p className="text-sm text-muted-foreground">
            {activeView ? activeView.label : 'No list view yet'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openViewEditor}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            New View
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r border-border bg-muted/30">
          <div className="p-4 space-y-2">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveViewId(view.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeView?.id === view.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="truncate">{view.label || LIST_VIEW_LABEL}</span>
                <span className="text-xs text-muted-foreground">{SCOPE_LABELS[view.scope]}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-6">
          {listConfig ? (
            <ViewConfigurator
              key={listConfig.id}
              view={listConfig as ViewConfig}
              properties={properties.map((prop) => ({
                code: prop.code,
                name: prop.name || prop.code,
                type: prop.dataType || (prop.config?.dataType as string) || 'string',
              }))}
              onSave={handleSaveLayout}
              onCancel={handleClose}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-muted-foreground">Create a list view to begin.</p>
            </div>
          )}
        </main>
      </div>

      {viewEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-overlay/50" onClick={closeViewEditor} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-lg shadow-xl bg-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">New List View</h2>
              <button
                type="button"
                onClick={closeViewEditor}
                className="p-1 rounded hover:bg-hover"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={viewNameDraft}
                  onChange={(event) => setViewNameDraft(event.target.value)}
                  className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                  placeholder="List View Name"
                />
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  View Name
                </label>
              </div>

              <div className="relative">
                <select
                  value={viewScopeDraft}
                  onChange={(event) => setViewScopeDraft(event.target.value as ViewScope)}
                  className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                >
                  <option value="instance">Instance</option>
                  <option value="system">System</option>
                  <option value="role">Role</option>
                  <option value="group">Group</option>
                  <option value="personal">Personal</option>
                </select>
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Scope
                </label>
              </div>

              {(viewScopeDraft === 'role' || viewScopeDraft === 'group' || viewScopeDraft === 'personal') && (
                <div className="relative">
                  <input
                    type="text"
                    value={viewScopeKeyDraft}
                    onChange={(event) => setViewScopeKeyDraft(event.target.value)}
                    className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                    placeholder={viewScopeDraft === 'role' ? 'Role code' : viewScopeDraft === 'group' ? 'Group id' : 'User id'}
                  />
                  <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                    Scope Key
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                type="button"
                onClick={closeViewEditor}
                className="px-4 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveView}
                className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListLayoutPage;
