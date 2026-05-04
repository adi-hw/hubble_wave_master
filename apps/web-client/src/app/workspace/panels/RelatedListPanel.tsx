import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { PanelShell, PanelPlaceholder } from './PanelShell';
import { DataGrid } from '../../../components/data/DataGrid';
import { useWorkspaceRecord } from '../WorkspaceRecordPageProvider';
import { useCollectionRecords, type FilterClause } from './useCollectionRecords';

interface Props {
  config: Record<string, unknown>;
}

/**
 * Records related to the page record via a reference property. Reads
 * the page record from the workspace record context, then queries
 * `targetCollectionCode` filtered by `foreignKeyProperty = recordId`.
 * The fetcher reuses the same DataGrid + RLS-respecting query
 * pipeline as RecordListPanel; only the filter set differs.
 */
export const RelatedListPanel: React.FC<Props> = ({ config }) => {
  const record = useWorkspaceRecord();
  const targetCollectionCode = config.targetCollectionCode as string | undefined;
  const foreignKeyProperty = config.foreignKeyProperty as string | undefined;
  const pageSize = (config.pageSize as number | undefined) ?? 10;

  const filters = useMemo<FilterClause[]>(() => {
    if (!record || !foreignKeyProperty) return [];
    return [{ column: foreignKeyProperty, operator: 'equals', value: record.recordId }];
  }, [record, foreignKeyProperty]);

  const { rows, columns, loading, error } = useCollectionRecords({
    collectionCode: targetCollectionCode ?? '',
    pageSize,
    filters,
  });

  if (!record) {
    return (
      <PanelShell title="Related records">
        <PanelPlaceholder message="Open a record to populate the related list." />
      </PanelShell>
    );
  }

  if (!targetCollectionCode || !foreignKeyProperty) {
    return (
      <PanelShell title="Related records">
        <PanelPlaceholder message="Bind targetCollectionCode and foreignKeyProperty in the panel config." />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title={`Related ${targetCollectionCode}`}
      subtitle={`${foreignKeyProperty} = ${record.recordId.slice(0, 8)}…`}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <PanelPlaceholder message={error} />
      ) : (
        <DataGrid<Record<string, unknown>>
          data={rows}
          columns={columns}
          rowKey="id"
          emptyMessage="No related records."
          stickyHeader
        />
      )}
    </PanelShell>
  );
};
