// libs/instance-db/src/lib/entities/analytics.ts
//
// Analytics-area entities: analytics events, aggregated metrics, metric
// definitions, metric points, dashboard definitions, alert definitions,
// and reports.
//
// Public API surface is unchanged — entities continue to be exported via
// the package barrel `@hubblewave/instance-db`. This file exists to make
// area ownership explicit and to ease future code navigation. See Plan
// Fix 24 PR-A for the restructure rationale.

export {
  AnalyticsEvent,
  AggregatedMetric,
  MetricDefinition,
  MetricPoint,
  DashboardDefinition,
  AlertDefinition,
  Report,
} from './analytics.entity';
export type {
  ReportColumn,
  ReportFilter,
  ReportSorting,
  ReportGrouping,
  ReportDataSource,
  DashboardScope,
  MetricCadence,
  MetricAggregation,
  MetricSourceType,
} from './analytics.entity';
