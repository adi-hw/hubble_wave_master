import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  Tabs,
  Tab,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  ArrowLeft,
  Building2,
  Server,
  Users,
  DollarSign,
  Settings,
  Activity,
  Plus,
  MoreVertical,
  RefreshCw,
  ExternalLink,
  Cpu,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Database,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, Customer, CustomerSettings } from '../services/api';

interface AuditLog {
  id: string;
  action: string;
  actor: string;
  details: string;
  timestamp: string;
}

// Mock data
// Mock data removed
const mockAuditLogs: AuditLog[] = [];



const statusConfig = {
  active: { color: colors.success.base, bg: colors.success.glow, label: 'Active' },
  trial: { color: colors.info.base, bg: colors.info.glow, label: 'Trial' },
  suspended: { color: colors.warning.base, bg: colors.warning.glow, label: 'Suspended' },
  churned: { color: colors.danger.base, bg: colors.danger.glow, label: 'Churned' },
};

const tierConfig = {
  enterprise: { color: colors.brand.primary, bg: colors.brand.glow, label: 'Enterprise' },
  professional: { color: colors.cyan.base, bg: colors.cyan.glow, label: 'Professional' },
  starter: { color: colors.text.secondary, bg: colors.glass.medium, label: 'Starter' },
};

const healthConfig = {
  healthy: { color: colors.success.base, icon: CheckCircle },
  degraded: { color: colors.warning.base, icon: AlertTriangle },
  unhealthy: { color: colors.danger.base, icon: XCircle },
  unknown: { color: colors.text.muted, icon: Activity },
};

