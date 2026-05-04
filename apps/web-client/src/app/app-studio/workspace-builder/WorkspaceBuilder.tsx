import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Power, PowerOff, Save, Upload } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ProvenanceBadge } from '../../../components/provenance/ProvenanceBadge';
import {
  workspacesApi,
  type PanelLayout,
  type WorkspaceDefinition,
  type WorkspacePage,
} from '../../../services/workspaces';
import type { WidgetDefinition } from '@hubblewave/shared-types/widget-contract';
import { PanelPalette } from './PanelPalette';
import { WorkspaceCanvas } from './WorkspaceCanvas';
import { PanelConfigEditor } from './PanelConfigEditor';

/**
 * Plan §10.2 — Workspace Builder shell. Three-pane layout:
 *
 *   [pages list] [canvas] [palette + selected-panel inspector]
 *
 * Route: /studio/workspaces/:workspaceId (and /studio/workspaces for the list page)
 *
 * Save semantics: per-page persistence. The `Save layout` button
 * upserts the active page's panels via the workspace pages
 * endpoint. Publishing flips the parent workspace to published
 * (`/workspaces/:id/publish`); the runtime renderer only serves
 * published-and-active workspaces.
 */
export const WorkspaceBuilder: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceDefinition | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [draftLayout, setDraftLayout] = useState<PanelLayout[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const ws = await workspacesApi.get(workspaceId);
      setWorkspace(ws);
      const first = ws.pages?.[0];
      if (first) {
        setActivePageId(first.id);
        setDraftLayout(first.layout ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activePage = useMemo<WorkspacePage | null>(
    () => workspace?.pages?.find((p) => p.id === activePageId) ?? null,
    [workspace, activePageId],
  );

  const onSwitchPage = useCallback(
    (pageId: string) => {
      setActivePageId(pageId);
      setSelectedPanelId(null);
      const page = workspace?.pages?.find((p) => p.id === pageId);
      setDraftLayout(page?.layout ?? []);
    },
    [workspace],
  );

  const onAddPanel = useCallback(
    (panel: WidgetDefinition) => {
      const id = `panel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newPanel: PanelLayout = {
        id,
        panelCode: panel.code,
        config: panel.inputs.reduce<Record<string, unknown>>((acc, input) => {
          if (input.defaultValue !== undefined) acc[input.name] = input.defaultValue;
          return acc;
        }, {}),
        x: 0,
        y: Number.MAX_SAFE_INTEGER, // append-bottom; rgl will clamp
        w: 6,
        h: 4,
      };
      setDraftLayout((prev) => [...prev, newPanel]);
      setSelectedPanelId(id);
    },
    [],
  );

  const onRemovePanel = useCallback((id: string) => {
    setDraftLayout((prev) => prev.filter((p) => p.id !== id));
    setSelectedPanelId((current) => (current === id ? null : current));
  }, []);

  const onUpdateSelected = useCallback((next: PanelLayout) => {
    setDraftLayout((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }, []);

  const onSaveLayout = useCallback(async () => {
    if (!workspace || !activePage) return;
    setSaving(true);
    setError(null);
    try {
      await workspacesApi.upsertPage(workspace.id, activePage.id, {
        code: activePage.code,
        name: activePage.name,
        kind: activePage.kind,
        position: activePage.position,
        layout: draftLayout,
        collectionId: activePage.collectionId,
        source: activePage.source,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [workspace, activePage, draftLayout, load]);

  const onPublish = useCallback(async () => {
    if (!workspace) return;
    setSaving(true);
    setError(null);
    try {
      await workspacesApi.publish(workspace.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setSaving(false);
    }
  }, [workspace, load]);

  const onToggleActive = useCallback(async () => {
    if (!workspace) return;
    setSaving(true);
    setError(null);
    try {
      await workspacesApi.toggleActive(workspace.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation toggle failed');
    } finally {
      setSaving(false);
    }
  }, [workspace, load]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 size={14} className="mr-2 animate-spin" />
        Loading workspace...
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="m-6 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? 'Workspace not found'}
      </div>
    );
  }

  const selectedPanel = draftLayout.find((p) => p.id === selectedPanelId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-foreground">{workspace.name}</h1>
            <ProvenanceBadge source={workspace.source} size="compact" />
          </div>
          <p className="text-xs text-muted-foreground">
            <code>{workspace.code}</code> | {workspace.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void onSaveLayout()} disabled={saving || !activePage}>
            <Save size={14} />
            Save layout
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onPublish()}
            disabled={saving || workspace.status === 'published'}
            title={
              workspace.status === 'published'
                ? 'Already published'
                : 'Validate every page and flip workspace to published'
            }
          >
            <Upload size={14} />
            Publish
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onToggleActive()}
            disabled={saving || (!workspace.isActive && workspace.status !== 'published')}
            title={
              workspace.isActive
                ? 'Deactivate - runtime stops serving this workspace'
                : workspace.status !== 'published'
                ? 'Publish before activating'
                : 'Activate - runtime starts serving this workspace at /workspace/' + workspace.code
            }
          >
            {workspace.isActive ? <PowerOff size={14} /> : <Power size={14} />}
            {workspace.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </header>

      {error ? (
        <div className="m-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-[180px_1fr_280px] overflow-hidden">
        <aside className="overflow-auto border-r border-border bg-muted/20">
          <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pages
          </h3>
          <ul className="space-y-1 px-2 pb-3">
            {(workspace.pages ?? []).map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => onSwitchPage(page.id)}
                  className={[
                    'w-full rounded px-2 py-1 text-left text-sm',
                    page.id === activePageId
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  ].join(' ')}
                >
                  <div className="font-medium">{page.name}</div>
                  <div className="text-xs opacity-80">{page.kind}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="overflow-auto bg-muted/10">
          {activePage ? (
            <WorkspaceCanvas
              layout={draftLayout}
              selectedPanelId={selectedPanelId}
              onSelectPanel={setSelectedPanelId}
              onLayoutChange={setDraftLayout}
              onRemovePanel={onRemovePanel}
            />
          ) : (
            <div className="m-6 text-sm text-muted-foreground">No page selected.</div>
          )}
        </main>
        <aside className="overflow-auto border-l border-border bg-card">
          {selectedPanel ? (
            <PanelConfigEditor panel={selectedPanel} onChange={onUpdateSelected} />
          ) : activePage ? (
            <PanelPalette pageKind={activePage.kind} onAdd={onAddPanel} />
          ) : null}
        </aside>
      </div>
    </div>
  );
};
