import {
  BUILT_IN_PANELS,
  validatePanelConfig,
  validatePageLayout,
  findPanelByCode,
} from './widget-contract';

describe('Widget contract — Phase 5 §10.3', () => {
  it('catalog includes every panel referenced by plan §10.2', () => {
    const codes = BUILT_IN_PANELS.map((p) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'RecordListPanel',
        'RecordDetailPanel',
        'MetricsPanel',
        'RelatedListPanel',
        'QuickActionsPanel',
        'ActivityFeedPanel',
        'NLQueryPanel',
        'IndicatorScorecardPanel',
        'DashboardsOverviewPanel',
      ]),
    );
  });

  it('findPanelByCode returns undefined for unknown panels', () => {
    expect(findPanelByCode('NonExistent')).toBeUndefined();
  });

  it('rejects an unknown panel code with an actionable error', () => {
    const error = validatePanelConfig('GhostPanel', {}, 'home');
    expect(error).toContain('Unknown panel code');
  });

  it('rejects a panel placed on a disallowed page kind', () => {
    // RecordDetailPanel is record-page only.
    const error = validatePanelConfig(
      'RecordDetailPanel',
      { collectionCode: 'work_orders' },
      'home',
    );
    expect(error).toContain('cannot be placed on a home page');
  });

  it('rejects missing required parameters', () => {
    const error = validatePanelConfig('RecordListPanel', {}, 'home');
    expect(error).toContain('missing required parameter');
    expect(error).toContain('collectionCode');
  });

  it('rejects type mismatches with a clear message', () => {
    const error = validatePanelConfig(
      'RecordListPanel',
      { collectionCode: 'work_orders', pageSize: 'twenty-five' },
      'home',
    );
    expect(error).toContain('pageSize');
    expect(error).toContain('integer');
  });

  it('passes a valid panel config', () => {
    const error = validatePanelConfig(
      'RecordListPanel',
      { collectionCode: 'work_orders', pageSize: 25 },
      'home',
    );
    expect(error).toBeNull();
  });

  it('validatePageLayout returns one error per offending panel and skips valid ones', () => {
    const errors = validatePageLayout(
      [
        { id: 'p1', panelCode: 'RecordListPanel', config: { collectionCode: 'work_orders' } },
        { id: 'p2', panelCode: 'RecordDetailPanel', config: {} }, // missing required
        { id: 'p3', panelCode: 'MetricsPanel', config: { collectionCode: 'tickets', metric: 'count' } },
      ],
      'record',
    );
    expect(errors).toHaveLength(2); // RecordListPanel can't be on record + RecordDetailPanel is missing required
    const ids = errors.map((e) => e.panelId);
    expect(ids).toContain('p2');
  });

  it('NLQueryPanel works on every page kind (allowedPageKinds spans all)', () => {
    for (const kind of ['home', 'list', 'record', 'search', 'analytics', 'custom'] as const) {
      const error = validatePanelConfig('NLQueryPanel', {}, kind);
      expect(error).toBeNull();
    }
  });
});
