import React, { useMemo } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Trash2 } from 'lucide-react';

// WidthProvider sizes the grid from its DOM parent rather than the
// hardcoded width prop, so the canvas adapts to monitor width and
// to the inspector's open/closed state.
const ResponsiveGridLayout = WidthProvider(GridLayout);
import type { PanelLayout } from '../../../services/workspaces';
import { PANEL_REGISTRY } from '../../workspace/panels/registry';
import { PanelShell, PanelPlaceholder } from '../../workspace/panels/PanelShell';
import { DESTRUCTIVE_ICON_BUTTON } from '../../../lib/styling';

interface Props {
  layout: PanelLayout[];
  selectedPanelId: string | null;
  onSelectPanel: (id: string | null) => void;
  onLayoutChange: (next: PanelLayout[]) => void;
  onRemovePanel: (id: string) => void;
}

const COLS = 12;
const ROW_HEIGHT = 60;

/**
 * Plan §10.2 — react-grid-layout-driven canvas. The canonical
 * `PanelLayout[]` x/y/w/h mirrors the library's grid item shape, so
 * the persistence schema and the renderer agree without translation.
 */
export const WorkspaceCanvas: React.FC<Props> = ({
  layout,
  selectedPanelId,
  onSelectPanel,
  onLayoutChange,
  onRemovePanel,
}) => {
  const gridLayout = useMemo(
    () =>
      layout.map((panel) => ({
        i: panel.id,
        x: panel.x,
        y: panel.y,
        w: panel.w,
        h: panel.h,
        minW: 2,
        minH: 2,
      })),
    [layout],
  );

  const handleLayoutChange = (next: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) => {
    const byId = new Map(layout.map((p) => [p.id, p]));
    const updated: PanelLayout[] = [];
    for (const item of next) {
      const original = byId.get(item.i);
      if (!original) continue;
      updated.push({
        ...original,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      });
    }
    onLayoutChange(updated);
  };

  if (layout.length === 0) {
    return (
      <div className="m-6 rounded border border-dashed border-border bg-muted/20 p-12 text-center text-sm text-muted-foreground">
        Empty page. Drop a panel from the palette to start building.
      </div>
    );
  }

  return (
    <ResponsiveGridLayout
      className="layout"
      layout={gridLayout}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      onLayoutChange={handleLayoutChange}
      compactType="vertical"
      preventCollision={false}
      draggableHandle=".panel-drag-handle"
      isResizable
    >
      {layout.map((panel) => {
        const Component = PANEL_REGISTRY[panel.panelCode];
        const selected = selectedPanelId === panel.id;
        return (
          <div
            key={panel.id}
            onClick={() => onSelectPanel(panel.id)}
            className={[
              'overflow-hidden rounded-lg border',
              selected ? 'border-primary ring-2 ring-primary/40' : 'border-transparent',
            ].join(' ')}
          >
            <div className="flex h-full flex-col">
              <div className="panel-drag-handle flex cursor-move items-center justify-between border-b border-border bg-muted/40 px-2 py-1 text-xs">
                <span className="font-medium text-foreground">{panel.panelCode}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePanel(panel.id);
                  }}
                  className={DESTRUCTIVE_ICON_BUTTON}
                  title="Remove panel"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-card">
                {Component ? (
                  <Component config={panel.config} />
                ) : (
                  <PanelShell title={`Unknown panel: ${panel.panelCode}`}>
                    <PanelPlaceholder message="Not in catalog." />
                  </PanelShell>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
};
