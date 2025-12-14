import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Application Module - Groups collections into logical modules
 * Examples: IT Service Management, HR, Asset Management, Project Management
 */
@Entity('application_modules')
export class ApplicationModule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @Column({ length: 100 })
  @Index()
  code!: string;

  @Column({ length: 200 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 50, nullable: true })
  icon!: string | null;

  @Column({ length: 7, nullable: true })
  color!: string | null;

  @Column({ length: 200, nullable: true })
  coverImage!: string | null;

  @Column({ length: 100, nullable: true })
  category!: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isSystem!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  collectionIds!: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  featureFlags!: string[] | null;

  @Column({ type: 'json', nullable: true })
  settings!: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  navigation!: ModuleNavigation | null;

  @Column({ type: 'uuid', nullable: true })
  homePageId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export interface ModuleNavigation {
  sections: ModuleNavSection[];
}

export interface ModuleNavSection {
  label: string;
  icon?: string;
  items: ModuleNavItem[];
}

export interface ModuleNavItem {
  type: 'collection' | 'view' | 'dashboard' | 'report' | 'link' | 'separator';
  label?: string;
  icon?: string;
  collectionId?: string;
  viewId?: string;
  dashboardId?: string;
  reportId?: string;
  url?: string;
  openInNewTab?: boolean;
  roles?: string[];
}

/**
 * Dashboard Definition - Custom dashboards with widgets
 */
@Entity('dashboards')
export class Dashboard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  moduleId!: string | null;

  @Column({ length: 100 })
  @Index()
  code!: string;

  @Column({ length: 200 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 50, nullable: true })
  icon!: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isSystem!: boolean;

  @Column({ default: false })
  isPersonal!: boolean;

  @Column({ type: 'uuid', nullable: true })
  ownerId!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  roleIds!: string[] | null;

  @Column({ type: 'json', nullable: true })
  layout!: DashboardLayout | null;

  @Column({ type: 'json', nullable: true })
  settings!: Record<string, unknown> | null;

  @Column({ type: 'int', default: 60 })
  refreshInterval!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export interface DashboardLayout {
  columns: number;
  rows?: number;
  widgets: DashboardWidget[];
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'list' | 'map' | 'calendar' | 'timeline' | 'custom';
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  config: WidgetConfig;
}

export interface WidgetConfig {
  chartType?: 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'scatter' | 'gauge' | 'funnel';
  collectionId?: string;
  viewId?: string;
  reportId?: string;
  dataSource?: WidgetDataSource;
  aggregation?: WidgetAggregation;
  filters?: WidgetFilter[];
  groupBy?: string[];
  sortBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  colors?: string[];
  showLegend?: boolean;
  showLabels?: boolean;
  showValues?: boolean;
  drillDown?: DrillDownConfig;
}

export interface WidgetDataSource {
  type: 'collection' | 'report' | 'api' | 'static';
  collectionCode?: string;
  reportCode?: string;
  endpoint?: string;
  staticData?: unknown[];
}

export interface WidgetAggregation {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
  field?: string;
}

export interface WidgetFilter {
  field: string;
  operator: string;
  value: unknown;
  dynamic?: boolean;
  paramName?: string;
}

export interface DrillDownConfig {
  enabled: boolean;
  targetType: 'collection' | 'view' | 'dashboard' | 'report';
  targetId?: string;
  passFilters?: boolean;
}

/**
 * Report Definition - Custom reports with saved configurations
 */
@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  moduleId!: string | null;

  @Column({ length: 100 })
  @Index()
  code!: string;

  @Column({ length: 200 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 50, nullable: true })
  icon!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'table',
  })
  reportType!: 'table' | 'pivot' | 'chart' | 'summary' | 'detail';

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isSystem!: boolean;

  @Column({ default: false })
  isPersonal!: boolean;

  @Column({ type: 'uuid', nullable: true })
  ownerId!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  roleIds!: string[] | null;

  @Column({ type: 'json' })
  dataSource!: ReportDataSource;

  @Column({ type: 'json', nullable: true })
  columns!: ReportColumn[] | null;

  @Column({ type: 'json', nullable: true })
  filters!: ReportFilter[] | null;

  @Column({ type: 'json', nullable: true })
  parameters!: ReportParameter[] | null;

  @Column({ type: 'json', nullable: true })
  grouping!: ReportGrouping | null;

  @Column({ type: 'json', nullable: true })
  sorting!: ReportSorting[] | null;

  @Column({ type: 'json', nullable: true })
  formatting!: ReportFormatting | null;

  @Column({ type: 'json', nullable: true })
  scheduling!: ReportSchedule | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export interface ReportDataSource {
  type: 'collection' | 'query' | 'api';
  collectionIds?: string[];
  joins?: ReportJoin[];
  customQuery?: string;
  endpoint?: string;
}

export interface ReportJoin {
  fromCollection: string;
  fromField: string;
  toCollection: string;
  toField: string;
  type: 'inner' | 'left' | 'right';
}

export interface ReportColumn {
  id: string;
  propertyCode: string;
  collectionCode?: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: string;
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  formula?: string;
  visible?: boolean;
}

export interface ReportFilter {
  id: string;
  field: string;
  operator: string;
  value: unknown;
  conjunction: 'and' | 'or';
}

export interface ReportParameter {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'choice' | 'reference';
  required: boolean;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
  referenceCollection?: string;
}

export interface ReportGrouping {
  fields: string[];
  showSubtotals: boolean;
  showGrandTotal: boolean;
}

export interface ReportSorting {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ReportFormatting {
  pageSize?: 'A4' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
  header?: string;
  footer?: string;
  showRowNumbers?: boolean;
  alternateRowColors?: boolean;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  timezone: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  includeAttachment?: boolean;
}

/**
 * Analytics Event - Track user activity and metrics
 */
@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId!: string | null;

  @Column({ length: 100 })
  @Index()
  eventType!: string;

  @Column({ length: 100, nullable: true })
  eventCategory!: string | null;

  @Column({ length: 200, nullable: true })
  eventAction!: string | null;

  @Column({ length: 255, nullable: true })
  eventLabel!: string | null;

  @Column({ type: 'float', nullable: true })
  eventValue!: number | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  collectionId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  recordId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  moduleId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  dashboardId!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ length: 255, nullable: true })
  sessionId!: string | null;

  @Column({ length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ length: 500, nullable: true })
  userAgent!: string | null;

  @Column({ length: 2000, nullable: true })
  pageUrl!: string | null;

  @Column({ length: 2000, nullable: true })
  referrer!: string | null;

  @Column({ type: 'timestamp' })
  @Index()
  timestamp!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}

/**
 * Aggregated Metrics - Pre-computed metrics for dashboards
 */
@Entity('aggregated_metrics')
export class AggregatedMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ length: 100 })
  @Index()
  metricCode!: string;

  @Column({ length: 50 })
  @Index()
  periodType!: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

  @Column({ type: 'timestamp' })
  @Index()
  periodStart!: Date;

  @Column({ type: 'timestamp' })
  periodEnd!: Date;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  collectionId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  moduleId!: string | null;

  @Column({ type: 'json', nullable: true })
  dimensions!: Record<string, string> | null;

  @Column({ type: 'float' })
  value!: number;

  @Column({ type: 'float', nullable: true })
  previousValue!: number | null;

  @Column({ type: 'float', nullable: true })
  changePercent!: number | null;

  @Column({ type: 'int', default: 0 })
  sampleCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
