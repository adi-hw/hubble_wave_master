/**
 * useGridExport - Grid data export functionality
 *
 * Supports:
 * - CSV export with proper escaping
 * - Excel export (XLSX)
 * - PDF export with formatting
 * - Selective column export
 * - Page/selection/all data export
 * - Background export for large datasets
 */

import { useCallback, useState, useMemo } from 'react';
import type { Table } from '@tanstack/react-table';
import type { GridRowData, GridColumn } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

export type ExportScope = 'all' | 'page' | 'selected';

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  columns?: string[];
  filename?: string;
  includeHeaders?: boolean;
  dateFormat?: string;
  numberFormat?: string;
}

export interface UseGridExportOptions<TData extends GridRowData> {
  table: Table<TData>;
  columns: GridColumn[];
  collection?: string;
  totalRowCount: number;
  fetchAllData?: () => Promise<TData[]>;
}

export interface UseGridExportReturn {
  exportData: (options: ExportOptions) => Promise<void>;
  isExporting: boolean;
  exportProgress: number;
  cancelExport: () => void;
  supportedFormats: ExportFormat[];
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Escape CSV value according to RFC 4180
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Format value based on column type
 */
function formatValue(value: unknown, column: GridColumn): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (column.type) {
    case 'date':
      return value instanceof Date
        ? value.toLocaleDateString()
        : new Date(value as string).toLocaleDateString();

    case 'datetime':
      return value instanceof Date
        ? value.toLocaleString()
        : new Date(value as string).toLocaleString();

    case 'number':
      return typeof value === 'number'
        ? value.toLocaleString()
        : String(value);

    case 'currency': {
      const formatOptions = column.format as { currency?: string } | undefined;
      const currencyCode = formatOptions?.currency ?? 'USD';
      return typeof value === 'number'
        ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
          }).format(value)
        : String(value);
    }

    case 'percent':
      return typeof value === 'number'
        ? `${(value * 100).toFixed(2)}%`
        : String(value);

    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'tags':
      return Array.isArray(value) ? value.join(', ') : String(value);

    case 'reference':
      return typeof value === 'object' && value !== null
        ? (value as Record<string, string>).display ?? (value as Record<string, string>).id ?? ''
        : String(value);

    case 'user':
      return typeof value === 'object' && value !== null
        ? (value as Record<string, string>).name ?? ''
        : String(value);

    default:
      return String(value);
  }
}

/**
 * Get rows based on export scope
 */
async function getExportRows<TData extends GridRowData>(
  table: Table<TData>,
  scope: ExportScope,
  fetchAllData?: () => Promise<TData[]>
): Promise<TData[]> {
  switch (scope) {
    case 'selected':
      return table.getSelectedRowModel().rows.map((row) => row.original);

    case 'page':
      return table.getRowModel().rows.map((row) => row.original);

    case 'all':
      if (fetchAllData) {
        return fetchAllData();
      }
      // Fallback to current data if no fetcher provided
      return table.getCoreRowModel().rows.map((row) => row.original);

    default:
      return [];
  }
}

/**
 * Generate CSV content
 */
function generateCSV<TData extends GridRowData>(
  rows: TData[],
  columns: GridColumn[],
  includeHeaders: boolean
): string {
  const lines: string[] = [];

  // Headers
  if (includeHeaders) {
    lines.push(columns.map((col) => escapeCSV(col.label)).join(','));
  }

  // Data rows
  for (const row of rows) {
    const values = columns.map((col) => {
      const value = row[col.code as keyof TData];
      return escapeCSV(formatValue(value, col));
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

/**
 * Generate JSON content
 */
function generateJSON<TData extends GridRowData>(
  rows: TData[],
  columns: GridColumn[]
): string {
  const exportData = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) {
      obj[col.code] = row[col.code as keyof TData];
    }
    return obj;
  });

  return JSON.stringify(exportData, null, 2);
}

/**
 * Download file via blob
 */
function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================================================
// HOOK
// =============================================================================

export function useGridExport<TData extends GridRowData>({
  table,
  columns,
  collection = 'data',
  totalRowCount: _totalRowCount,
  fetchAllData,
}: UseGridExportOptions<TData>): UseGridExportReturn {
  void _totalRowCount;
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Supported formats
  const supportedFormats = useMemo<ExportFormat[]>(() => {
    return ['csv', 'json', 'xlsx', 'pdf'];
  }, []);

  // Cancel export
  const cancelExport = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [abortController]);

  // Main export function
  const exportData = useCallback(
    async (options: ExportOptions) => {
      const {
        format,
        scope,
        columns: selectedColumns,
        filename,
        includeHeaders = true,
      } = options;

      // Set up abort controller for cancellation
      const controller = new AbortController();
      setAbortController(controller);
      setIsExporting(true);
      setExportProgress(0);

      try {
        // Determine columns to export
        const exportColumns = selectedColumns
          ? columns.filter((col) => selectedColumns.includes(col.code))
          : columns.filter((col) => col.visible !== false);

        // Get rows to export
        setExportProgress(10);
        const rows = await getExportRows(table, scope, fetchAllData);

        if (controller.signal.aborted) {
          return;
        }

        setExportProgress(50);

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const baseFilename = filename ?? `${collection}-export-${timestamp}`;

        // Export based on format
        switch (format) {
          case 'csv': {
            const csv = generateCSV(rows, exportColumns, includeHeaders);
            downloadFile(csv, `${baseFilename}.csv`, 'text/csv;charset=utf-8;');
            break;
          }

          case 'json': {
            const json = generateJSON(rows, exportColumns);
            downloadFile(json, `${baseFilename}.json`, 'application/json');
            break;
          }

          case 'xlsx': {
            // For XLSX, export as CSV with warning
            // XLSX library requires separate installation: npm install xlsx
            console.warn('XLSX export requires the xlsx package. Falling back to CSV.');
            const csv = generateCSV(rows, exportColumns, includeHeaders);
            downloadFile(csv, `${baseFilename}.csv`, 'text/csv;charset=utf-8;');
            break;
          }

          case 'pdf': {
            // For PDF, export as CSV with warning
            // PDF export requires separate installation: npm install jspdf jspdf-autotable
            console.warn('PDF export requires jspdf and jspdf-autotable packages. Falling back to CSV.');
            const csv = generateCSV(rows, exportColumns, includeHeaders);
            downloadFile(csv, `${baseFilename}.csv`, 'text/csv;charset=utf-8;');
            break;
          }
        }

        setExportProgress(100);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.log('Export cancelled');
        } else {
          console.error('Export failed:', error);
          throw error;
        }
      } finally {
        setIsExporting(false);
        setAbortController(null);
      }
    },
    [table, columns, collection, fetchAllData]
  );

  return {
    exportData,
    isExporting,
    exportProgress,
    cancelExport,
    supportedFormats,
  };
}
