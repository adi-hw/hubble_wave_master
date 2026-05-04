/**
 * Plan §10.3 — typed contract for Workspace panels (widgets). Mirrors
 * the Action catalog pattern: each panel declares its config shape,
 * the canvas validates payloads at save time, and the runtime
 * renderer validates again before rendering. Two checkpoints because
 * metadata can drift between save and render (a referenced collection
 * deprecates, a property gets renamed).
 */

export type WidgetParamType =
  | 'string'
  | 'integer'
  | 'boolean'
  | 'reference' // → collection code
  | 'view-id' // → view UUID
  | 'panel-id' // → another panel id on the same page (for cross-panel binding)
  | 'json'
  | 'array';

export interface WidgetParamSpec {
  /** Stable identifier the canvas binds to. */
  name: string;
  type: WidgetParamType;
  /** For `array` type — element type. */
  itemType?: WidgetParamType;
  /** For `reference` type — target collection code (or `*` for any). */
  referenceCollectionCode?: string;
  required: boolean;
  description?: string;
  /** Human-readable default value the editor seeds; never executed. */
  defaultValue?: unknown;
}

export type WidgetCategory =
  | 'data'
  | 'detail'
  | 'navigation'
  | 'metric'
  | 'ai'
  | 'analytics'
  | 'composite';

/**
 * Runtime requirement: which page kinds this panel may sit on. The
 * canvas hides panels whose page-kind set doesn't include the
 * current page; without it, e.g. RecordDetailPanel on a `home` page
 * has no record-context and renders empty.
 */
export type AllowedPageKind = 'home' | 'list' | 'record' | 'search' | 'analytics' | 'custom';

export interface WidgetDefinition {
  code: string;
  name: string;
  description: string;
  category: WidgetCategory;
  /** Page kinds this panel is valid on. */
  allowedPageKinds: ReadonlyArray<AllowedPageKind>;
  inputs: WidgetParamSpec[];
}

/**
 * Plan §10.2 catalog. Every panel referenced by name in the §10.2
 * list ships an entry here. Panels not in this catalog cannot be
 * placed by the builder — the validator rejects them at save time.
 */
export const BUILT_IN_PANELS: ReadonlyArray<WidgetDefinition> = [
  {
    code: 'RecordListPanel',
    name: 'Record List',
    description: 'Embeds the platform DataGrid for the bound collection / view.',
    category: 'data',
    allowedPageKinds: ['home', 'list', 'search', 'custom'],
    inputs: [
      { name: 'collectionCode', type: 'reference', referenceCollectionCode: '*', required: true },
      { name: 'viewId', type: 'view-id', required: false },
      { name: 'pageSize', type: 'integer', required: false, defaultValue: 25 },
    ],
  },
  {
    code: 'RecordDetailPanel',
    name: 'Record Detail',
    description: 'Renders the bound record via the platform Form layout.',
    category: 'detail',
    allowedPageKinds: ['record'],
    inputs: [
      { name: 'collectionCode', type: 'reference', referenceCollectionCode: '*', required: true },
      { name: 'formCode', type: 'string', required: false, description: 'Form code; defaults to the collection default form when omitted' },
    ],
  },
  {
    code: 'MetricsPanel',
    name: 'Metrics',
    description: 'Aggregate metrics card (count / sum / avg over a collection or view).',
    category: 'metric',
    allowedPageKinds: ['home', 'list', 'record', 'analytics', 'custom'],
    inputs: [
      { name: 'collectionCode', type: 'reference', referenceCollectionCode: '*', required: true },
      { name: 'metric', type: 'string', required: true, description: 'Metric code (count, sum, avg)' },
      { name: 'propertyCode', type: 'string', required: false },
      { name: 'filter', type: 'json', required: false },
    ],
  },
  {
    code: 'RelatedListPanel',
    name: 'Related List',
    description: 'Lists records related to the page record via a reference property.',
    category: 'data',
    allowedPageKinds: ['record'],
    inputs: [
      { name: 'targetCollectionCode', type: 'reference', referenceCollectionCode: '*', required: true },
      { name: 'foreignKeyProperty', type: 'string', required: true },
      { name: 'pageSize', type: 'integer', required: false, defaultValue: 10 },
    ],
  },
  {
    code: 'QuickActionsPanel',
    name: 'Quick Actions',
    description: 'Curated buttons that fire Process Flows or open a Form on the page record.',
    category: 'navigation',
    allowedPageKinds: ['record'],
    inputs: [
      { name: 'actions', type: 'array', itemType: 'json', required: true, description: 'Array of { label, kind: flow|form, code }' },
    ],
  },
  {
    code: 'ActivityFeedPanel',
    name: 'Activity Feed',
    description: 'Audit log entries scoped to the page record.',
    category: 'detail',
    allowedPageKinds: ['record'],
    inputs: [
      { name: 'pageSize', type: 'integer', required: false, defaultValue: 20 },
      { name: 'showAutomations', type: 'boolean', required: false, defaultValue: true },
    ],
  },
  {
    code: 'NLQueryPanel',
    name: 'AVA Chat',
    description: 'Natural-language query surface backed by svc-ava.',
    category: 'ai',
    allowedPageKinds: ['home', 'list', 'record', 'search', 'analytics', 'custom'],
    inputs: [
      { name: 'topicCode', type: 'string', required: false, description: 'AVA topic; defaults to platform-wide if omitted' },
    ],
  },
  {
    code: 'IndicatorScorecardPanel',
    name: 'Indicator Scorecard',
    description: 'Renders a curated list of svc-insights indicators as a scorecard.',
    category: 'analytics',
    allowedPageKinds: ['home', 'analytics', 'custom'],
    inputs: [
      { name: 'indicatorCodes', type: 'array', itemType: 'string', required: true },
    ],
  },
  {
    code: 'DashboardsOverviewPanel',
    name: 'Dashboards Overview',
    description: 'Summary tiles linking to dashboards visible to the current user.',
    category: 'analytics',
    allowedPageKinds: ['home', 'analytics', 'custom'],
    inputs: [
      { name: 'maxDashboards', type: 'integer', required: false, defaultValue: 6 },
    ],
  },
];

