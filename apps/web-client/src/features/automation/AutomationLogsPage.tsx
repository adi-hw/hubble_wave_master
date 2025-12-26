import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Container,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { automationApi, AutomationExecutionLog } from '../../services/automationApi';

export const AutomationLogsPage: React.FC = () => {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AutomationExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [collectionId]);

  const loadLogs = async () => {
    if (!collectionId) return;
    try {
      const data = await automationApi.getLogs(collectionId);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Typography>Loading logs...</Typography>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mr: 2 }}>
          Back
        </Button>
        <Typography variant="h4">Execution logs</Typography>
      </Box>

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Automation</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.startedAt).toLocaleString()}</TableCell>
                <TableCell>{log.automationName || 'Unknown'}</TableCell>
                <TableCell>
                  <Chip
                    label={log.status}
                    color={
                      log.status === 'success'
                        ? 'success'
                        : log.status === 'error'
                        ? 'error'
                        : 'warning'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>{log.durationMs}ms</TableCell>
                <TableCell>
                  <Accordion elevation={0}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">View Output</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        {log.errorMessage && (
                            <Typography color="error" variant="body2" paragraph>
                                Error: {log.errorMessage}
                            </Typography>
                        )}
                        <pre style={{ fontSize: '0.75rem', overflowX: 'auto' }}>
                            {JSON.stringify(log.actionsExecuted, null, 2)}
                        </pre>
                    </AccordionDetails>
                  </Accordion>
                </TableCell>
              </TableRow>
            ))}
             {logs.length === 0 && (
                <TableRow>
                    <TableCell colSpan={5} align="center">
                        No logs found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </Container>
  );
};
