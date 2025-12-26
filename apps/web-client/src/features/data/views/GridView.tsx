import { DataGrid, ColumnDef, PaginationState, SortState } from '../../../components/data';
import { PropertyDefinition } from '../../../services/viewApi';
import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GridViewProps {
  data: Record<string, unknown>[];
  properties: PropertyDefinition[];
  loading: boolean;
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  sort: SortState[];
  onSortChange: (sort: SortState[]) => void;
  selectedRows: string[];
  onSelectionChange: (ids: string[]) => void;
  onRefresh: () => void;
  onDelete: () => void;
  collectionCode: string;
}

export function GridView({
  data,
  properties,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
  selectedRows,
  onSelectionChange,
  onRefresh,
  onDelete,
  collectionCode
}: GridViewProps) {
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return properties.slice(0, 10).map((prop) => ({
      id: prop.code,
      header: prop.label,
      accessor: prop.code,
      sortable: true,
      filterable: true,
      formatter: (value: unknown) => {
        if (value === null || value === undefined) return '';

        switch (prop.propertyType || prop['dataType']) { // Handle both naming conventions if any
          case 'boolean':
          case 'checkbox':
            return value ? 'Yes' : 'No';
          case 'date':
            return new Date(String(value)).toLocaleDateString();
          case 'datetime':
            return new Date(String(value)).toLocaleString();
          case 'choice':
          case 'multi_choice':
            // If value is object (populated) or scalar
            return String(value); // Simplified for now
          case 'currency':
             const num = Number(value);
             return isNaN(num) ? String(value) : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
          case 'percent':
          case 'percentage':
            return `${Number(value).toFixed(1)}%`;
          default:
            return String(value);
        }
      },
    }));
  }, [properties]);

  return (
    <DataGrid
      data={data}
      columns={columns}
      loading={loading}
      pagination={pagination}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      sort={sort}
      onSortChange={onSortChange}
      selectable
      selectedRows={selectedRows}
      onSelectionChange={onSelectionChange}
      rowKey="id"
      onRowClick={(row) => navigate(`/data/${collectionCode}/${row.id}`)}
      searchable={false} // Handled by parent
      onRefresh={onRefresh}
      bulkActions={
        selectedRows.length > 0 && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )
      }
      rowActions={() => (
        <div className="flex items-center gap-1">
           {/* Actions */}
        </div>
      )}
    />
  );
}
