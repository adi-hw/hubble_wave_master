/**
 * Pivot Transform Service
 * HubbleWave Platform - Phase 2
 *
 * Service for transforming data into pivot table format.
 */

import { Injectable } from '@nestjs/common';
import { TransformConfig } from './transform.service';

export interface PivotRow {
  rowKey: string;
  rowValues: unknown[];
  cells: Record<string, PivotCell>;
  subtotals?: Record<string, number>;
}

export interface PivotCell {
  value: number | string | null;
  count: number;
  originalValues: unknown[];
}

export interface PivotResult {
  rowHeaders: string[];
  columnHeaders: string[];
  rows: PivotRow[];
  totals: Record<string, number>;
  grandTotal: number;
}

@Injectable()
export class PivotTransformService {

  /**
   * Transform records into pivot table format
   */
  transform(
    records: Record<string, unknown>[],
    config: TransformConfig
  ): PivotResult {
    const rows = config.rows || [];
    const columns = config.columns || [];
    const measures = config.measures || [];

    if (rows.length === 0 || measures.length === 0) {
      return this.emptyResult();
    }

    const rowDimensions = rows.map((r) => r.property);
    const columnDimensions = columns.map((c) => c.property);
    const measureConfigs = measures.map((m) => ({
      property: m.property,
      aggregation: m.aggregation || 'sum',
    }));

    const columnValues = this.extractUniqueColumnValues(records, columnDimensions);
    const columnHeaders = this.generateColumnHeaders(columnValues);

    const groupedData = this.groupByDimensions(records, rowDimensions);

    const pivotRows = this.buildPivotRows(
      groupedData,
      rowDimensions,
      columnDimensions,
      columnValues,
      measureConfigs
    );

    const totals = this.calculateTotals(pivotRows, columnHeaders, measureConfigs);
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    return {
      rowHeaders: rowDimensions,
      columnHeaders,
      rows: pivotRows,
      totals,
      grandTotal,
    };
  }

  /**
   * Extract unique values for column dimensions
   */
  private extractUniqueColumnValues(
    records: Record<string, unknown>[],
    dimensions: string[]
  ): Map<string, Set<unknown>> {
    const values = new Map<string, Set<unknown>>();

    for (const dim of dimensions) {
      values.set(dim, new Set());
    }

    for (const record of records) {
      for (const dim of dimensions) {
        const value = record[dim];
        if (value !== null && value !== undefined) {
          values.get(dim)!.add(value);
        }
      }
    }

    return values;
  }

  /**
   * Generate column headers from dimension values
   */
  private generateColumnHeaders(
    values: Map<string, Set<unknown>>
  ): string[] {
    const headers: string[] = [];
    const dimensions = Array.from(values.keys());

    if (dimensions.length === 0) {
      return ['Total'];
    }

    const cartesian = this.cartesianProduct(
      dimensions.map((d) => Array.from(values.get(d)!))
    );

    for (const combination of cartesian) {
      headers.push(combination.map(String).join(' / '));
    }

    return headers;
  }

