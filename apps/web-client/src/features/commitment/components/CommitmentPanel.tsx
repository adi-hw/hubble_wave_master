
import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  IconButton, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction,
  Menu,
  MenuItem,
  CircularProgress
} from '@mui/material';
import { MoreVert as MoreIcon, PlayArrow, Pause, Cancel } from '@mui/icons-material';
import { commitmentApi, CommitmentTracker } from '../../../services/commitmentApi';
import { CommitmentBadge } from './CommitmentBadge';

interface CommitmentPanelProps {
  collectionCode: string;
  recordId: string;
}

export const CommitmentPanel: React.FC<CommitmentPanelProps> = ({ collectionCode, recordId }) => {
  const [trackers, setTrackers] = useState<CommitmentTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTracker, setSelectedTracker] = useState<string | null>(null);

  useEffect(() => {
    loadTrackers();
  }, [collectionCode, recordId]);

  const loadTrackers = async () => {
    try {
      const data = await commitmentApi.getTrackersByRecord(collectionCode, recordId);
      setTrackers(data);
    } catch (error) {
      console.error('Failed to load commitments', error);
    } finally {
        setLoading(false);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, trackerId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedTracker(trackerId);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectedTracker(null);
  };

  const handleAction = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!selectedTracker) return;
    try {
      if (action === 'pause') await commitmentApi.pauseTracker(selectedTracker, 'User paused');
      if (action === 'resume') await commitmentApi.resumeTracker(selectedTracker);
      if (action === 'cancel') await commitmentApi.cancelTracker(selectedTracker, 'User cancelled');
      
      await loadTrackers();
    } catch (error) {
      console.error(`Failed to ${action} tracker`, error);
    }
    handleClose();
  };

  if (loading) return <CircularProgress size={20} />;
  if (trackers.length === 0) return null;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Service Commitments</Typography>
        <List>
          {trackers.map((tracker) => (
            <ListItem key={tracker.id} divider>
              <ListItemText
                primary={tracker.commitmentDefinition?.name || tracker.tracker_type}
                secondary={`Target: ${new Date(tracker.target_at).toLocaleString()}`}
              />
              <Box mr={2}>
                 <CommitmentBadge tracker={tracker} />
              </Box>
              <ListItemSecondaryAction>
                <IconButton edge="end" onClick={(e) => handleMenuClick(e, tracker.id)}>
                  <MoreIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </CardContent>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={() => handleAction('pause')}><Pause fontSize="small" sx={{ mr: 1 }}/> Pause</MenuItem>
        <MenuItem onClick={() => handleAction('resume')}><PlayArrow fontSize="small" sx={{ mr: 1 }}/> Resume</MenuItem>
        <MenuItem onClick={() => handleAction('cancel')}><Cancel fontSize="small" sx={{ mr: 1 }}/> Cancel</MenuItem>
      </Menu>
    </Card>
  );
};
