import React from 'react';
import { Loader2 } from 'lucide-react';
import { PanelShell, PanelPlaceholder } from './PanelShell';
import { DataGrid } from '../../../components/data/DataGrid';
import { useCollectionRecords } from './useCollectionRecords';

interface Props {
  config: Record<string, unknown>;
}

/**
 * Plan §10.2 — embeds the platform DataGrid (RLS-respecting) for the
 * bound collection. The panel resolves the collection's schema +
 * properties and feeds DataGrid pre-built columns; rows come from
 * the same `/api/data/grid/query` endpoint the runtime ListView
 * uses, so row-level access rules apply identically.
 */
export const RecordListPanel: React.FC<Props> = ({ config }) => {
  const collectionCode = config.collectionCode as string | undefined;
  const viewId = config.viewId as string | undefined;
  const pageSize = (config.pageSize as number | undefined) ?? 25;

  const { rows, columns, loading, error } = useCollectionRecords({
    collectionCode: collectionCode ?? '',
    pageSize,
  });

  if (!collectionCode) {
    return (
      <PanelShell title="Record list">
        <PanelPlaceholder message="Bind a collection in the panel config." />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title={`Records — ${collectionCode}`}
      subtitle={viewId ? `view: ${viewId}` : `${rows.length} loaded`}
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
          emptyMessage="No records match this collection."
          stickyHeader
        />
      )}
    </PanelShell>
  );
};
