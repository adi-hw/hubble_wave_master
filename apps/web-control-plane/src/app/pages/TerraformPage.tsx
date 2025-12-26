import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tabs,
  Tab,
  Grid,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Container
} from '@mui/material';
import {
  Loader,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Download,
  Square,
  ChevronUp,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, TerraformJob, Customer } from '../services/api';

const statusConfig = {
  pending: { color: colors.text.muted, bg: colors.glass.medium, icon: Clock, label: 'Pending' },
  running: { color: colors.info.base, bg: colors.info.glow, icon: Loader, label: 'Running' },
  completed: { color: colors.success.base, bg: colors.success.glow, icon: CheckCircle, label: 'Completed' },
  failed: { color: colors.danger.base, bg: colors.danger.glow, icon: XCircle, label: 'Failed' },
  cancelled: { color: colors.warning.base, bg: colors.warning.glow, icon: AlertTriangle, label: 'Cancelled' },
};

const typeConfig = {
  apply: { color: colors.success.base, label: 'Apply' },
  destroy: { color: colors.danger.base, label: 'Destroy' },
  plan: { color: colors.info.base, label: 'Plan' },
  refresh: { color: colors.warning.base, label: 'Refresh' },
};

const envConfig: Record<string, { color: string; bg: string }> = {
  production: { color: colors.success.base, bg: colors.success.glow },
  staging: { color: colors.warning.base, bg: colors.warning.glow },
  development: { color: colors.info.base, bg: colors.info.glow },
};

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <Box role="tabpanel" hidden={value !== index} {...other}>
      {value === index && children}
    </Box>
  );
}

