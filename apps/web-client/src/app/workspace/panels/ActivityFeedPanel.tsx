import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PanelShell, PanelPlaceholder } from './PanelShell';
import { useWorkspaceRecord } from '../WorkspaceRecordPageProvider';
import api from '../../../services/api';

interface Props {
  config: Record<string, unknown>;
}

interface AuditEntry {
  id: string;
  userId?: string | null;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  permissionCode?: string | null;
  createdAt: string;
}

/**
 * Audit log entries scoped to the page record. Reads from the
 * `/data/collections/:code/data/:id/audit-log` endpoint and renders
 * each entry as a row with action / actor / timestamp. Newest first.
 * `showAutomations` toggles whether system-actor rows (no userId)
 * mix in with user activity.
 */
export const ActivityFeedPanel: React.FC<Props> = ({ config }) => {
  const record = useWorkspaceRecord();
  const pageSize = (config.pageSize as number | undefined) ?? 20;
  const showAutomations = (config.showAutomations as boolean | undefined) ?? true;

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await api.get<{ entries: AuditEntry[] }>(
          `/data/collections/${record.collectionCode}/data/${record.recordId}/audit-log`,
          { params: { limit: pageSize } },
        );
        if (cancelled) return;
        const all = res.data?.entries ?? [];
        const filtered = showAutomations ? all : all.filter((e) => !!e.userId);
        setEntries(filtered);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load audit log');
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [record, pageSize, showAutomations]);

  if (!record) {
    return (
      <PanelShell title="Activity">
        <PanelPlaceholder message="Open a record to populate the activity feed." />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="Activity"
      subtitle={`${entries.length} entries${showAutomations ? '' : ', user-only'}`}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <PanelPlaceholder message={error} />
      ) : entries.length === 0 ? (
        <PanelPlaceholder message="No audit entries yet." />
      ) : (
        <ul className="space-y-2 px-3 py-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded border border-border bg-muted/20 p-2 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="font-medium text-foreground">{entry.action}</span>
                <span className="text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-muted-foreground">
                {entry.userId ? `by ${entry.userId.slice(0, 8)}…` : 'system'}
                {entry.permissionCode ? ` · ${entry.permissionCode}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};
