/**
 * TanStack Table Meta Type Declarations
 *
 * This file extends TanStack Table's type system with HubbleDataGrid-specific
 * metadata for columns and tables. These types enable type-safe access to
 * custom column properties like alignment, PHI indicators, and filter variants.
 */

import '@tanstack/react-table';
import type { RowData } from '@tanstack/react-table';

declare module '@tanstack/react-table' {
  /**
   * Column-level metadata for HubbleDataGrid columns
   */
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Column data type for cell rendering */
    type?: string;
    /** Format string for date/number formatting */
    format?: string;
    /** Options for select/multi-select columns */
    options?: Array<{ value: string; label: string; color?: string }>;
    /** Text alignment within the cell */
    align?: 'left' | 'center' | 'right';
    /** Whether this column contains Protected Health Information */
    containsPHI?: boolean;
    /** Filter UI variant */
    filterVariant?: 'text' | 'select' | 'multi' | 'range' | 'date' | 'boolean';
    /** Validation rules for editable cells */
    validation?: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
      pattern?: RegExp;
      custom?: (value: unknown, row: TData) => string | null;
    };
    /** Actions available in an actions cell */
    actions?: Array<{
      id: string;
      label: string;
      icon?: string;
      onClick: (row: TData) => void;
      disabled?: (row: TData) => boolean;
      hidden?: (row: TData) => boolean;
      variant?: 'default' | 'primary' | 'danger';
    }>;
    /** Whether this column is editable inline */
    editable?: boolean;
    /** Cell tooltip content */
    tooltip?: string | ((value: TValue, row: TData) => string);
    /** Custom CSS class for the column */
    className?: string;
  }

  /**
   * Table-level metadata for HubbleDataGrid
   */
  interface TableMeta<TData extends RowData> {
    /** Handler for updating cell data */
    updateData?: (rowIndex: number, columnId: string, value: unknown) => void;
    /** Handler for deleting a row */
    deleteRow?: (rowIndex: number) => void;
    /** Handler for duplicating a row */
    duplicateRow?: (rowIndex: number) => void;
    /** The collection/table name being displayed */
    collection?: string;
    /** Whether the grid is in read-only mode */
    readOnly?: boolean;
    /** The current user's ID for permission checks */
    userId?: string;
    /** Function to check if user has permission on a row */
    hasPermission?: (row: TData, action: string) => boolean;
    /** Custom refetch function */
    refetch?: () => void;
  }
}