export function TerraformPage() {
  const [tabValue, setTabValue] = useState(0);
  const [jobs, setJobs] = useState<TerraformJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<TerraformJob | null>(null);
  const [showNewJobDialog, setShowNewJobDialog] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // New Job State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newJobData, setNewJobData] = useState({
    customerId: '',
    environment: 'development',
    operation: 'plan',
    version: '1.5.0',
  });
  const [creatingJob, setCreatingJob] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [jobsData, customersData] = await Promise.all([
        controlPlaneApi.getTerraformJobs(),
        controlPlaneApi.getCustomers({ limit: 100 }), // Get all customers for dropdown
      ]);
      setJobs(jobsData.data);
      setCustomers(customersData.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Poll for updates on active jobs
  useEffect(() => {
    const interval = setInterval(async () => {
      if (jobs.some(j => j.status === 'running' || j.status === 'pending')) {
        const data = await controlPlaneApi.getTerraformJobs();
        setJobs(data.data);
        
        // Update selected job if it's still visible
        if (selectedJob) {
          const updated = data.data.find(j => j.id === selectedJob.id);
          if (updated) setSelectedJob(updated);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [jobs, selectedJob]);

  // Auto-scroll logs
  useEffect(() => {
    if (selectedJob?.status === 'running' && autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedJob?.output, autoScroll]);

  const handleCreateJob = async () => {
    try {
      setCreatingJob(true);
      await controlPlaneApi.createTerraformJob({
        customerId: newJobData.customerId,
        environment: newJobData.environment,
        operation: newJobData.operation,
        version: newJobData.version,
      });
      setShowNewJobDialog(false);
      // Refresh jobs immediately
      const data = await controlPlaneApi.getTerraformJobs();
      setJobs(data.data);
      setNewJobData({ ...newJobData, customerId: '' }); // Reset only customer
    } catch (err: any) {
      console.error('Failed to create job:', err);
      // In a real app, show a toast or alert. For now, we'll just log it.
    } finally {
      setCreatingJob(false);
    }
  };

  const activeJobs = jobs.filter((j) => j.status === 'running' || j.status === 'pending');
  const recentJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');

  const renderJobRow = (job: TerraformJob) => {
    const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return colors.success.base;
    case 'failed': return colors.danger.base;
    case 'running': return colors.info.base;
    default: return colors.text.secondary;
  }
};
    const status = statusConfig[job.status] || { icon: Clock, color: colors.text.muted, bg: colors.glass.medium, label: job.status };
    const type = typeConfig[job.operation] || { color: colors.text.secondary, label: job.operation };
    const env = envConfig[job.environment] || { color: colors.text.secondary, bg: colors.glass.medium };
    const StatusIcon = status.icon;

    return (
      <TableRow
        key={job.id}
        hover
        onClick={() => setSelectedJob(job)}
        sx={{ cursor: 'pointer', bgcolor: selectedJob?.id === job.id ? colors.glass.subtle : 'transparent' }}
      >
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StatusIcon
              size={16}
              color={status.color}
              style={job.status === 'running' ? { animation: 'spin 1s linear infinite' } : undefined}
            />
            <Chip
              size="small"
              label={status.label}
              sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600, fontSize: 11 }}
            />
          </Box>
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            label={type.label}
            sx={{ bgcolor: colors.glass.medium, color: type.color, fontWeight: 600, fontSize: 11 }}
          />
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ color: colors.text.primary, fontWeight: 500 }}>
            {job.customerCode}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            label={job.environment}
            sx={{ bgcolor: env.bg, color: env.color, fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}
          />
        </TableCell>
        <TableCell>
          <Typography variant="caption" sx={{ color: colors.text.muted }}>{job.region || '-'}</Typography>
        </TableCell>
        <TableCell>
           <Typography variant="caption" sx={{ color: colors.text.muted }}>{job.version || 'latest'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            {formatDate(job.createdAt)}
          </Typography>
        </TableCell>
         <TableCell>
            <Typography variant="body2" sx={{ color: colors.text.secondary, fontFamily: 'monospace' }}>
                {formatDuration(job.duration)}
            </Typography>
         </TableCell>
      </TableRow>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
    <Box>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
            Terraform Console
          </Typography>
          <Typography variant="body2" sx={{ color: colors.text.tertiary, mt: 0.5 }}>
            Manage infrastructure provisioning and deployments
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={fetchData} disabled={loading}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setShowNewJobDialog(true)}
            sx={{
              bgcolor: colors.brand.primary,
              '&:hover': { bgcolor: colors.brand.secondary },
            }}
          >
            New Job
          </Button>
        </Box>
      </Box>

      {/* Stats Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* ... (Existing stats cards logic kept same for brevity, can be copy-pasted if needed, but assuming user wants fixes foremost) ... */}
        {/* Re-implementing simplified stats to ensure file completeness */}
        <Grid item xs={3}>
            <Card sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Loader size={24} color={colors.info.base} />
                    <Box>
                        <Typography variant="h5" fontWeight="bold">
                            {jobs.filter((j) => j.status === 'running').length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Running</Typography>
                    </Box>
                </Box>
            </Card>
        </Grid>
        <Grid item xs={3}>
            <Card sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Clock size={24} color={colors.text.muted} />
                    <Box>
                        <Typography variant="h5" fontWeight="bold">
                            {jobs.filter((j) => j.status === 'pending').length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Pending</Typography>
                    </Box>
                </Box>
            </Card>
        </Grid>
        <Grid item xs={3}>
             <Card sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CheckCircle size={24} color={colors.success.base} />
                    <Box>
                        <Typography variant="h5" fontWeight="bold">
                            {jobs.filter((j) => j.status === 'completed').length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Completed</Typography>
                    </Box>
                </Box>
            </Card>
        </Grid>
        <Grid item xs={3}>
             <Card sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <XCircle size={24} color={colors.danger.base} />
                    <Box>
                        <Typography variant="h5" fontWeight="bold">
                            {jobs.filter((j) => j.status === 'failed').length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Failed</Typography>
                    </Box>
                </Box>
            </Card>
        </Grid>
      </Grid>

      {/* Main content */}
      <Grid container spacing={3}>
        {/* Jobs List */}
        <Grid item xs={selectedJob ? 6 : 12}>
          <Card>
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: `1px solid ${colors.glass.border}`, px: 2 }}>
              <Tab label={`Active (${activeJobs.length})`} icon={<Loader size={14} />} iconPosition="start" />
              <Tab label={`History (${recentJobs.length})`} icon={<Clock size={14} />} iconPosition="start" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              {activeJobs.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell>Env</TableCell>
                        <TableCell>Region</TableCell>
                        <TableCell>Version</TableCell>
                        <TableCell>Started</TableCell>
                         <TableCell>Duration</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeJobs.map(renderJobRow)}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CheckCircle size={48} color={colors.text.muted} style={{ marginBottom: 16 }} />
                  <Typography variant="h6" sx={{ color: colors.text.secondary, mb: 1 }}>
                    No Active Jobs
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.text.tertiary }}>
                    All infrastructure jobs are complete
                  </Typography>
                </Box>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell>Env</TableCell>
                        <TableCell>Region</TableCell>
                        <TableCell>Version</TableCell>
                        <TableCell>Started</TableCell>
                         <TableCell>Duration</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No operation history</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentJobs.map(renderJobRow)
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
          </Card>
        </Grid>

        {/* Job Details & Logs */}
        {selectedJob && (
          <Grid item xs={6}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Job Header */}
              <Box sx={{ p: 2, borderBottom: `1px solid ${colors.glass.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: colors.glass.subtle }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: colors.text.primary }}>
                    Operation Details
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.text.tertiary, fontFamily: 'monospace' }}>
                    ID: {selectedJob.id}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="View State">
                    <IconButton size="small"><Eye size={16} /></IconButton>
                  </Tooltip>
                  <Tooltip title="Download Logs">
                    <IconButton size="small"><Download size={16} /></IconButton>
                  </Tooltip>
                  {selectedJob.status === 'running' && (
                    <Button variant="contained" color="error" size="small" startIcon={<Square size={14} />}>
                      Stop
                    </Button>
                  )}
                  <IconButton size="small" onClick={() => setSelectedJob(null)} sx={{ color: colors.text.muted }}>
                    <ChevronUp size={16} />
                  </IconButton>
                </Box>
              </Box>

              <Box sx={{ p: 2, borderBottom: `1px solid ${colors.glass.border}` }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ color: colors.text.muted }}>Resources</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip size="small" label={`+${selectedJob.plan?.add || 0}`} sx={{ bgcolor: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', fontSize: 10, height: 20 }} />
                        <Chip size="small" label={`~${selectedJob.plan?.change || 0}`} sx={{ bgcolor: 'rgba(255, 152, 0, 0.1)', color: '#ff9800', fontSize: 10, height: 20 }} />
                        <Chip size="small" label={`-${selectedJob.plan?.destroy || 0}`} sx={{ bgcolor: 'rgba(244, 67, 54, 0.1)', color: '#f44336', fontSize: 10, height: 20 }} />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              <Box sx={{ flex: 1, bgcolor: '#0d1117', p: 2, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
                {selectedJob.output?.map((log, index) => (
                  <Box key={index} sx={{ mb: 0.5, display: 'flex', gap: 2 }}>
                    <Typography component="span" sx={{ color: colors.text.muted, opacity: 0.5, minWidth: 140 }}>
                         {log.time}
                    </Typography>
                    <Typography component="span" sx={{
                        color: log.level === 'error' ? colors.danger.base :
                               log.level === 'success' ? colors.success.base :
                               log.level === 'add' ? colors.success.light :
                               log.level === 'destroy' ? colors.danger.light :
                               log.level === 'change' ? colors.warning.light :
                               colors.text.secondary
                    }}>
                      {log.message}
                    </Typography>
                  </Box>
                ))}
                 {(!selectedJob.output || selectedJob.output.length === 0) && (
                     <Typography sx={{ color: colors.text.muted, fontStyle: 'italic' }}>No logs available.</Typography>
                 )}
                <div ref={logsEndRef} />
              </Box>
            </Card>
           </Grid>
        )}
      </Grid>
      </Box>

       {/* Create Job Dialog */}
      <Dialog open={showNewJobDialog} onClose={() => setShowNewJobDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Terraform Operation</DialogTitle>
        <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                <FormControl fullWidth>
                    <InputLabel>Customer</InputLabel>
                    <Select
                        label="Customer"
                        value={newJobData.customerId}
                        onChange={(e) => setNewJobData({ ...newJobData, customerId: e.target.value })}
                    >
                        {customers.map((c) => (
                            <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth>
                    <InputLabel>Environment</InputLabel>
                    <Select
                        label="Environment"
                        value={newJobData.environment}
                        onChange={(e) => setNewJobData({ ...newJobData, environment: e.target.value })}
                    >
                        <MenuItem value="production">Production</MenuItem>
                        <MenuItem value="staging">Staging</MenuItem>
                        <MenuItem value="development">Development</MenuItem>
                    </Select>
                </FormControl>

                <FormControl fullWidth>
                    <InputLabel>Operation Type</InputLabel>
                    <Select
                        label="Operation Type"
                        value={newJobData.operation}
                        onChange={(e: any) => setNewJobData({ ...newJobData, operation: e.target.value })}
                    >
                        <MenuItem value="plan">Plan</MenuItem>
                        <MenuItem value="apply">Apply</MenuItem>
                        <MenuItem value="refresh">Refresh</MenuItem>
                        <MenuItem value="destroy">Destroy</MenuItem>
                    </Select>
                </FormControl>

                 <TextField
                    label="Version"
                    value={newJobData.version}
                    onChange={(e) => setNewJobData({ ...newJobData, version: e.target.value })}
                    fullWidth
                    helperText="Terraform module version tag"
                 />
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setShowNewJobDialog(false)}>Cancel</Button>
            <Button 
                variant="contained" 
                onClick={handleCreateJob} 
                disabled={creatingJob || !newJobData.customerId}
            >
                {creatingJob ? 'Starting...' : 'Start Job'}
            </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TerraformPage;
