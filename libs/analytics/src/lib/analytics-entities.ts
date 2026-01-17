import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Analytics Event - Tracks user interactions and system events
 */
@Entity('analytics_events')
@Index(['eventType', 'timestamp'])
@Index(['userId', 'timestamp'])
@Index(['collectionId', 'timestamp'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId?: string;

  @Column({ type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  eventCategory?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  eventAction?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eventLabel?: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  eventValue?: number;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  collectionId?: string;

  @Column({ type: 'uuid', nullable: true })
  recordId?: string;

  @Column({ type: 'uuid', nullable: true })
  moduleId?: string;

  @Column({ type: 'uuid', nullable: true })
  dashboardId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionId?: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'text', nullable: true })
  pageUrl?: string;

  @Column({ type: 'text', nullable: true })
  referrer?: string;

  @Column({ type: 'timestamptz' })
  @Index()
  timestamp!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * Aggregated Metric - Pre-computed metrics for dashboards
 */
@Entity('aggregated_metrics')
@Index(['metricCode', 'periodType', 'periodStart'])
export class AggregatedMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  metricCode!: string;

  @Column({ type: 'varchar', length: 20 })
  periodType!: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

  @Column({ type: 'timestamptz' })
  @Index()
  periodStart!: Date;

  @Column({ type: 'timestamptz' })
  periodEnd!: Date;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  value!: number;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  previousValue?: number;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  changePercent?: number;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  collectionId?: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  moduleId?: string;

  @Column({ type: 'jsonb', nullable: true })
  dimensions?: Record<string, string>;

  @Column({ type: 'int', default: 1 })
  sampleCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * Report Column Definition
 */
export interface ReportColumn {
  id: string;
  propertyCode: string;
  label: string;
  visible?: boolean;
  format?: string;
  align?: 'left' | 'center' | 'right';
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

/**
 * Report Filter Definition
 */
export interface ReportFilter {
  field: string;
  operator: string;
  value: unknown;
  conjunction?: 'and' | 'or';
}

/**
 * Report Sorting Definition
 */
export interface ReportSorting {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Report Grouping Definition
 */
export interface ReportGrouping {
  fields: string[];
  showGrandTotal?: boolean;
}

/**
 * Report Data Source Definition
 */
export interface ReportDataSource {
  type: 'collection' | 'query' | 'api';
  collectionIds?: string[];
  customQuery?: string;
  apiEndpoint?: string;
}

/**
 * Report - Saved report definitions
 */
@Entity('reports')
@Index(['moduleId', 'isActive'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  moduleId?: string;

  @Column({ type: 'jsonb' })
  dataSource!: ReportDataSource;

  @Column({ type: 'jsonb', nullable: true })
  columns?: ReportColumn[];

  @Column({ type: 'jsonb', nullable: true })
  filters?: ReportFilter[];

  @Column({ type: 'jsonb', nullable: true })
  sorting?: ReportSorting[];

  @Column({ type: 'jsonb', nullable: true })
  grouping?: ReportGrouping;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
