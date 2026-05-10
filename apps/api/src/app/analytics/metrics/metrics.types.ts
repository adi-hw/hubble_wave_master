export type MetricQueryRange = {
  start?: string;
  end?: string;
  limit?: number;
  /**
   * `asc` (default) returns points oldest-first — the natural shape
   * for a chart. `desc` returns newest-first; combined with limit=1
   * this is the cheapest way to read "the latest value" (used by
   * the workspace IndicatorScorecardPanel).
   */
  direction?: 'asc' | 'desc';
};

export type MetricPointResult = {
  metricCode: string;
  periodStart: string;
  periodEnd: string;
  value: number;
};
