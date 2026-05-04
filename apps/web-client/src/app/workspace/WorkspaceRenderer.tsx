import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Read-only grid that mirrors the builder's react-grid-layout. Same
// library + same x/y/w/h shape so the runtime view is pixel-identical
// to what the author saw in the builder.
const ReadOnlyGridLayout = WidthProvider(GridLayout);
import {
  workspacesApi,
  type PanelLayout,
  type WorkspaceDefinition,
  type WorkspacePage,
} from '../../services/workspaces';
import { PANEL_REGISTRY } from './panels/registry';
import { PanelShell, PanelPlaceholder } from './panels/PanelShell';
import { WorkspaceRecordPageProvider } from './WorkspaceRecordPageProvider';

/**
 * Plan §10.2 — runtime renderer mounted at:
 *   /workspace/:wsCode
 *   /workspace/:wsCode/record/:collectionCode/:recordId
 *
 * Loads the workspace by code, picks the page (the record route
 * forces the `record` page), resolves the layout via the variant
 * hierarchy, and renders the resolved panels through the registry.
 * The whole render runs read-only — admin authoring lives in
 * WorkspaceBuilder.
 */
export const WorkspaceRenderer: React.FC = () => {
  const params = useParams<{
    wsCode?: string;
    collectionCode?: string;
    recordId?: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceDefinition | null>(null);
  const [layout, setLayout] = useState<PanelLayout[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetPageKind = params.recordId ? 'record' : null;

  // The renderer fetches the workspace by listing all and picking by
  // code. A dedicated by-code endpoint would be more efficient; defer
  // until needed. With typical instance sizes (≤ a handful of
  // workspaces) the cost is negligible.
  useEffect(() => {
    let cancelled = false;
    if (!params.wsCode) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const all = await workspacesApi.list();
        const found = all.find((w) => w.code === params.wsCode);
        if (!found) throw new Error(`Workspace "${params.wsCode}" not found`);
        if (!found.isActive || found.status !== 'published') {
          throw new Error(`Workspace "${params.wsCode}" is not currently active`);
        }
        const full = await workspacesApi.get(found.id);
        if (cancelled) return;
        setWorkspace(full);
        const initialPage = pickPage(full, targetPageKind);
        if (initialPage) {
          setActivePageId(initialPage.id);
          const resolved = await workspacesApi.resolveLayout(full.id, initialPage.id);
          if (!cancelled) setLayout(resolved);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workspace');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.wsCode, targetPageKind]);

  const onSwitchPage = useCallback(
    async (pageId: string) => {
      if (!workspace) return;
      setActivePageId(pageId);
      try {
        const resolved = await workspacesApi.resolveLayout(workspace.id, pageId);
        setLayout(resolved);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to resolve layout');
      }
    },
    [workspace],
  );

  const pages = useMemo(() => workspace?.pages ?? [], [workspace]);
  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? null,
    [pages, activePageId],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 size={14} className="mr-2 animate-spin" />
        Loading workspace…
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="m-6 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? 'Workspace failed to load'}
      </div>
    );
  }

  return (
    <WorkspaceRecordPageProvider>
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">{workspace.name}</h1>
            <p className="text-xs text-muted-foreground">{workspace.description ?? workspace.code}</p>
          </div>
          <nav className="flex gap-1">
            {pages
              .filter((p) => !targetPageKind || p.kind === targetPageKind)
              .map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => void onSwitchPage(page.id)}
                  className={[
                    'rounded px-3 py-1 text-sm transition-colors',
                    page.id === activePageId
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  ].join(' ')}
                >
                  {page.name}
                </button>
              ))}
          </nav>
        </header>
        <main className="flex-1 overflow-auto bg-muted/20 p-4">
          {activePage ? (
            <PanelGrid layout={layout} pageKind={activePage.kind} />
          ) : (
            <div className="text-sm text-muted-foreground">No page selected.</div>
          )}
        </main>
      </div>
    </WorkspaceRecordPageProvider>
  );
};

const pickPage = (
  ws: WorkspaceDefinition,
  preferredKind: 'record' | null,
): WorkspacePage | null => {
  if (!ws.pages || ws.pages.length === 0) return null;
  if (preferredKind) {
    return ws.pages.find((p) => p.kind === preferredKind) ?? null;
  }
  // Default landing: the home page if present, else the first.
  return ws.pages.find((p) => p.kind === 'home') ?? ws.pages[0];
};

/**
 * Read-only react-grid-layout — uses the SAME library and the SAME
 * x/y/w/h coordinates the builder persists. With `isDraggable=false`
 * + `isResizable=false`, the runtime view is a pixel-identical
 * frozen snapshot of the authored layout (vertical compaction +
 * collision rules included).
 */
const PanelGrid: React.FC<{ layout: PanelLayout[]; pageKind: string }> = ({ layout, pageKind }) => {
  if (layout.length === 0) {
    return (
      <PanelShell title={`Empty ${pageKind} page`}>
        <PanelPlaceholder message="No panels placed yet. Open the Workspace Builder to add some." />
      </PanelShell>
    );
  }
  const gridLayout = layout.map((panel) => ({
    i: panel.id,
    x: panel.x,
    y: panel.y,
    w: panel.w,
    h: panel.h,
    static: true,
  }));
  return (
    <ReadOnlyGridLayout
      className="layout"
      layout={gridLayout}
      cols={12}
      rowHeight={60}
      isDraggable={false}
      isResizable={false}
      compactType="vertical"
      margin={[12, 12]}
    >
      {layout.map((panel) => {
        const Component = PANEL_REGISTRY[panel.panelCode];
        return (
          <div key={panel.id} className="overflow-hidden">
            {Component ? (
              <Component config={panel.config} />
            ) : (
              <PanelShell title={`Unknown panel: ${panel.panelCode}`}>
                <PanelPlaceholder message="This panel code isn't in the catalog." />
              </PanelShell>
            )}
          </div>
        );
      })}
    </ReadOnlyGridLayout>
  );
};
