/**
 * CommitmentBadge
 * HubbleWave Platform - Phase 3
 *
 * Badge component displaying commitment/SLA tracker status.
 */

import React from 'react';
import { Clock, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { CommitmentTracker } from '../../../services/commitmentApi';

interface CommitmentBadgeProps {
  tracker: CommitmentTracker;
}

export const CommitmentBadge: React.FC<CommitmentBadgeProps> = ({ tracker }) => {
  const getStatusStyles = (state: string) => {
    switch (state) {
      case 'active':
        return {
          backgroundColor: 'var(--hw-accent-primary)',
          color: 'white',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--hw-warning-bg, #fef9c3)',
          borderColor: 'var(--hw-warning-border, #fde047)',
          color: 'var(--hw-warning-text, #a16207)',
        };
      case 'breached':
        return {
          backgroundColor: 'var(--hw-error-bg, #fef2f2)',
          borderColor: 'var(--hw-error-border, #fecaca)',
          color: 'var(--hw-error-text, #dc2626)',
        };
      case 'fulfilled':
        return {
          backgroundColor: 'var(--hw-success-bg, #dcfce7)',
          borderColor: 'var(--hw-success-border, #86efac)',
          color: 'var(--hw-success-text, #166534)',
        };
      case 'paused':
      case 'cancelled':
      default:
        return {
          backgroundColor: 'var(--hw-surface-secondary)',
          borderColor: 'var(--hw-border-default)',
          color: 'var(--hw-text-secondary)',
        };
    }
  };

  const getIcon = (state: string) => {
    switch (state) {
      case 'active':
        return <Clock className="w-3.5 h-3.5" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'breached':
        return <XCircle className="w-3.5 h-3.5" />;
      case 'fulfilled':
        return <CheckCircle className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const label = tracker.commitmentDefinition?.name || tracker.tracker_type.toUpperCase();
  const targetTime = new Date(tracker.target_at).toLocaleString();
  const styles = getStatusStyles(tracker.state);
  const isPaused = tracker.state === 'paused';

  return (
    <span
      title={`Target: ${targetTime}`}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded ${
        isPaused ? 'border' : ''
      }`}
      style={styles}
    >
      {getIcon(tracker.state)}
      {label} ({tracker.state})
    </span>
  );
};
