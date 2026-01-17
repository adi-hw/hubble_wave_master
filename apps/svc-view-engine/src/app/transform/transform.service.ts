/**
 * Transform Service
 * HubbleWave Platform - Phase 2
 *
 * Main service for transforming data for different view types.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PivotTransformService } from './pivot-transform.service';
import { TimelineTransformService } from './timeline-transform.service';

export type ViewType =
  | 'list'
  | 'kanban'
  | 'calendar'
  | 'gallery'
  | 'timeline'
  | 'pivot'
  | 'gantt'
  | 'map';

export interface TransformConfig {
  viewType: ViewType;
  groupByProperty?: string;
  titleProperty?: string;
  startDateProperty?: string;
  endDateProperty?: string;
  colorProperty?: string;
  latitudeProperty?: string;
  longitudeProperty?: string;
  rows?: { property: string }[];
  columns?: { property: string }[];
  measures?: { property: string; aggregation: string }[];
  customConfig?: Record<string, unknown>;
}

export interface TransformResult {
  data: unknown;
  metadata: {
    totalRecords: number;
    transformedAt: Date;
    viewType: ViewType;
  };
}

@Injectable()
export class TransformService {
  private readonly logger = new Logger(TransformService.name);

  constructor(
    private readonly pivotTransform: PivotTransformService,
    private readonly timelineTransform: TimelineTransformService
  ) {}

  /**
   * Transform data for a specific view type
   */
  async transform(
    records: Record<string, unknown>[],
    config: TransformConfig
  ): Promise<TransformResult> {
    const startTime = Date.now();

    let transformedData: unknown;

    switch (config.viewType) {
      case 'list':
        transformedData = this.transformForList(records, config);
        break;
      case 'kanban':
        transformedData = this.transformForKanban(records, config);
        break;
      case 'calendar':
        transformedData = this.transformForCalendar(records, config);
        break;
      case 'gallery':
        transformedData = this.transformForGallery(records, config);
        break;
      case 'timeline':
        transformedData = this.timelineTransform.transform(records, config);
        break;
      case 'pivot':
        transformedData = this.pivotTransform.transform(records, config);
        break;
      case 'gantt':
        transformedData = this.transformForGantt(records, config);
        break;
      case 'map':
        transformedData = this.transformForMap(records, config);
        break;
      default:
        transformedData = records;
    }

    this.logger.debug(
      `Transformed ${records.length} records for ${config.viewType} view in ${Date.now() - startTime}ms`
    );

    return {
      data: transformedData,
      metadata: {
        totalRecords: records.length,
        transformedAt: new Date(),
        viewType: config.viewType,
      },
    };
  }

  /**
   * Transform data for list view
   */
  private transformForList(
    records: Record<string, unknown>[],
    _config: TransformConfig
  ): Record<string, unknown>[] {
    return records;
  }

  /**
   * Transform data for kanban view
   */
  private transformForKanban(
    records: Record<string, unknown>[],
    config: TransformConfig
  ): { lanes: { id: string; title: string; cards: Record<string, unknown>[] }[] } {
    const groupByProperty = config.groupByProperty;
    if (!groupByProperty) {
      return { lanes: [{ id: 'all', title: 'All', cards: records }] };
    }

    const groups = new Map<string, Record<string, unknown>[]>();

    for (const record of records) {
      const groupValue = String(record[groupByProperty] || 'Uncategorized');
      if (!groups.has(groupValue)) {
        groups.set(groupValue, []);
      }
      groups.get(groupValue)!.push(record);
    }

    return {
      lanes: Array.from(groups.entries()).map(([title, cards]) => ({
        id: title.toLowerCase().replace(/\s+/g, '_'),
        title,
        cards,
      })),
    };
  }

  /**
   * Transform data for calendar view
   */
  private transformForCalendar(
    records: Record<string, unknown>[],
    config: TransformConfig
  ): { events: { id: string; title: string; start: string; end?: string; allDay?: boolean; color?: string }[] } {
    const { titleProperty, startDateProperty, endDateProperty, colorProperty } = config;

    if (!startDateProperty) {
      return { events: [] };
    }

    const events = records
      .filter((r) => r[startDateProperty])
      .map((record) => ({
        id: String(record.id),
        title: String(record[titleProperty || 'name'] || 'Untitled'),
        start: String(record[startDateProperty]),
        end: endDateProperty ? String(record[endDateProperty] || '') : undefined,
        allDay: !endDateProperty,
        color: colorProperty ? String(record[colorProperty] || '') : undefined,
      }));

    return { events };
  }

  /**
   * Transform data for gallery view
   */
  private transformForGallery(
    records: Record<string, unknown>[],
    config: TransformConfig
  ): { cards: { id: string; title: string; subtitle?: string; image?: string; properties: Record<string, unknown> }[] } {
    const { titleProperty } = config;

    const cards = records.map((record) => ({
      id: String(record.id),
      title: String(record[titleProperty || 'name'] || 'Untitled'),
      subtitle: config.customConfig?.subtitleProperty
        ? String(record[config.customConfig.subtitleProperty as string] || '')
        : undefined,
      image: config.customConfig?.coverImageProperty
        ? String(record[config.customConfig.coverImageProperty as string] || '')
        : undefined,
      properties: record,
    }));

    return { cards };
  }

  /**
   * Transform data for gantt view
   */
  private transformForGantt(
    records: Record<string, unknown>[],
    config: TransformConfig
  ): { tasks: { id: string; title: string; start: Date; end: Date; progress?: number; dependencies?: string[]; parentId?: string }[] } {
    const { titleProperty, startDateProperty, endDateProperty } = config;

    if (!startDateProperty || !endDateProperty) {
      return { tasks: [] };
    }

    const tasks = records
      .filter((r) => r[startDateProperty] && r[endDateProperty])
      .map((record) => ({
        id: String(record.id),
        title: String(record[titleProperty || 'name'] || 'Untitled'),
        start: new Date(String(record[startDateProperty])),
        end: new Date(String(record[endDateProperty])),
        progress: config.customConfig?.progressProperty
          ? Number(record[config.customConfig.progressProperty as string] || 0)
          : undefined,
        dependencies: config.customConfig?.dependencyProperty
          ? (record[config.customConfig.dependencyProperty as string] as string[] | undefined)
          : undefined,
        parentId: config.customConfig?.parentProperty
          ? String(record[config.customConfig.parentProperty as string] || '')
          : undefined,
      }));

    return { tasks };
  }

  /**
   * Transform data for map view
   */
  private transformForMap(
    records: Record<string, unknown>[],
    config: TransformConfig
  ): { markers: { id: string; title: string; lat: number; lng: number; color?: string; properties: Record<string, unknown> }[] } {
    const { titleProperty, latitudeProperty, longitudeProperty, colorProperty } = config;

    if (!latitudeProperty || !longitudeProperty) {
      return { markers: [] };
    }

    const markers = records
      .filter((r) => r[latitudeProperty] !== null && r[longitudeProperty] !== null)
      .map((record) => ({
        id: String(record.id),
        title: String(record[titleProperty || 'name'] || 'Untitled'),
        lat: Number(record[latitudeProperty]),
        lng: Number(record[longitudeProperty]),
        color: colorProperty ? String(record[colorProperty] || '') : undefined,
        properties: record,
      }));

    return { markers };
  }
}
