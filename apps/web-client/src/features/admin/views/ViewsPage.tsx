/**
 * ViewsPage
 * HubbleWave Platform
 *
 * Page for managing view definitions within a collection.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Settings2,
  FileText,
  LayoutGrid,
  Monitor,
  User,
  Users,
  Shield,
  Globe,
  Loader2,
  AlertCircle,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import metadataApi from '../../../services/metadataApi';
import {
  viewApi,
  ViewDefinitionListItem,
  ViewKind,
  ViewScope,
  ViewVariant,
} from '../../../services/viewApi';

interface CollectionSummary {
  id: string;
  code: string;
  name: string;
}

interface ViewEditorState {
  open: boolean;
  view?: ViewDefinitionListItem;
  isNew: boolean;
}

const KIND_LABELS: Record<ViewKind, string> = {
  form: 'Form',
  list: 'List',
  page: 'Page',
};

const SCOPE_LABELS: Record<ViewScope, string> = {
  system: 'System',
  instance: 'Instance',
  role: 'Role',
  group: 'Group',
  personal: 'Personal',
};

const KIND_ICONS: Record<ViewKind, React.ReactNode> = {
  form: <FileText className="w-4 h-4" />,
  list: <LayoutGrid className="w-4 h-4" />,
  page: <Monitor className="w-4 h-4" />,
};

const SCOPE_ICONS: Record<ViewScope, React.ReactNode> = {
  system: <Globe className="w-4 h-4" />,
  instance: <Shield className="w-4 h-4" />,
  role: <Shield className="w-4 h-4" />,
  group: <Users className="w-4 h-4" />,
  personal: <User className="w-4 h-4" />,
};

const toViewCode = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
};

const selectPrimaryVariant = (variants: ViewVariant[]) => {
  if (variants.length === 0) return null;
  return [...variants].sort((a, b) => {
    const priorityScore = a.priority - b.priority;
    if (priorityScore !== 0) return priorityScore;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0];
};

export const ViewsPage: React.FC = () => {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [collection, setCollection] = useState<CollectionSummary | null>(null);
  const [views, setViews] = useState<ViewDefinitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ViewEditorState>({ open: false, isNew: true });

  const [formName, setFormName] = useState('');
  const [formKind, setFormKind] = useState<ViewKind>('list');
  const [formScope, setFormScope] = useState<ViewScope>('instance');
  const [formScopeKey, setFormScopeKey] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [kindDropdownOpen, setKindDropdownOpen] = useState(false);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);

  const requiresScopeKey = formScope === 'role' || formScope === 'group' || formScope === 'personal';

  const loadViews = useCallback(async () => {
    if (!collectionId) return;
    setLoading(true);
    setError(null);

    try {
      const collectionRes = await metadataApi.get<CollectionSummary>(`/collections/${collectionId}`);
      setCollection(collectionRes.data);

      const viewList = await viewApi.listDefinitions({ collection: collectionRes.data.code });
      setViews(viewList);
    } catch (err) {
      console.error('Failed to load views', err);
      setError('Failed to load views. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const openCreate = () => {
    setFormName('');
    setFormKind('list');
    setFormScope('instance');
    setFormScopeKey('');
    setFormDescription('');
    setEditor({ open: true, isNew: true });
  };

  const openEdit = (view: ViewDefinitionListItem) => {
    const primaryVariant = selectPrimaryVariant(view.variants);
    setFormName(view.definition.name);
    setFormKind(view.definition.kind);
    setFormScope(primaryVariant?.scope || 'instance');
    setFormScopeKey(primaryVariant?.scopeKey || '');
    setFormDescription(view.definition.description || '');
    setEditor({ open: true, isNew: false, view });
  };

  const closeEditor = () => {
    setEditor({ open: false, isNew: true });
    setKindDropdownOpen(false);
    setScopeDropdownOpen(false);
  };

  const handleSave = async () => {
    if (!collection || !formName.trim()) return;
    if (requiresScopeKey && !formScopeKey.trim()) {
      setError('Scope key is required for the selected scope.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const code = editor.isNew
        ? toViewCode(formName.trim())
        : editor.view?.definition.code || toViewCode(formName.trim());

      const layoutPayload =
        editor.view?.latestRevision?.layout
        || editor.view?.latestPublishedRevision?.layout
        || {};

      await viewApi.createDraft({
        code,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        kind: formKind,
        target_collection_code: collection.code,
        layout: layoutPayload,
        variant: {
          scope: formScope,
          scope_key: requiresScopeKey ? formScopeKey.trim() : undefined,
        },
      });

      await viewApi.publish(code);
      closeEditor();
      loadViews();
    } catch (err) {
      console.error('Failed to save view', err);
      setError('Failed to save view. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sortedViews = useMemo(() => {
    return [...views].sort((a, b) => {
      const timeA = new Date(a.definition.updatedAt).getTime();
      const timeB = new Date(b.definition.updatedAt).getTime();
      return timeB - timeA;
    });
  }, [views]);

  if (!collectionId) return null;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(`/studio/collections/${collectionId}`)}
          className="flex items-center gap-2 text-sm mb-4 transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Collection
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold mb-2 text-foreground">Views</h1>
            <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={() => navigate('/studio/collections')}
                className="transition-colors text-muted-foreground hover:text-foreground"
              >
                Collections
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
              <button
                type="button"
                onClick={() => navigate(`/studio/collections/${collectionId}`)}
                className="transition-colors text-muted-foreground hover:text-foreground"
              >
                {collection?.name || collectionId.slice(0, 8)}
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
              <span className="text-foreground">Views</span>
            </nav>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New View
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between p-3 mb-4 rounded border bg-warning-subtle border-warning-border text-warning-text">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 rounded hover:bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border bg-card border-border">
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </div>
      )}

      {!loading && sortedViews.length === 0 && (
        <div className="rounded-lg border bg-card border-border">
          <div className="flex flex-col items-center py-8">
            <p className="mb-1 text-muted-foreground">No views configured yet</p>
            <p className="text-sm mb-4 text-muted-foreground/60">
              Create views to shape how data appears in this collection.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Create First View
            </button>
          </div>
        </div>
      )}

      {!loading && sortedViews.length > 0 && (
        <div className="rounded-lg border overflow-hidden bg-card border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted border-border">
                <th className="p-3 text-left font-semibold text-muted-foreground">Name</th>
                <th className="p-3 text-left font-semibold text-muted-foreground">Kind</th>
                <th className="p-3 text-left font-semibold text-muted-foreground">Scope</th>
                <th className="p-3 text-left font-semibold text-muted-foreground">Status</th>
                <th className="p-3 text-right font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedViews.map((view) => {
                const primaryVariant = selectPrimaryVariant(view.variants);
                const status = view.latestPublishedRevision
                  ? 'Published'
                  : view.latestRevision
                    ? 'Draft'
                    : 'Unpublished';
                return (
                  <tr
                    key={view.definition.id}
                    className="border-b border-border transition-colors hover:bg-hover"
                  >
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="text-foreground font-medium">
                          {view.definition.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {view.definition.code}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded border-border text-foreground">
                        {KIND_ICONS[view.definition.kind]}
                        {KIND_LABELS[view.definition.kind]}
                      </span>
                    </td>
                    <td className="p-3">
                      {primaryVariant ? (
                        <div className="flex items-center gap-2 text-foreground">
                          {SCOPE_ICONS[primaryVariant.scope]}
                          <div className="flex flex-col">
                            <span>{SCOPE_LABELS[primaryVariant.scope]}</span>
                            {primaryVariant.scopeKey && (
                              <span className="text-xs text-muted-foreground">
                                {primaryVariant.scopeKey}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No variants</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 text-xs rounded border border-border text-muted-foreground">
                        {status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {view.definition.kind === 'form' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/studio/collections/${collectionId}/form-layout`)}
                            className="p-1.5 rounded transition-colors hover:bg-hover"
                            aria-label="Configure form layout"
                            title="Configure form layout"
                          >
                            <Settings2 className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                        {view.definition.kind === 'list' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/studio/collections/${collectionId}/list-layout`)}
                            className="p-1.5 rounded transition-colors hover:bg-hover"
                            aria-label="Configure list layout"
                            title="Configure list layout"
                          >
                            <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(view)}
                          className="p-1.5 rounded transition-colors hover:bg-hover"
                          aria-label="Edit view"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editor.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-overlay/50" onClick={closeEditor} aria-hidden="true" />
          <div
            className="relative w-full max-w-md rounded-lg shadow-xl bg-card"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editor.isNew ? 'Create View' : 'Edit View'}
              </h2>
              <button
                type="button"
                onClick={closeEditor}
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
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                />
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  View Name *
                </label>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setKindDropdownOpen(!kindDropdownOpen);
                    setScopeDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                >
                  <span className="flex items-center gap-2">
                    {KIND_ICONS[formKind]}
                    {KIND_LABELS[formKind]}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${kindDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  View Kind
                </label>
                {kindDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 rounded border shadow-lg bg-card border-border">
                    {Object.keys(KIND_LABELS).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => {
                          setFormKind(kind as ViewKind);
                          setKindDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-foreground hover:bg-hover"
                      >
                        {KIND_ICONS[kind as ViewKind]}
                        {KIND_LABELS[kind as ViewKind]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setScopeDropdownOpen(!scopeDropdownOpen);
                    setKindDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                >
                  <span className="flex items-center gap-2">
                    {SCOPE_ICONS[formScope]}
                    {SCOPE_LABELS[formScope]}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${scopeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Scope
                </label>
                {scopeDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 rounded border shadow-lg bg-card border-border">
                    {Object.keys(SCOPE_LABELS).map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => {
                          setFormScope(scope as ViewScope);
                          setScopeDropdownOpen(false);
                          setFormScopeKey('');
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-foreground hover:bg-hover"
                      >
                        {SCOPE_ICONS[scope as ViewScope]}
                        {SCOPE_LABELS[scope as ViewScope]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {requiresScopeKey && (
                <div className="relative">
                  <input
                    type="text"
                    value={formScopeKey}
                    onChange={(e) => setFormScopeKey(e.target.value)}
                    className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                    placeholder={
                      formScope === 'role'
                        ? 'Role code'
                        : formScope === 'group'
                          ? 'Group id'
                          : 'User id'
                    }
                  />
                  <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                    Scope Key
                  </label>
                </div>
              )}

              <div className="relative">
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded border text-sm resize-none bg-muted border-border text-foreground"
                />
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Description
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                type="button"
                onClick={closeEditor}
                className="px-4 py-2 text-sm rounded border transition-colors border-border text-foreground hover:bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="px-4 py-2 text-sm rounded transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
