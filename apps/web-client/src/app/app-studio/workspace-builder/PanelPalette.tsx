import React from 'react';
import {
  BUILT_IN_PANELS,
  type AllowedPageKind,
  type WidgetDefinition,
} from '@hubblewave/shared-types/widget-contract';

interface Props {
  pageKind: AllowedPageKind;
  onAdd: (panel: WidgetDefinition) => void;
}

/**
 * Plan §10.2 PanelPalette. Lists every panel the catalog allows on
 * the active page kind; clicking adds one to the canvas with its
 * default config. Panels disallowed on the kind are filtered out so
 * authors can't place an invalid combination.
 */
export const PanelPalette: React.FC<Props> = ({ pageKind, onAdd }) => {
  const visible = BUILT_IN_PANELS.filter((p) => p.allowedPageKinds.includes(pageKind));
  return (
    <div className="flex flex-col gap-1 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Panels for {pageKind}
      </h3>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No catalog panels are valid on a {pageKind} page.
        </p>
      ) : null}
      {visible.map((panel) => (
        <button
          key={panel.code}
          type="button"
          onClick={() => onAdd(panel)}
          className="rounded border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary hover:bg-primary/10"
        >
          <div className="font-medium text-foreground">{panel.name}</div>
          <div className="text-xs text-muted-foreground">{panel.description}</div>
        </button>
      ))}
    </div>
  );
};
