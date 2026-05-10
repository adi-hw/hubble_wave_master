/**
 * Timeline Transform Service
 * HubbleWave Platform - Phase 2
 *
 * Service for transforming data into timeline format.
 */

import { Injectable } from '@nestjs/common';
import { TransformConfig } from './transform.service';

export interface TimelineItem {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  group?: string;
  color?: string;
  properties: Record<string, unknown>;
}

export interface TimelineGroup {
  id: string;
  title: string;
  items: TimelineItem[];
}

export interface TimelineResult {
  items: TimelineItem[];
  groups: TimelineGroup[];
  timeRange: {
    start: Date;
    end: Date;
  };
  metadata: {
    totalItems: number;
    groupCount: number;
  };
}

@Injectable()
export class TimelineTransformService {

  /**
   * Transform records into timeline format
   */
  transform(
    records: Record<string, unknown>[],
    config: TransformConfig
  ): TimelineResult {
    const {
      titleProperty,
      startDateProperty,
      endDateProperty,
      groupByProperty,
      colorProperty,
    } = config;

    if (!startDateProperty) {
      return this.emptyResult();
    }

    const items: TimelineItem[] = [];
    const groupsMap = new Map<string, TimelineItem[]>();

    for (const record of records) {
      const startValue = record[startDateProperty];
      if (!startValue) continue;

      const item: TimelineItem = {
        id: String(record.id),
        title: String(record[titleProperty || 'name'] || 'Untitled'),
        start: new Date(String(startValue)),
        end: endDateProperty && record[endDateProperty]
          ? new Date(String(record[endDateProperty]))
          : undefined,
        group: groupByProperty
          ? String(record[groupByProperty] || 'Uncategorized')
          : undefined,
        color: colorProperty ? String(record[colorProperty] || '') : undefined,
        properties: record,
      };

      items.push(item);

      if (groupByProperty) {
        const groupKey = item.group || 'Uncategorized';
        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, []);
        }
        groupsMap.get(groupKey)!.push(item);
      }
    }

    items.sort((a, b) => a.start.getTime() - b.start.getTime());

    const groups: TimelineGroup[] = Array.from(groupsMap.entries())
      .map(([title, groupItems]) => ({
        id: title.toLowerCase().replace(/\s+/g, '_'),
        title,
        items: groupItems.sort((a, b) => a.start.getTime() - b.start.getTime()),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    const timeRange = this.calculateTimeRange(items);

    return {
      items,
      groups,
      timeRange,
      metadata: {
        totalItems: items.length,
        groupCount: groups.length,
      },
    };
  }

  /**
   * Calculate the time range for all items
   */
  private calculateTimeRange(items: TimelineItem[]): { start: Date; end: Date } {
    if (items.length === 0) {
      const now = new Date();
      return { start: now, end: now };
    }

    let minDate = items[0].start;
    let maxDate = items[0].end || items[0].start;

    for (const item of items) {
      if (item.start < minDate) {
        minDate = item.start;
      }
      const endDate = item.end || item.start;
      if (endDate > maxDate) {
        maxDate = endDate;
      }
    }

    return { start: minDate, end: maxDate };
  }

  /**
   * Return empty result structure
   */
  private emptyResult(): TimelineResult {
    const now = new Date();
    return {
      items: [],
      groups: [],
      timeRange: { start: now, end: now },
      metadata: { totalItems: 0, groupCount: 0 },
    };
  }
}
