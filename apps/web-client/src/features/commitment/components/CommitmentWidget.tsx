/**
 * CommitmentWidget
 * HubbleWave Platform - Phase 3
 *
 * Dashboard widget displaying a summary of active SLA commitments.
 */

import React from 'react';
import { CommitmentTracker } from '../../../services/commitmentApi';

interface CommitmentWidgetProps {
  trackers?: CommitmentTracker[];
}

export const CommitmentWidget: React.FC<CommitmentWidgetProps> = ({ trackers = [] }) => {
  const getProgressColorClass = (state: string): string => {
    switch (state) {
      case 'breached':
        return 'bg-destructive';
      case 'warning':
        return 'bg-warning';
      default:
        return 'bg-primary';
    }
  };

  return (
    <div
      className="h-full rounded-lg border bg-card border-border"
    >
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-3 text-foreground">
          My Active SLAs
        </h3>

        {trackers.length === 0 ? (
          <p className="text-muted-foreground">No active commitments.</p>
        ) : (
          <div className="space-y-3">
            {trackers.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="pb-3 border-b border-border"
              >
                <div className="text-sm font-medium mb-1 text-foreground">
                  {t.commitmentDefinition?.name}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className={`h-full rounded-full transition-all w-[70%] ${getProgressColorClass(t.state)}`}
                    />
                  </div>
                  <span className="text-xs min-w-[35px] text-muted-foreground">
                    70%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
