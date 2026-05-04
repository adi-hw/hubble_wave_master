import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { composeDisplay } from '@hubblewave/shared-types/condition-evaluator';
import type { ResolvedDisplay } from '@hubblewave/shared-types/condition-evaluator';
import { PanelShell, PanelPlaceholder } from './PanelShell';
import { useWorkspaceRecord } from '../WorkspaceRecordPageProvider';
import api from '../../../services/api';
import { viewApi } from '../../../services/viewApi';
import type { CollectionSchema, CollectionProperty } from './useCollectionRecords';
import type { SimpleFormLayout } from '../../../components/form/designer/layout-utils';

interface ResolvedDisplayRule {
  id: string;
  priority: number;
  isActive: boolean;
  condition: Record<string, unknown>;
  actions: Array<{ action: string; propertyCode: string; value?: unknown }>;
}

interface Props {
  config: Record<string, unknown>;
}

/**
 * Read-only embed of the platform record. The panel:
 *
 * 1. Resolves the form layout via the view engine. When the panel
 *    config supplies `formCode`, the resolver pins to that named
 *    view; otherwise scope/priority resolution picks the best match.
 * 2. Groups schema-readable fields into the resolved tabs / sections
 *    (RLS filters at the schema endpoint, not here).
 * 3. Applies the resolved view's `displayRules` via `composeDisplay`
 *    so a rule that hides `.amount when status='draft'` hides the
 *    field in the panel — matching the runtime record page.
 * 4. Renders the bound record's values read-only with a deep-link
 *    to the editable record page.
 */
