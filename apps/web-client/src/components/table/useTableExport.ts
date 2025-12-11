import { useCallback } from 'react';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TableColumn } from './types';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

interface ExportOptions {
  filename?: string;
  title?: string;
  columns: TableColumn[];
  includeHidden?: boolean;
}

/**
 * Get cell value from row based on column code
 */
const getCellValue = (row: any, col: TableColumn): string => {
  const raw = row.attributes?.[col.code] ?? row[col.code];

  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'object') return JSON.stringify(raw);

  return String(raw);
};

/**
 * Format data for export
 */
const formatDataForExport = (
  rows: any[],
  columns: TableColumn[],
  includeHidden = false
): { headers: string[]; data: string[][] } => {
  const exportColumns = includeHidden ? columns : columns.filter((c) => !c.hidden);
  const headers = exportColumns.map((c) => c.label);
  const data = rows.map((row) => exportColumns.map((col) => getCellValue(row, col)));

  return { headers, data };
};

/**
 * Export to CSV format
 */
const exportToCSV = (rows: any[], options: ExportOptions): void => {
  const { headers, data } = formatDataForExport(rows, options.columns, options.includeHidden);
  const filename = options.filename || 'export';

  // Build CSV content
  const escapeCSV = (val: string): string => {
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...data.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');

  // Create and download file
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

/**
 * Export to Excel format using ExcelJS (secure alternative to xlsx)
 */
const exportToExcel = async (rows: any[], options: ExportOptions): Promise<void> => {
  const { headers, data } = formatDataForExport(rows, options.columns, options.includeHidden);
  const filename = options.filename || 'export';

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(options.title || 'Data');

  // Add header row with styling
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' }, // slate-50
  };

  // Add data rows
  data.forEach((row) => {
    worksheet.addRow(row);
  });

  // Set column widths based on content
  worksheet.columns.forEach((column, idx) => {
    const maxDataLen = Math.max(
      headers[idx]?.length || 10,
      ...data.map((row) => (row[idx] || '').length)
    );
    column.width = Math.min(maxDataLen + 2, 50);
  });

  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
};

/**
 * Export to PDF format
 */
const exportToPDF = (rows: any[], options: ExportOptions): void => {
  const { headers, data } = formatDataForExport(rows, options.columns, options.includeHidden);
  const filename = options.filename || 'export';

  // Create PDF document (landscape for better table fit)
  const doc = new jsPDF({
    orientation: data[0]?.length > 5 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add title if provided
  if (options.title) {
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(options.title, 14, 15);
  }

  // Add export date
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Exported on ${new Date().toLocaleDateString()}`, 14, options.title ? 22 : 15);

  // Add table
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: options.title ? 28 : 20,
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: 'linebreak',
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [248, 250, 252], // slate-50
      textColor: [30, 41, 59], // slate-800
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      textColor: [51, 65, 85], // slate-700
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    margin: { top: 10, right: 14, bottom: 10, left: 14 },
    didDrawPage: (data) => {
      // Add page number footer
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    },
  });

  // Save the PDF
  doc.save(`${filename}.pdf`);
};

/**
 * Main export function
 */
const exportData = async (
  format: ExportFormat,
  rows: any[],
  options: ExportOptions
): Promise<void> => {
  switch (format) {
    case 'csv':
      exportToCSV(rows, options);
      break;
    case 'xlsx':
      await exportToExcel(rows, options);
      break;
    case 'pdf':
      exportToPDF(rows, options);
      break;
  }
};

interface UseTableExportOptions {
  columns: TableColumn[];
  filename?: string;
  title?: string;
}

interface UseTableExportReturn {
  /** Export data in specified format */
  exportAs: (format: ExportFormat, rows: any[]) => Promise<void>;
  /** Export all data to CSV */
  exportCSV: (rows: any[]) => void;
  /** Export all data to Excel */
  exportExcel: (rows: any[]) => Promise<void>;
  /** Export all data to PDF */
  exportPDF: (rows: any[]) => void;
}

/**
 * Hook for table export functionality
 */
export const useTableExport = (options: UseTableExportOptions): UseTableExportReturn => {
  const { columns, filename = 'export', title } = options;

  const exportAs = useCallback(
    async (format: ExportFormat, rows: any[]) => {
      await exportData(format, rows, { columns, filename, title });
    },
    [columns, filename, title]
  );

  const exportCSV = useCallback(
    (rows: any[]) => {
      exportToCSV(rows, { columns, filename, title });
    },
    [columns, filename, title]
  );

  const exportExcel = useCallback(
    async (rows: any[]) => {
      await exportToExcel(rows, { columns, filename, title });
    },
    [columns, filename, title]
  );

  const exportPDF = useCallback(
    (rows: any[]) => {
      exportToPDF(rows, { columns, filename, title });
    },
    [columns, filename, title]
  );

  return {
    exportAs,
    exportCSV,
    exportExcel,
    exportPDF,
  };
};
