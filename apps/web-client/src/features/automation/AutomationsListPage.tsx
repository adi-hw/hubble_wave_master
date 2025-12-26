import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Container,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, History as HistoryIcon } from '@mui/icons-material';
import { automationApi, Automation } from '../../services/automationApi';

export const AutomationsListPage: React.FC = () => {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAutomations();
  }, [collectionId]);

  const loadAutomations = async () => {
    if (!collectionId) return;
    try {
      const data = await automationApi.getAutomations(collectionId, true);
      setAutomations(data);
    } catch (error) {
      console.error('Failed to load automations', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (automation: Automation) => {
    try {
      await automationApi.toggleActive(automation.id);
      loadAutomations();
    } catch (error) {
      console.error('Failed to toggle automation', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this automation?')) return;
    try {
      await automationApi.deleteAutomation(id);
      loadAutomations();
    } catch (error) {
      console.error('Failed to delete automation', error);
    }
  };

  if (loading) return <Typography>Loading automations...</Typography>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Automations</Typography>
        <Box>
            <Button
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => navigate(`/studio/collections/${collectionId}/automation-logs`)}
                sx={{ mr: 2 }}
            >
                Logs
            </Button>
            <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate(`/studio/collections/${collectionId}/automations/new`)}
            >
            New Automation
            </Button>
        </Box>
      </Box>

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Trigger</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Run</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {automations.map((automation) => (
              <TableRow key={automation.id}>
                <TableCell>
                  <Typography variant="subtitle2">{automation.name}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {automation.actionType}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={automation.triggerTiming.replace('_', ' ').toUpperCase()}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  {automation.executionOrder > 0 && (
                      <Typography variant="caption" display="block">Order: {automation.executionOrder}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={automation.isActive}
                        onChange={() => handleToggleActive(automation)}
                        size="small"
                      />
                    }
                    label={automation.isActive ? 'Active' : 'Inactive'}
                  />
                </TableCell>
                <TableCell>
                  {automation.lastRunAt ? (
                    <Box>
                      <Typography variant="body2">
                        {new Date(automation.lastRunAt).toLocaleString()}
                      </Typography>
                      <Chip
                        label={automation.lastRunStatus}
                        size="small"
                        color={automation.lastRunStatus === 'success' ? 'success' : 'error'}
                      />
                    </Box>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() =>
                      navigate(`/studio/collections/${collectionId}/automations/${automation.id}`)
                    }
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(automation.id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {automations.length === 0 && (
                <TableRow>
                    <TableCell colSpan={5} align="center">
                        No automations found. Create one to get started.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </Container>
  );
};
