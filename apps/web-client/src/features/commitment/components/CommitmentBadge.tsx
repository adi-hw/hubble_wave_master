
import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { AccessTime as TimeIcon, Warning as WarningIcon, Error as ErrorIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { CommitmentTracker } from '../../../services/commitmentApi';

interface CommitmentBadgeProps {
  tracker: CommitmentTracker;
}

export const CommitmentBadge: React.FC<CommitmentBadgeProps> = ({ tracker }) => {
  const getStatusColor = (state: string) => {
    switch (state) {
      case 'active': return 'primary';
      case 'warning': return 'warning';
      case 'breached': return 'error';
      case 'fulfilled': return 'success';
      case 'paused': return 'default';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getIcon = (state: string) => {
    switch (state) {
      case 'active': return <TimeIcon />;
      case 'warning': return <WarningIcon />;
      case 'breached': return <ErrorIcon />;
      case 'fulfilled': return <CheckIcon />;
      default: return undefined;
    }
  };

  const label = tracker.commitmentDefinition?.name || tracker.tracker_type.toUpperCase();
  const targetTime = new Date(tracker.target_at).toLocaleString();

  return (
    <Tooltip title={`Target: ${targetTime}`}>
      <Chip
        icon={getIcon(tracker.state)}
        label={`${label} (${tracker.state})`}
        color={getStatusColor(tracker.state) as any}
        size="small"
        variant={tracker.state === 'paused' ? 'outlined' : 'filled'}
      />
    </Tooltip>
  );
};