  /**
   * Group records by row dimensions
   */
  private groupByDimensions(
    records: Record<string, unknown>[],
    dimensions: string[]
  ): Map<string, Record<string, unknown>[]> {
    const groups = new Map<string, Record<string, unknown>[]>();

    for (const record of records) {
      const key = dimensions.map((d) => String(record[d] || '')).join('|');

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    return groups;
  }

  /**
   * Build pivot rows from grouped data
   */
  private buildPivotRows(
    groupedData: Map<string, Record<string, unknown>[]>,
    _rowDimensions: string[],
    columnDimensions: string[],
    columnValues: Map<string, Set<unknown>>,
    measures: { property: string; aggregation: string }[]
  ): PivotRow[] {
    const rows: PivotRow[] = [];

    for (const [key, records] of groupedData) {
      const rowValues = key.split('|');
      const cells: Record<string, PivotCell> = {};

      const columnHeaders = this.generateColumnHeaders(columnValues);

      for (const header of columnHeaders) {
        const headerValues = header.split(' / ');
        const matchingRecords = this.filterByColumnValues(
          records,
          columnDimensions,
          headerValues
        );

        for (const measure of measures) {
          const cellKey = `${header}|${measure.property}`;
          const aggregatedValue = this.aggregate(
            matchingRecords,
            measure.property,
            measure.aggregation
          );

          cells[cellKey] = {
            value: aggregatedValue,
            count: matchingRecords.length,
            originalValues: matchingRecords.map((r) => r[measure.property]),
          };
        }
      }

      rows.push({
        rowKey: key,
        rowValues,
        cells,
        subtotals: this.calculateRowSubtotals(records, measures),
      });
    }

    return rows;
  }

  /**
   * Filter records by column dimension values
   */
  private filterByColumnValues(
    records: Record<string, unknown>[],
    dimensions: string[],
    values: string[]
  ): Record<string, unknown>[] {
    if (dimensions.length === 0) {
      return records;
    }

    return records.filter((record) =>
      dimensions.every((dim, i) => String(record[dim]) === values[i])
    );
  }

  /**
   * Aggregate values based on aggregation type
   */
  private aggregate(
    records: Record<string, unknown>[],
    property: string,
    aggregation: string
  ): number | string | null {
    if (records.length === 0) {
      return null;
    }

    const values = records
      .map((r) => r[property])
      .filter((v) => v !== null && v !== undefined);

    if (values.length === 0) {
      return null;
    }

    switch (aggregation) {
      case 'count':
        return values.length;

      case 'sum': {
        const nums = values.filter((v) => typeof v === 'number') as number[];
        return nums.reduce((a, b) => a + b, 0);
      }

      case 'avg': {
        const nums = values.filter((v) => typeof v === 'number') as number[];
        if (nums.length === 0) return null;
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      }

      case 'min': {
        const nums = values.filter((v) => typeof v === 'number') as number[];
        if (nums.length === 0) return null;
        return Math.min(...nums);
      }

      case 'max': {
        const nums = values.filter((v) => typeof v === 'number') as number[];
        if (nums.length === 0) return null;
        return Math.max(...nums);
      }

      case 'first':
        return String(values[0]);

      case 'last':
        return String(values[values.length - 1]);

      default:
        return values.length;
    }
  }

  /**
   * Calculate row subtotals
   */
  private calculateRowSubtotals(
    records: Record<string, unknown>[],
    measures: { property: string; aggregation: string }[]
  ): Record<string, number> {
    const subtotals: Record<string, number> = {};

    for (const measure of measures) {
      const value = this.aggregate(records, measure.property, measure.aggregation);
      subtotals[measure.property] = typeof value === 'number' ? value : 0;
    }

    return subtotals;
  }

  /**
   * Calculate column totals
   */
  private calculateTotals(
    rows: PivotRow[],
    columnHeaders: string[],
    measures: { property: string; aggregation: string }[]
  ): Record<string, number> {
    const totals: Record<string, number> = {};

    for (const header of columnHeaders) {
      for (const measure of measures) {
        const cellKey = `${header}|${measure.property}`;
        totals[cellKey] = 0;

        for (const row of rows) {
          const cell = row.cells[cellKey];
          if (cell && typeof cell.value === 'number') {
            totals[cellKey] += cell.value;
          }
        }
      }
    }

    return totals;
  }

  /**
   * Generate cartesian product of arrays
   */
  private cartesianProduct<T>(arrays: T[][]): T[][] {
    if (arrays.length === 0) {
      return [[]];
    }

    return arrays.reduce<T[][]>(
      (acc, arr) =>
        acc.flatMap((prefix) => arr.map((item) => [...prefix, item])),
      [[]]
    );
  }

  /**
   * Return empty result structure
   */
  private emptyResult(): PivotResult {
    return {
      rowHeaders: [],
      columnHeaders: [],
      rows: [],
      totals: {},
      grandTotal: 0,
    };
  }
}