const envConfig = {
  production: { color: colors.success.base, bg: colors.success.glow },
  staging: { color: colors.warning.base, bg: colors.warning.glow },
  development: { color: colors.info.base, bg: colors.info.glow },
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <Box role="tabpanel" hidden={value !== index} {...other} sx={{ pt: 3 }}>
      {value === index && children}
    </Box>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProvisionModal, setShowProvisionModal] = useState(false);


  useEffect(() => {
    async function loadCustomer() {
      if (!id || id === 'new') return;
      try {
        setLoading(true);
        const data = await controlPlaneApi.getCustomer(id);
        // Merge stats into customer object if needed or store separately
        // For now, we'll use the customer data directly
        setCustomer(data);
      } catch (err) {
        console.error('Failed to load customer:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCustomer();
  }, [id]);



  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (!customer) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">Customer not found</Typography>
      </Box>
    );
  }

  const status = statusConfig[customer.status];
  const tier = tierConfig[customer.tier];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/customers')} sx={{ color: colors.text.secondary }}>
          <ArrowLeft size={20} />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 48, height: 48, bgcolor: colors.glass.medium, color: colors.text.secondary, fontSize: 18, fontWeight: 700 }}>
              {customer.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </Avatar>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                  {customer.name}
                </Typography>
                <Chip size="small" label={status.label} sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600, fontSize: 11, height: 22 }} />
                <Chip size="small" label={tier.label} sx={{ bgcolor: tier.bg, color: tier.color, fontWeight: 600, fontSize: 11, height: 22 }} />
              </Box>
              <Typography variant="body2" sx={{ color: colors.text.tertiary }}>
                {customer.code} • Created {new Date(customer.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<Plus size={18} />} onClick={() => navigate('/instances/new', { state: { customerId: customer.id } })}>
          Provision Instance
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 3 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <DollarSign size={16} color={colors.success.base} />
                <Typography variant="caption" sx={{ color: colors.text.tertiary }}>MRR</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                ${((customer.mrr || 0) / 1000).toFixed(0)}K
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Users size={16} color={colors.info.base} />
                <Typography variant="caption" sx={{ color: colors.text.tertiary }}>Users</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                {((customer.totalUsers || 0) / 1000).toFixed(1)}K
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Database size={16} color={colors.warning.base} />
                <Typography variant="caption" sx={{ color: colors.text.tertiary }}>Assets</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                {((customer.totalAssets || 0) / 1000000).toFixed(1)}M
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Server size={16} color={colors.brand.primary} />
                <Typography variant="caption" sx={{ color: colors.text.tertiary }}>Instances</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                {customer.instances?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: `1px solid ${colors.glass.border}`, px: 2 }}>
          <Tab label="Overview" icon={<Building2 size={16} />} iconPosition="start" />
          <Tab label="Instances" icon={<Server size={16} />} iconPosition="start" />
          <Tab label="Settings" icon={<Settings size={16} />} iconPosition="start" />
          <Tab label="Activity" icon={<Activity size={16} />} iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Overview Tab */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="subtitle2" sx={{ color: colors.text.tertiary, mb: 2 }}>Contact Information</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.text.muted }}>Primary Contact</Typography>
                    <Typography variant="body2" sx={{ color: colors.text.primary }}>{customer.contactName}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.text.muted }}>Email</Typography>
                    <Typography variant="body2" sx={{ color: colors.text.primary }}>{customer.contactEmail}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.text.muted }}>Email</Typography>
                    <Typography variant="body2" sx={{ color: colors.text.primary }}>{customer.contactEmail}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.text.muted }}>Phone</Typography>
                    <Typography variant="body2" sx={{ color: colors.text.primary }}>{customer.contactPhone || 'N/A'}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="subtitle2" sx={{ color: colors.text.tertiary, mb: 2 }}>Configuration</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.text.muted }}>Custom Domain</Typography>
                    <Typography variant="body2" sx={{ color: colors.text.primary }}>{customer.settings?.branding?.custom_domain || 'Not configured'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.text.muted }}>SSO</Typography>
                    <Typography variant="body2" sx={{ color: colors.text.primary }}>
                      {customer.settings?.features?.sso ? 'Enabled' : 'Disabled'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Instances Tab */}
          <TabPanel value={tabValue} index={1}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Environment</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Health</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Region</TableCell>
                    <TableCell>Resources</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customer.instances?.map((instance) => {
                    const health = healthConfig[instance.health];
                    const env = envConfig[instance.environment];
                    const HealthIcon = health.icon;

                    return (
                      <TableRow key={instance.id} hover>
                        <TableCell>
                          <Chip size="small" label={instance.environment} sx={{ bgcolor: env.bg, color: env.color, fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: instance.status === 'active' ? colors.success.base : colors.warning.base }} />
                            <Typography variant="body2" sx={{ color: colors.text.secondary, textTransform: 'capitalize' }}>{instance.status}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <HealthIcon size={16} color={health.color} />
                            <Typography variant="body2" sx={{ color: colors.text.secondary, textTransform: 'capitalize' }}>{instance.health}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: colors.text.secondary }}>{instance.version}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: colors.text.secondary }}>{instance.region}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Tooltip title={`CPU: ${instance.resourceMetrics?.cpu_usage || 0}%`}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Cpu size={14} color={colors.text.muted} />
                                <Typography variant="caption" sx={{ color: colors.text.secondary }}>{instance.resourceMetrics?.cpu_usage || 0}%</Typography>
                              </Box>
                            </Tooltip>
                            <Tooltip title={`Memory: ${instance.resourceMetrics?.memory_usage || 0}%`}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <HardDrive size={14} color={colors.text.muted} />
                                <Typography variant="caption" sx={{ color: colors.text.secondary }}>{instance.resourceMetrics?.memory_usage || 0}%</Typography>
                              </Box>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Tooltip title="Open Console">
                              <IconButton size="small" sx={{ color: colors.text.muted }}>
                                <ExternalLink size={16} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Refresh">
                              <IconButton size="small" sx={{ color: colors.text.muted }}>
                                <RefreshCw size={16} />
                              </IconButton>
                            </Tooltip>
                            <IconButton size="small" sx={{ color: colors.text.muted }}>
                              <MoreVertical size={16} />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Settings Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="textSecondary">
                    Settings editing is currently disabled due to schema updates.
                </Typography>
            </Box>
          </TabPanel>

          {/* Activity Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {mockAuditLogs.map((log) => (
                <Box
                  key={log.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: colors.glass.subtle,
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors.brand.primary, mt: 1 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colors.text.primary }}>
                      {log.action}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.text.secondary }}>
                      {log.details}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" sx={{ color: colors.text.muted }}>
                      {new Date(log.timestamp).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: colors.text.tertiary }}>
                      by {log.actor}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </TabPanel>
        </Box>
      </Card>

      {/* Provision Instance Modal */}
      <Dialog open={showProvisionModal} onClose={() => setShowProvisionModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Provision New Instance</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            This will create a new environment for {customer.name}
          </Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Environment</InputLabel>
              <Select defaultValue="staging" label="Environment">
                <MenuItem value="production">Production</MenuItem>
                <MenuItem value="staging">Staging</MenuItem>
                <MenuItem value="development">Development</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Region</InputLabel>
              <Select defaultValue="us-east-1" label="Region">
                <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
                <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
                <MenuItem value="eu-west-1">EU (Ireland)</MenuItem>
                <MenuItem value="ap-southeast-1">Asia Pacific (Singapore)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Version</InputLabel>
              <Select defaultValue="2.4.1" label="Version">
                <MenuItem value="2.5.0-beta">2.5.0-beta (Latest)</MenuItem>
                <MenuItem value="2.4.1">2.4.1 (Stable)</MenuItem>
                <MenuItem value="2.4.0">2.4.0</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProvisionModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setShowProvisionModal(false)}>
            Provision Instance
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default CustomerDetailPage;
