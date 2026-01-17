import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Copy,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { FormLayoutDesigner } from '../../../components/form/designer/FormLayoutDesigner';
import {
  buildDefaultDesignerLayout,
  SimpleFormLayout,
  toDesignerLayout,
  toSimpleFormLayout,
} from '../../../components/form/designer/layout-utils';
import type { DesignerLayout } from '../../../components/form/designer/types';
import type { ModelProperty } from '../../../services/platform.service';
import { viewApi, ViewDefinitionListItem, ViewScope } from '../../../services/viewApi';
import metadataApi from '../../../services/metadataApi';
import { api } from '../../../lib/api';
import { PropertyEditor } from '../properties/PropertyEditor';
import { PropertyList } from '../properties/PropertyList';
import { AvaSuggestionsModal } from '../properties/AvaSuggestionsModal';
import { propertyApi, PropertyDefinition } from '../../../services/propertyApi';
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
    isRequired: boolean;
    isUnique: boolean;
    isReadonly?: boolean;
    config?: Record<string, unknown>;
    validationRules?: Record<string, unknown>;
    columnName?: string;
    defaultValue?: unknown;
  }>;
}

type StudioTab = 'views' | 'builder' | 'fields' | 'policies';

interface FormPolicyCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than';
  value?: string;
}

interface FormPolicyAction {
  type: 'show' | 'hide' | 'require' | 'read_only';
  targets: string[];
}

interface FormPolicy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: FormPolicyCondition[];
  actions: FormPolicyAction[];
}

interface PolicyEditorState {
  open: boolean;
  policy: FormPolicy | null;
}

interface FormView {
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

const FORM_VIEW_LABEL = 'Form View';
const SCOPE_LABELS: Record<ViewScope, string> = {
  system: 'System',
  instance: 'Instance',
  role: 'Role',
  group: 'Group',
  personal: 'Personal',
};

const getDefaultFormView = (views: FormView[]) => {
  return views.reduce<FormView | null>((latest, view) => {
    if (!latest) return view;
    const latestTime = Date.parse(latest.updatedAt || '');
    const viewTime = Date.parse(view.updatedAt || '');
    return viewTime > latestTime ? view : latest;
  }, null);
};

const getLayoutFromView = (view?: FormView | null) => {
  if (!view || !view.config || typeof view.config !== 'object') {
    return null;
  }

  const config = view.config as Record<string, unknown>;
  const savedDesigner = config.formLayout as DesignerLayout | undefined;
  if (savedDesigner?.version === 2) {
    return { layout: toSimpleFormLayout(savedDesigner), designer: savedDesigner };
  }

  const savedLayout = config.layout as SimpleFormLayout | undefined;
  if (savedLayout?.tabs?.length) {
    return { layout: savedLayout, designer: null };
  }

  return null;
};

const formatViewLabel = (view: FormView) => view.label || FORM_VIEW_LABEL;

const toViewCode = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
};

