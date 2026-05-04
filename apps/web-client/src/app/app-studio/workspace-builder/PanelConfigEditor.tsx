import React from 'react';
import {
  findPanelByCode,
  type WidgetParamSpec,
} from '@hubblewave/shared-types/widget-contract';
import type { PanelLayout } from '../../../services/workspaces';

interface Props {
  panel: PanelLayout;
  onChange: (next: PanelLayout) => void;
}

const renderJsonField = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
};

const commitJsonField = (raw: string): unknown => {
  if (raw.trim() === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

/**
 * Renders the catalog-declared inputs for the selected panel as a
 * typed form. Each input runs through `commit*` so JSON / array
 * fields persist as their parsed values rather than raw strings —
 * the Phase 4.7 ActionBuilder pattern.
 */
export const PanelConfigEditor: React.FC<Props> = ({ panel, onChange }) => {
  const def = findPanelByCode(panel.panelCode);
  if (!def) {
    return (
      <p className="text-xs text-destructive">
        Unknown panel code <code>{panel.panelCode}</code>; remove and re-add.
      </p>
    );
  }

  const setField = (name: string, value: unknown) => {
    onChange({ ...panel, config: { ...panel.config, [name]: value } });
  };

  return (
    <div className="space-y-3">
      <div className="rounded border border-border bg-muted/30 p-3 text-xs">
        <div className="font-medium text-foreground">{def.name}</div>
        <div className="text-muted-foreground">{def.description}</div>
      </div>
      {def.inputs.map((spec) => (
        <PanelInput
          key={spec.name}
          spec={spec}
          value={panel.config[spec.name]}
          onChange={(next) => setField(spec.name, next)}
        />
      ))}
    </div>
  );
};

const PanelInput: React.FC<{
  spec: WidgetParamSpec;
  value: unknown;
  onChange: (next: unknown) => void;
}> = ({ spec, value, onChange }) => {
  const labelText = `${spec.name}${spec.required ? ' *' : ''}`;
  const baseProps = {
    className:
      'w-full rounded border border-border bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40',
  };
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{labelText}</label>
      {spec.description ? (
        <p className="mb-1 text-xs text-muted-foreground">{spec.description}</p>
      ) : null}
      {(() => {
        switch (spec.type) {
          case 'boolean':
            return (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
              />
            );
          case 'integer':
            return (
              <input
                {...baseProps}
                type="number"
                value={(value as number | undefined) ?? ''}
                onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
              />
            );
          case 'array':
            return (
              <textarea
                {...baseProps}
                rows={3}
                value={renderJsonField(value)}
                onChange={(e) => onChange(commitJsonField(e.target.value))}
                placeholder='["item1", "item2"]'
              />
            );
          case 'json':
            return (
              <textarea
                {...baseProps}
                rows={4}
                value={renderJsonField(value)}
                onChange={(e) => onChange(commitJsonField(e.target.value))}
                placeholder='{"key": "value"}'
              />
            );
          default:
            return (
              <input
                {...baseProps}
                type="text"
                value={(value as string | undefined) ?? ''}
                onChange={(e) => onChange(e.target.value)}
              />
            );
        }
      })()}
    </div>
  );
};