const PANEL_BY_CODE = new Map(BUILT_IN_PANELS.map((p) => [p.code, p]));
export const findPanelByCode = (code: string): WidgetDefinition | undefined =>
  PANEL_BY_CODE.get(code);

/**
 * Validate a single panel's config against its catalog spec, plus
 * the allowed-page-kind gate. Returns null on success or a string
 * describing the first error. The canvas calls this on save; the
 * runtime renderer calls it again before rendering.
 */
export const validatePanelConfig = (
  panelCode: string,
  config: Readonly<Record<string, unknown>>,
  pageKind: AllowedPageKind,
): string | null => {
  const def = findPanelByCode(panelCode);
  if (!def) return `Unknown panel code: ${panelCode}`;
  if (!def.allowedPageKinds.includes(pageKind)) {
    return `Panel ${panelCode} cannot be placed on a ${pageKind} page (allowed: ${def.allowedPageKinds.join(', ')})`;
  }
  for (const spec of def.inputs) {
    const value = config[spec.name];
    if (value === undefined || value === null || value === '') {
      if (spec.required) {
        return `Panel ${panelCode}: missing required parameter "${spec.name}"`;
      }
      continue;
    }
    const error = validateAgainstType(panelCode, spec, value);
    if (error) return error;
  }
  return null;
};

const validateAgainstType = (
  panelCode: string,
  spec: WidgetParamSpec,
  value: unknown,
): string | null => {
  switch (spec.type) {
    case 'boolean':
      return typeof value === 'boolean' ? null : `Panel ${panelCode}: "${spec.name}" must be a boolean`;
    case 'integer':
      return Number.isInteger(value) ? null : `Panel ${panelCode}: "${spec.name}" must be an integer`;
    case 'string':
    case 'view-id':
    case 'panel-id':
      return typeof value === 'string' && value.length > 0
        ? null
        : `Panel ${panelCode}: "${spec.name}" must be a non-empty string`;
    case 'reference':
      return typeof value === 'string' && value.length > 0
        ? null
        : `Panel ${panelCode}: "${spec.name}" must reference a collection by code`;
    case 'array':
      return Array.isArray(value) ? null : `Panel ${panelCode}: "${spec.name}" must be an array`;
    case 'json':
      return value && typeof value === 'object'
        ? null
        : `Panel ${panelCode}: "${spec.name}" must be an object`;
    default:
      return null;
  }
};

export interface PanelLayoutLite {
  id: string;
  panelCode: string;
  config: Record<string, unknown>;
}

/**
 * Validate every panel on a page in one pass. Returns an array of
 * error messages (empty on success). The canvas surfaces these
 * inline next to each offending panel; the runtime renderer logs
 * them and falls back to placeholder rendering for the broken panel
 * so one misconfigured tile doesn't break the whole page.
 */
export const validatePageLayout = (
  panels: ReadonlyArray<PanelLayoutLite>,
  pageKind: AllowedPageKind,
): Array<{ panelId: string; error: string }> => {
  const errors: Array<{ panelId: string; error: string }> = [];
  for (const panel of panels) {
    const error = validatePanelConfig(panel.panelCode, panel.config, pageKind);
    if (error) {
      errors.push({ panelId: panel.id, error });
    }
  }
  return errors;
};
