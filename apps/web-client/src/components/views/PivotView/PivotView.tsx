/**
 * PivotView Component
 * HubbleWave Platform - Phase 2
 *
 * A pivot table view for aggregating and analyzing data across multiple dimensions.
 * Features expandable rows/columns, multiple aggregation functions, and drill-down.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Settings,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  PivotViewConfig,
  PivotAggregation,
  BaseViewProps,
} from '../types';

interface PivotViewProps extends BaseViewProps<PivotViewConfig> {
  onExport?: () => void;
}

interface PivotCell {
  value: number | string | null;
  count: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
}

interface PivotRow {
  key: string;
  label: string;
  level: number;
  isExpanded: boolean;
  cells: PivotCell[];
  children?: PivotRow[];
}

export const PivotView: React.FC<PivotViewProps> = ({
  config,
  data,
  loading,
  error,
  onRefresh,
  onExport,
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    new Set(config.expandedRows ?? [])
  );

  // Aggregate function implementations
  const aggregateFunctions: Record<PivotAggregation, (values: number[]) => number> = {
    sum: (values) => values.reduce((a, b) => a + b, 0),
    avg: (values) => values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    count: (values) => values.length,
    min: (values) => values.length > 0 ? Math.min(...values) : 0,
    max: (values) => values.length > 0 ? Math.max(...values) : 0,
    first: (values) => values[0] ?? 0,
    last: (values) => values[values.length - 1] ?? 0,
  };

  // Build pivot table structure
  const { pivotData, columnHeaders, rowTotals, grandTotal } = useMemo(() => {
    if (!data.length || !config.rows.length || !config.measures.length) {
      return { pivotData: [], columnHeaders: [], rowTotals: [], grandTotal: null };
    }

    // Get unique values for row and column dimensions
    const getUniqueValues = (property: string): string[] => {
      const values = new Set<string>();
      data.forEach((record) => {
        const value = record[property];
        if (value !== null && value !== undefined) {
          values.add(String(value));
        }
      });
      return Array.from(values).sort();
    };

    // Build column headers
    const colDimension = config.columns[0];
    const colValues = colDimension ? getUniqueValues(colDimension.property) : ['Total'];

    // Build row data with aggregations
    const rowDimension = config.rows[0];
    const rowValues = getUniqueValues(rowDimension.property);

    const pivotRows: PivotRow[] = rowValues.map((rowValue) => {
      const rowRecords = data.filter(
        (record) => String(record[rowDimension.property]) === rowValue
      );

      const cells: PivotCell[] = colValues.map((colValue) => {
        const cellRecords = colDimension
          ? rowRecords.filter((record) => String(record[colDimension.property]) === colValue)
          : rowRecords;

        // Calculate aggregation for first measure
        const measure = config.measures[0];
        const values = cellRecords
          .map((r) => r[measure.property])
          .filter((v) => typeof v === 'number') as number[];

        const aggregateFunc = aggregateFunctions[measure.aggregation];
        const value = aggregateFunc(values);

        return {
          value,
          count: cellRecords.length,
        };
      });

      // Add row total
      const allValues = rowRecords
        .map((r) => r[config.measures[0].property])
        .filter((v) => typeof v === 'number') as number[];
      const rowTotal = aggregateFunctions[config.measures[0].aggregation](allValues);

      return {
        key: rowValue,
        label: rowValue,
        level: 0,
        isExpanded: expandedRows.has(rowValue),
        cells: [...cells, { value: rowTotal, count: rowRecords.length, isTotal: true }],
      };
    });

    // Calculate column totals
    const columnTotals: PivotCell[] = colValues.map((colValue) => {
      const colRecords = colDimension
        ? data.filter((record) => String(record[colDimension.property]) === colValue)
        : data;

      const values = colRecords
        .map((r) => r[config.measures[0].property])
        .filter((v) => typeof v === 'number') as number[];

      return {
        value: aggregateFunctions[config.measures[0].aggregation](values),
        count: colRecords.length,
        isTotal: true,
      };
    });

    // Calculate grand total
    const allValues = data
      .map((r) => r[config.measures[0].property])
      .filter((v) => typeof v === 'number') as number[];
    const grandTotalValue = aggregateFunctions[config.measures[0].aggregation](allValues);

    return {
      pivotData: pivotRows,
      columnHeaders: colValues,
      rowTotals: columnTotals,
      grandTotal: { value: grandTotalValue, count: data.length, isTotal: true },
    };
  }, [data, config, expandedRows, aggregateFunctions]);

  // Toggle row expansion
  const toggleRowExpansion = useCallback((rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }, []);

  // Format cell value
  const formatValue = (value: number | string | null, format?: 'number' | 'currency' | 'percent'): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value;

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
      case 'percent':
        return `${(value * 100).toFixed(1)}%`;
      default:
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-base text-muted-foreground">
          Building pivot table...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-destructive">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-base font-medium text-destructive">
          Failed to load pivot table
        </p>
        <p className="text-sm mt-1 text-destructive">
          {error}
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-6 px-4 py-2 rounded-lg font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  // Empty state
  if (!pivotData.length) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <p className="text-base text-muted-foreground">
          No data to display. Configure row and column dimensions.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col rounded-xl overflow-hidden bg-background border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {config.name}
          </h2>
          <span className="text-sm px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {data.length} records
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <button
              onClick={onExport}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Export"
            >
              <Download size={18} />
            </button>
          )}
          <button
            className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Pivot Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {/* Row dimension header */}
              <th className="sticky left-0 top-0 z-20 px-4 py-3 text-left font-medium bg-muted border-b-2 border-b-border border-r border-r-border text-foreground">
                {config.rows[0]?.label ?? config.rows[0]?.property ?? 'Row'}
              </th>
              {/* Column headers */}
              {columnHeaders.map((header) => (
                <th
                  key={header}
                  className="sticky top-0 z-10 px-4 py-3 text-right font-medium min-w-[100px] bg-muted border-b-2 border-b-border text-foreground"
                >
                  {header}
                </th>
              ))}
              {/* Total column header */}
              {config.showTotals !== false && (
                <th className="sticky top-0 z-10 px-4 py-3 text-right font-semibold min-w-[100px] bg-accent border-b-2 border-b-border border-l-2 border-l-border text-foreground">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pivotData.map((row, rowIndex) => (
              <tr
                key={row.key}
                className={`cursor-pointer hover:bg-muted/50 ${rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-muted'}`}
                onClick={() => config.enableDrillDown && toggleRowExpansion(row.key)}
              >
                {/* Row label */}
                <td
                  className={`sticky left-0 px-4 py-2 font-medium border-r border-border text-foreground ${rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted'}`}
                >
                  <div className="flex items-center gap-2">
                    {config.enableDrillDown && (
                      <span className="text-muted-foreground">
                        {row.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                    )}
                    {row.label}
                  </div>
                </td>
                {/* Data cells */}
                {row.cells.slice(0, -1).map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-2 text-right tabular-nums text-foreground"
                  >
                    {formatValue(cell.value, config.measures[0]?.format)}
                  </td>
                ))}
                {/* Row total */}
                {config.showTotals !== false && (
                  <td className="px-4 py-2 text-right font-semibold tabular-nums bg-accent border-l-2 border-l-border text-foreground">
                    {formatValue(row.cells[row.cells.length - 1].value, config.measures[0]?.format)}
                  </td>
                )}
              </tr>
            ))}
            {/* Column totals row */}
            {config.showTotals !== false && (
              <tr className="bg-accent border-t-2 border-t-border">
                <td className="sticky left-0 px-4 py-2 font-semibold bg-accent border-r border-border text-foreground">
                  Total
                </td>
                {rowTotals.map((cell, index) => (
                  <td
                    key={index}
                    className="px-4 py-2 text-right font-semibold tabular-nums text-foreground"
                  >
                    {formatValue(cell.value, config.measures[0]?.format)}
                  </td>
                ))}
                {grandTotal && (
                  <td className="px-4 py-2 text-right font-bold tabular-nums bg-primary text-primary-foreground border-l-2 border-l-border">
                    {formatValue(grandTotal.value, config.measures[0]?.format)}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PivotView;
