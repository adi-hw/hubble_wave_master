import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PanelShell, PanelPlaceholder } from './PanelShell';
import { useWorkspaceRecord } from '../WorkspaceRecordPageProvider';
import { processFlowsService } from '../../../services/process-flows.service';

interface Props {
  config: Record<string, unknown>;
}

interface QuickAction {
  label?: string;
  kind?: 'flow' | 'form';
  code?: string;
}

/**
 * Curated buttons that fire a Process Flow (kind=flow) or open a
 * record form (kind=form) against the page record. `flow` actions
 * call `processFlowsService.trigger` with the record context so the
 * Process Flow engine receives the recordId in its trigger payload.
 * `form` actions navigate to the record's edit URL — admins can
 * point at a custom form code via the action config.
 */
export const QuickActionsPanel: React.FC<Props> = ({ config }) => {
  const record = useWorkspaceRecord();
  const navigate = useNavigate();
  const actions = (config.actions as QuickAction[] | undefined) ?? [];
  const [pending, setPending] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!record) {
    return (
      <PanelShell title="Quick actions">
        <PanelPlaceholder message="Open a record to enable quick actions." />
      </PanelShell>
    );
  }
  if (actions.length === 0) {
    return (
      <PanelShell title="Quick actions">
        <PanelPlaceholder message="No actions configured." />
      </PanelShell>
    );
  }

  const onClick = async (action: QuickAction, idx: number) => {
    if (!action.code) return;
    setFeedback(null);
    if (action.kind === 'form') {
      // Canonical record route is `/:collectionCode/:recordId` and
      // CollectionRecordPage enters edit mode via the `edit=true`
      // query param. The earlier `/data/...` shape was unrouted.
      const params = new URLSearchParams({ edit: 'true' });
      if (action.code) params.set('formCode', action.code);
      navigate(`/${record.collectionCode}/${record.recordId}?${params.toString()}`);
      return;
    }
    setPending(idx);
    try {
      await processFlowsService.triggerByCode(action.code, {
        recordId: record.recordId,
        collectionCode: record.collectionCode,
      });
      setFeedback(`${action.label ?? action.code} fired`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <PanelShell title="Quick actions">
      <div className="flex flex-col gap-2 px-3 py-2">
        {actions.map((action, idx) => {
          const busy = pending === idx;
          return (
            <button
              key={`${action.code ?? 'action'}-${idx}`}
              type="button"
              disabled={busy || !action.code}
              onClick={() => void onClick(action, idx)}
              className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              title={action.code ? `${action.kind ?? 'flow'}:${action.code}` : undefined}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              <div className="flex-1">
                <div className="font-medium text-foreground">{action.label ?? action.code ?? 'Action'}</div>
                {action.kind && action.code ? (
                  <div className="text-xs text-muted-foreground">
                    {action.kind} → {action.code}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
        {feedback ? (
          <div className="text-xs text-muted-foreground">{feedback}</div>
        ) : null}
      </div>
    </PanelShell>
  );
};