export const RecordDetailPanel: React.FC<Props> = ({ config }) => {
  const record = useWorkspaceRecord();
  const formCode = config.formCode as string | undefined;
  const configuredCollectionCode = config.collectionCode as string | undefined;

  const [schema, setSchema] = useState<CollectionSchema | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [layout, setLayout] = useState<SimpleFormLayout | null>(null);
  const [displayRules, setDisplayRules] = useState<ResolvedDisplayRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [schemaRes, dataRes] = await Promise.all([
          api.get<CollectionSchema>(`/data/collections/${record.collectionCode}/schema`),
          api.get<Record<string, unknown>>(
            `/data/collections/${record.collectionCode}/data/${record.recordId}`,
          ),
        ]);
        if (cancelled) return;
        setSchema(schemaRes.data);
        const payload = dataRes.data as Record<string, unknown> & { record?: Record<string, unknown> };
        setData(payload?.record ?? payload ?? null);

        try {
          // Pin the resolver to the configured `formCode` when set
          // so the panel renders the named form rather than the
          // default. The resolver returns the layout AND the
          // collection's published display rules; both must be
          // applied to match runtime record-page behavior.
          const resolved = await viewApi.resolve({
            kind: 'form',
            collection: record.collectionCode,
            code: formCode,
          });
          if (cancelled) return;
          const resolvedLayout = pickLayoutFromResolvedView(resolved as { layout?: unknown });
          setLayout(resolvedLayout);
          const rules = (resolved as { displayRules?: ResolvedDisplayRule[] }).displayRules ?? [];
          setDisplayRules(rules);
        } catch {
          // Layout resolution is optional — fall back to position-sorted fields.
          if (!cancelled) {
            setLayout(null);
            setDisplayRules([]);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load record');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [record, formCode]);

  /**
   * Compose all matching display-rule actions against the loaded
   * record. The shared `composeDisplay` runs identical logic to the
   * runtime record page so a rule that hides `.amount when
   * status='draft'` hides the field here too.
   */
  const display: ResolvedDisplay = useMemo(() => {
    if (!data || displayRules.length === 0) {
      return { hidden: new Set(), mandatory: new Set(), readonly: new Set(), values: new Map() };
    }
    // The resolver hands back rules with action shape `{ action,
    // propertyCode, value }`. composeDisplay expects DisplayAction[]
    // with the same fields; widen through unknown so the literal
    // string actions on the wire satisfy the DisplayActionKind union.
    return composeDisplay(
      displayRules as unknown as Parameters<typeof composeDisplay>[0],
      data,
    );
  }, [displayRules, data]);

  const sections = useMemo<RenderSection[]>(() => {
    const props = schema?.properties ?? [];
    const propByCode = new Map(props.map((p) => [p.code, p]));
    const isHidden = (code: string) => display.hidden.has(code);

    if (layout?.tabs?.length) {
      // Flatten the layout's sections (tabs are presentational only
      // in a panel; we collapse them to a single stack here) and
      // honor field codes that the actor can read. Display-rule-
      // hidden fields drop out here so the panel matches the runtime
      // record page.
      const out: RenderSection[] = [];
      for (const tab of layout.tabs) {
        for (const section of tab.sections ?? []) {
          const fields = (section.fields ?? [])
            .filter((code) => !isHidden(code))
            .map((code) => propByCode.get(code))
            .filter((p): p is CollectionProperty => Boolean(p));
          if (fields.length === 0) continue;
          out.push({
            id: section.id ?? `s-${out.length}`,
            label: section.label ?? tab.label,
            fields,
          });
        }
      }
      if (out.length > 0) return out;
    }
    // No layout — single section with all readable, non-hidden fields by position.
    return [
      {
        id: 'default',
        label: undefined,
        fields: props
          .filter((p) => !isHidden(p.code))
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      },
    ];
  }, [schema, layout, display]);

  if (!record) {
    return (
      <PanelShell title="Record">
        <PanelPlaceholder message="Open a record to populate this detail panel." />
      </PanelShell>
    );
  }
  if (configuredCollectionCode && configuredCollectionCode !== record.collectionCode) {
    return (
      <PanelShell title="Record">
        <PanelPlaceholder
          message={`Panel binds ${configuredCollectionCode} but the page record is in ${record.collectionCode}.`}
        />
      </PanelShell>
    );
  }

  const editParams = new URLSearchParams({ edit: 'true' });
  if (formCode) editParams.set('formCode', formCode);
  const editHref = `/${record.collectionCode}/${record.recordId}?${editParams.toString()}`;

  return (
    <PanelShell
      title={record.collectionCode}
      subtitle={record.recordId.slice(0, 8) + '…'}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <PanelPlaceholder message={error} />
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-auto">
            {sections.map((section) => (
              <div key={section.id} className="border-b border-border last:border-b-0">
                {section.label ? (
                  <h4 className="bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </h4>
                ) : null}
                <dl className="px-3 py-2 text-sm">
                  {section.fields.map((field) => {
                    // setValue display-rule actions take precedence
                    // over the persisted value — same semantics as
                    // the runtime record page.
                    const overridden = display.values.has(field.code);
                    const raw = overridden ? display.values.get(field.code) : data?.[field.code];
                    const isReadonly = display.readonly.has(field.code);
                    return (
                      <div key={field.code} className="border-b border-border py-2 last:border-b-0">
                        <dt className="text-xs text-muted-foreground">
                          {field.label ?? field.name ?? field.code}
                          {display.mandatory.has(field.code) ? (
                            <span className="ml-1 text-destructive">*</span>
                          ) : null}
                          {isReadonly ? (
                            <span className="ml-1 text-muted-foreground">(read-only)</span>
                          ) : null}
                        </dt>
                        <dd className="font-medium text-foreground">{formatValue(raw)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
          <div className="border-t border-border bg-muted/20 px-3 py-2 text-xs">
            <Link to={editHref} className="inline-flex items-center gap-1 text-primary hover:underline">
              Open in record editor <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </PanelShell>
  );
};

interface RenderSection {
  id: string;
  label?: string;
  fields: CollectionProperty[];
}

const pickLayoutFromResolvedView = (view: { layout?: unknown }): SimpleFormLayout | null => {
  if (!view?.layout || typeof view.layout !== 'object') return null;
  const payload = view.layout as Record<string, unknown>;
  const candidate =
    (payload.formLayout as SimpleFormLayout | undefined) ??
    (payload.layout as SimpleFormLayout | undefined);
  if (candidate?.tabs?.length) return candidate;
  // The full designer→runtime translation lives in
  // `components/form/designer/layout-utils.ts` and pulls in extra
  // dependencies the panel doesn't need. If the saved layout uses
  // the v2 designer schema, fall through to no-layout — sections
  // come back as a single position-sorted block.
  return null;
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toLocaleString();
  return JSON.stringify(value);
};