const mapDefinitionToFormView = (item: ViewDefinitionListItem): FormView => {
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

export const FormLayoutPage: React.FC = () => {
  const { id: collectionId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [collection, setCollection] = useState<CollectionApiResponse | null>(null);
  const [properties, setProperties] = useState<SchemaResponse['properties']>([]);
  const [views, setViews] = useState<FormView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<StudioTab>('builder');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewEditorOpen, setViewEditorOpen] = useState(false);
  const [viewEditorState, setViewEditorState] = useState<FormView | null>(null);
  const [viewNameDraft, setViewNameDraft] = useState('');
  const [viewScopeDraft, setViewScopeDraft] = useState<ViewScope>('instance');
  const [viewScopeKeyDraft, setViewScopeKeyDraft] = useState('');
  const [viewFilter, setViewFilter] = useState('');
  const [fieldStudioRefresh, setFieldStudioRefresh] = useState(0);
  const [fieldEditorOpen, setFieldEditorOpen] = useState(false);
  const [fieldEditorProperty, setFieldEditorProperty] = useState<PropertyDefinition | undefined>(undefined);
  const [fieldSuggestionsOpen, setFieldSuggestionsOpen] = useState(false);
  const [policyEditor, setPolicyEditor] = useState<PolicyEditorState>({ open: false, policy: null });
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

      const schemaRes = await api.get<SchemaResponse>(
        `/data/collections/${collectionData.code}/schema`
      );
      setProperties(schemaRes.properties || []);

      const viewList = await viewApi.listDefinitions({ kind: 'form', collection: collectionData.code });
      const formViews = viewList.map(mapDefinitionToFormView);
      setViews(formViews);
      const defaultView = getDefaultFormView(formViews);
      if (defaultView) {
        setActiveViewId(defaultView.id);
      }
    } catch (err) {
      console.error('Failed to load form studio data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load form studio');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeView = useMemo(
    () => views.find((view) => view.id === activeViewId) || getDefaultFormView(views),
    [activeViewId, views]
  );

  useEffect(() => {
    if (activeView && activeView.id !== activeViewId) {
      setActiveViewId(activeView.id);
    }
  }, [activeView, activeViewId]);

  const formFields = useMemo<ModelProperty[]>(() => {
    if (!collection) return [];

    return properties.map((prop) => ({
      code: prop.code,
      label: prop.name || prop.code,
      type: prop.dataType || (prop.config?.dataType as string) || 'string',
      backendType: prop.dataType || (prop.config?.dataType as string) || 'string',
      uiWidget: (prop.config?.widget as string) || '',
      storagePath: `column:${collection.code}.${prop.columnName || prop.code}`,
      nullable: !prop.isRequired,
      isUnique: prop.isUnique,
      defaultValue: prop.defaultValue as string | undefined,
      config: prop.config || {},
      validators: prop.validationRules || {},
    }));
  }, [collection, properties]);

  const designerInitialLayout = useMemo(() => {
    const layoutData = getLayoutFromView(activeView);
    if (layoutData?.designer) {
      return layoutData.designer;
    }
    if (layoutData?.layout) {
      return toDesignerLayout(layoutData.layout);
    }
    return buildDefaultDesignerLayout(formFields);
  }, [activeView, formFields]);

  const handleSaveLayout = useCallback(
    async (layout: DesignerLayout) => {
      if (!collection || !activeView) return;

      const layoutPayload = {
        layout: toSimpleFormLayout(layout),
        designer: layout,
      };

      try {
        await viewApi.createDraft({
          code: activeView.code,
          name: activeView.label,
          description: activeView.description,
          kind: 'form',
          target_collection_code: collection.code,
          layout: layoutPayload,
          variant: {
            scope: activeView.scope,
            scope_key: activeView.scopeKey ?? undefined,
            priority: activeView.priority,
          },
        });
        await viewApi.publish(activeView.code);
        await loadData();
        showSuccess('Form layout saved.');
      } catch (err) {
        console.error('Failed to save form layout:', err);
        showError('Failed to save form layout. Please try again.');
        throw err;
      }
    },
    [activeView, collection, loadData, showError, showSuccess]
  );

  const handleClose = useCallback(() => {
    if (returnTo) {
      navigate(returnTo);
    } else if (collectionId) {
      navigate(`/studio/collections/${collectionId}/views`);
    } else {
      navigate('/studio/collections');
    }
  }, [collectionId, navigate, returnTo]);

  const openViewEditor = (view?: FormView) => {
    setViewEditorState(view || null);
    setViewNameDraft(view?.label || '');
    setViewScopeDraft(view?.scope || 'instance');
    setViewScopeKeyDraft(view?.scopeKey || '');
    setViewEditorOpen(true);
  };

  const closeViewEditor = () => {
    setViewEditorOpen(false);
    setViewEditorState(null);
    setViewNameDraft('');
    setViewScopeDraft('instance');
    setViewScopeKeyDraft('');
  };

  const saveViewEditor = async () => {
    if (!collection || !viewNameDraft.trim()) return;

    const code = viewEditorState?.code || toViewCode(viewNameDraft.trim());
    const layoutPayload =
      (viewEditorState?.config as Record<string, unknown>) || {};

    try {
      await viewApi.createDraft({
        code,
        name: viewNameDraft.trim(),
        description: viewEditorState?.description,
        kind: 'form',
        target_collection_code: collection.code,
        layout: layoutPayload,
        variant: {
          scope: viewScopeDraft,
          scope_key: viewScopeKeyDraft || undefined,
        },
      });
      await viewApi.publish(code);
      await loadData();
      showSuccess(viewEditorState ? 'View updated.' : 'View created.');
      closeViewEditor();
    } catch (err) {
      console.error('Failed to save view:', err);
      showError('Failed to save view. Please try again.');
    }
  };

  const handleDuplicateView = async (view: FormView) => {
    if (!collection) return;
    try {
      const name = `${formatViewLabel(view)} Copy`;
      const code = toViewCode(`${view.code}_copy_${Date.now()}`);
      await viewApi.createDraft({
        code,
        name,
        description: view.description,
        kind: 'form',
        target_collection_code: collection.code,
        layout: view.config,
        variant: {
          scope: view.scope,
          scope_key: view.scopeKey || undefined,
          priority: view.priority,
        },
      });
      await viewApi.publish(code);
      await loadData();
      setActiveTab('builder');
      showSuccess('View duplicated.');
    } catch (err) {
      console.error('Failed to duplicate view:', err);
      showError('Failed to duplicate view.');
    }
  };

  const filteredViews = useMemo(() => {
    const term = viewFilter.trim().toLowerCase();
    if (!term) return views;
    return views.filter((view) =>
      formatViewLabel(view).toLowerCase().includes(term)
    );
  }, [viewFilter, views]);

  const handleSelectView = (view: FormView) => {
    setActiveViewId(view.id);
    setActiveTab('builder');
  };

  const openFieldEditor = (property?: PropertyDefinition) => {
    setFieldEditorProperty(property);
    setFieldEditorOpen(true);
  };

  const closeFieldEditor = () => {
    setFieldEditorProperty(undefined);
    setFieldEditorOpen(false);
  };

  const handleFieldDelete = async (property: PropertyDefinition) => {
    if (!collectionId) return;
    try {
      await propertyApi.delete(collectionId, property.id);
      setFieldStudioRefresh((prev) => prev + 1);
      showSuccess('Field deleted.');
    } catch (err) {
      console.error('Failed to delete field:', err);
      showError('Failed to delete field.');
    }
  };

  const handleFieldSave = () => {
    setFieldStudioRefresh((prev) => prev + 1);
  };

  const policies = useMemo<FormPolicy[]>(() => {
    const config = activeView?.config as Record<string, unknown> | undefined;
    const stored = config?.formPolicies as FormPolicy[] | undefined;
    return stored && Array.isArray(stored) ? stored : [];
  }, [activeView]);

  const savePolicies = async (nextPolicies: FormPolicy[]) => {
    if (!collection || !activeView) return;

    try {
      const existingConfig =
        activeView.config && typeof activeView.config === 'object'
          ? (activeView.config as Record<string, unknown>)
          : {};
      await viewApi.createDraft({
        code: activeView.code,
        name: activeView.label,
        description: activeView.description,
        kind: 'form',
        target_collection_code: collection.code,
        layout: { ...existingConfig, formPolicies: nextPolicies },
        variant: {
          scope: activeView.scope,
          scope_key: activeView.scopeKey || undefined,
          priority: activeView.priority,
        },
      });
      await viewApi.publish(activeView.code);
      await loadData();
      showSuccess('Policies saved.');
    } catch (err) {
      console.error('Failed to save policies:', err);
      showError('Failed to save policies.');
    }
  };

  const handleSavePolicy = async (policy: FormPolicy) => {
    const nextPolicies = policyEditor.policy
      ? policies.map((item) => (item.id === policy.id ? policy : item))
      : [...policies, policy];

    await savePolicies(nextPolicies);
    setPolicyEditor({ open: false, policy: null });
  };

  const handleDeletePolicy = async (policyId: string) => {
    const nextPolicies = policies.filter((policy) => policy.id !== policyId);
    await savePolicies(nextPolicies);
  };

  if (!collectionId) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
          Missing collection id.
        </div>
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
          <h1 className="text-2xl font-semibold text-foreground">Form Studio</h1>
          <p className="text-sm text-muted-foreground">
            {activeView ? formatViewLabel(activeView) : 'No form view yet'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('views')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border bg-card text-foreground hover:bg-muted"
          >
            <LayoutGrid className="w-4 h-4" />
            View Manager
          </button>
          <button
            type="button"
            onClick={() => openViewEditor()}
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
            {([
              { id: 'views', label: 'View Manager' },
              { id: 'builder', label: 'Form Builder' },
              { id: 'fields', label: 'Field Studio' },
              { id: 'policies', label: 'Policy Studio' },
            ] as Array<{ id: StudioTab; label: string }>).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{tab.label}</span>
                {activeTab === tab.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'views' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">View Manager</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage form views, defaults, and audiences.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openViewEditor()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  New View
                </button>
              </div>

              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={viewFilter}
                  onChange={(event) => setViewFilter(event.target.value)}
                  placeholder="Search form views"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-foreground"
                />
              </div>

              {filteredViews.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <p className="text-muted-foreground">No form views found.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredViews.map((view) => (
                    <div
                      key={view.id}
                      className={`rounded-xl border p-4 transition-shadow bg-card ${
                        activeView?.id === view.id
                          ? 'border-primary shadow-sm'
                          : 'border-border hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            {formatViewLabel(view)}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {SCOPE_LABELS[view.scope]}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectView(view)}
                          className="text-sm text-primary hover:opacity-80"
                        >
                          Open
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openViewEditor(view)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-border text-foreground hover:bg-muted"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateView(view)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-border text-foreground hover:bg-muted"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Duplicate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'builder' && (
            <div className="space-y-3">
              {!activeView ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <p className="text-muted-foreground">Create a form view to start building.</p>
                  <button
                    type="button"
                    onClick={() => openViewEditor()}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Plus className="w-4 h-4" />
                    New View
                  </button>
                </div>
              ) : (
                <FormLayoutDesigner
                  key={activeView.id}
                  collectionCode={collection?.code || ''}
                  fields={formFields}
                  initialLayout={designerInitialLayout}
                  onSave={handleSaveLayout}
                  onClose={handleClose}
                  variant="embedded"
                />
              )}
            </div>
          )}

          {activeTab === 'fields' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Field Studio</h2>
                  <p className="text-sm text-muted-foreground">
                    Create and manage fields for this collection.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFieldSuggestionsOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted"
                  >
                    <Sparkles className="w-4 h-4" />
                    Smart Detect
                  </button>
                  <button
                    type="button"
                    onClick={() => openFieldEditor()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Plus className="w-4 h-4" />
                    New Field
                  </button>
                </div>
              </div>

              <PropertyList
                collectionId={collectionId}
                refreshTrigger={fieldStudioRefresh}
                onEdit={openFieldEditor}
                onDelete={handleFieldDelete}
              />

              <PropertyEditor
                open={fieldEditorOpen}
                collectionId={collectionId}
                property={fieldEditorProperty}
                onClose={closeFieldEditor}
                onSave={handleFieldSave}
              />

              <AvaSuggestionsModal
                open={fieldSuggestionsOpen}
                collectionId={collectionId}
                onClose={() => setFieldSuggestionsOpen(false)}
                onApply={() => {
                  setFieldSuggestionsOpen(false);
                  openFieldEditor();
                }}
              />
            </div>
          )}

          {activeTab === 'policies' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Policy Studio</h2>
                  <p className="text-sm text-muted-foreground">
                    Create UI policies and visibility rules for this view.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPolicyEditor({
                      open: true,
                      policy: {
                        id: `policy-${Date.now()}`,
                        name: '',
                        description: '',
                        enabled: true,
                        conditions: [{ field: '', operator: 'equals', value: '' }],
                        actions: [{ type: 'show', targets: [] }],
                      },
                    })
                  }
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  New Policy
                </button>
              </div>

              {policies.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <p className="text-muted-foreground">No policies yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {policies.map((policy) => (
                    <div key={policy.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            {policy.name || 'Untitled policy'}
                          </h3>
                          {policy.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {policy.description}
                            </p>
                          )}
                          <div className="mt-2 text-xs text-muted-foreground">
                            {policy.conditions.length} condition{policy.conditions.length !== 1 ? 's' : ''} and{' '}
                            {policy.actions.length} action{policy.actions.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPolicyEditor({ open: true, policy })}
                            className="px-3 py-1.5 rounded-md text-xs border border-border text-foreground hover:bg-muted"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePolicy(policy.id)}
                            className="px-3 py-1.5 rounded-md text-xs border border-destructive text-destructive hover:bg-destructive/10"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {viewEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-overlay/50" onClick={closeViewEditor} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-lg shadow-xl bg-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {viewEditorState ? 'Edit View' : 'New View'}
              </h2>
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
                  placeholder="Form View Name"
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
                    placeholder={viewScopeDraft === 'role' ? 'Role code' : viewScopeDraft === 'group' ? 'Group ID' : 'User ID (optional)'}
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
                onClick={saveViewEditor}
                className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}

      {policyEditor.open && policyEditor.policy && (
        <PolicyEditor
          properties={properties}
          policy={policyEditor.policy}
          onClose={() => setPolicyEditor({ open: false, policy: null })}
          onSave={handleSavePolicy}
        />
      )}
    </div>
  );
};

interface PolicyEditorProps {
  properties: SchemaResponse['properties'];
  policy: FormPolicy;
  onClose: () => void;
  onSave: (policy: FormPolicy) => void;
}

const PolicyEditor: React.FC<PolicyEditorProps> = ({ properties, policy, onClose, onSave }) => {
  const [draft, setDraft] = useState<FormPolicy>(policy);

  useEffect(() => {
    setDraft(policy);
  }, [policy]);

  const updateCondition = (index: number, updates: Partial<FormPolicyCondition>) => {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.map((condition, idx) =>
        idx === index ? { ...condition, ...updates } : condition
      ),
    }));
  };

  const updateAction = (index: number, updates: Partial<FormPolicyAction>) => {
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.map((action, idx) =>
        idx === index ? { ...action, ...updates } : action
      ),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-overlay/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl rounded-lg shadow-xl bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Policy Editor</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-hover"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <input
                type="text"
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                placeholder="Policy name"
              />
              <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                Name
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary"
              />
              <span className="text-sm text-foreground">Enabled</span>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground min-h-[90px]"
              placeholder="Describe what this policy does"
            />
            <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
              Description
            </label>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">If</h3>
            {draft.conditions.map((condition, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-3 mb-3">
                <select
                  value={condition.field}
                  onChange={(event) => updateCondition(index, { field: event.target.value })}
                  className="px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                >
                  <option value="">Select field</option>
                  {properties.map((prop) => (
                    <option key={prop.id} value={prop.code}>
                      {prop.name}
                    </option>
                  ))}
                </select>
                <select
                  value={condition.operator}
                  onChange={(event) => updateCondition(index, { operator: event.target.value as FormPolicyCondition['operator'] })}
                  className="px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not equals</option>
                  <option value="is_empty">Is empty</option>
                  <option value="is_not_empty">Is not empty</option>
                  <option value="greater_than">Greater than</option>
                  <option value="less_than">Less than</option>
                </select>
                <input
                  type="text"
                  value={condition.value || ''}
                  onChange={(event) => updateCondition(index, { value: event.target.value })}
                  className="px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                  placeholder="Value"
                />
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Then</h3>
            {draft.actions.map((action, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-3 mb-3">
                <select
                  value={action.type}
                  onChange={(event) => updateAction(index, { type: event.target.value as FormPolicyAction['type'] })}
                  className="px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                >
                  <option value="show">Show</option>
                  <option value="hide">Hide</option>
                  <option value="require">Require</option>
                  <option value="read_only">Read only</option>
                </select>
                <select
                  value={action.targets[0] || ''}
                  onChange={(event) => updateAction(index, { targets: [event.target.value] })}
                  className="px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                >
                  <option value="">Select field</option>
                  {properties.map((prop) => (
                    <option key={prop.id} value={prop.code}>
                      {prop.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => updateAction(index, { targets: [] })}
                  className="px-3 py-2 rounded border text-sm border-border text-muted-foreground hover:text-foreground"
                >
                  Clear target
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
          >
            Save Policy
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormLayoutPage;
