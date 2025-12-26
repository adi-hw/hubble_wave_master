
import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText, LinearProgress, Box } from '@mui/material';
import { CommitmentTracker } from '../../../services/commitmentApi';

// Mock data or pass props for now, as Dashboard integration is separate
interface CommitmentWidgetProps {
  trackers?: CommitmentTracker[];
}

export const CommitmentWidget: React.FC<CommitmentWidgetProps> = ({ trackers = [] }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>My Active SLAs</Typography>
        {trackers.length === 0 ? (
          <Typography color="textSecondary">No active commitments.</Typography>
        ) : (
          <List>
            {trackers.slice(0, 5).map((t) => (
              <ListItem key={t.id} divider>
                <ListItemText
                  primary={t.commitmentDefinition?.name}
                  secondary={
                    <Box display="flex" alignItems="center" mt={1}>
                        <Box width="100%" mr={1}>
                            <LinearProgress variant="determinate" value={70} color={t.state === 'breached' ? 'error' : t.state === 'warning' ? 'warning' : 'primary'} />
                        </Box>
                        <Box minWidth={35}>
                            <Typography variant="body2" color="textSecondary">70%</Typography>
                        </Box>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
