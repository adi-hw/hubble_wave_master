import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Button,
  LinearProgress,
  Container
} from '@mui/material';
import {
  BarChart3,
  RefreshCw,
  Users,
  Server,
  DollarSign,
  Activity,
  HardDrive,
  Cpu,
  Zap,
  Globe,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, PlatformMetrics } from '../services/api';

export function MetricsPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const data = await controlPlaneApi.getMetrics();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const calculateHealth = (m: PlatformMetrics) => {
    if (m.instances.total === 0) return 100;
    return Math.round((m.instances.healthy / m.instances.total) * 100);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !metrics) {
    return (
      <Box>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchMetrics}>
            Retry
          </Button>
        }>
          {error || 'No metrics data available'}
        </Alert>
      </Box>
    );
  }

  const healthScore = calculateHealth(metrics);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
          Platform Metrics
        </Typography>
        <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={fetchMetrics}>
          Refresh
        </Button>
      </Box>

      {/* Top KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: colors.success.glow }}>
                  <DollarSign size={20} color={colors.success.base} />
                </Box>
                <Typography variant="subtitle2" sx={{ color: colors.text.tertiary }}>
                  Total MRR
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
                {formatCurrency(metrics.revenue.totalMrr)}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.text.secondary }}>
                Avg {formatCurrency(metrics.revenue.avgMrr)} / customer
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: colors.brand.glow }}>
                  <Users size={20} color={colors.brand.primary} />
                </Box>
                <Typography variant="subtitle2" sx={{ color: colors.text.tertiary }}>
                  Active Customers
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
                {metrics.customers.active}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.text.secondary }}>
                {metrics.customers.total} Total ({metrics.customers.trial} in Trial)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: colors.info.glow }}>
                  <Server size={20} color={colors.info.base} />
                </Box>
                <Typography variant="subtitle2" sx={{ color: colors.text.tertiary }}>
                  Total Instances
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
                {metrics.instances.total}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.text.secondary }}>
                {metrics.instances.provisioning} Provisioning
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: healthScore > 90 ? colors.success.glow : colors.warning.glow }}>
                  <Activity size={20} color={healthScore > 90 ? colors.success.base : colors.warning.base} />
                </Box>
                <Typography variant="subtitle2" sx={{ color: colors.text.tertiary }}>
                  System Health
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
                {healthScore}%
              </Typography>
              <Typography variant="caption" sx={{ color: colors.text.secondary }}>
                {metrics.instances.degraded} Degraded Instances
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Customer Breakdown */}
        <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 3 }}>Customer Tiers</Typography>
                    {Object.entries(metrics.customers.byTier).map(([tier, count]) => (
                         <Box key={tier} sx={{ mb: 2 }}>
                             <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                 <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{tier}</Typography>
                                 <Typography variant="body2" fontWeight="bold">{count}</Typography>
                             </Box>
                             <LinearProgress 
                                variant="determinate" 
                                value={(count / metrics.customers.total) * 100} 
                                sx={{ 
                                    height: 8, 
                                    borderRadius: 4,
                                    bgcolor: colors.glass.medium,
                                    '& .MuiLinearProgress-bar': {
                                        bgcolor: tier === 'enterprise' ? colors.brand.primary : 
                                                 tier === 'professional' ? colors.info.base : colors.text.tertiary
                                    }
                                }}
                             />
                         </Box>
                    ))}
                </CardContent>
            </Card>
        </Grid>

        {/* Global Distribution */}
        <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <Globe size={20} color={colors.text.secondary} />
                        <Typography variant="h6">Region Distribution</Typography>
                    </Box>
                    <Grid container spacing={2}>
                        {Object.entries(metrics.instances.byRegion).map(([region, count]) => (
                            <Grid item xs={6} key={region}>
                                <Box sx={{ p: 2, borderRadius: 2, bgcolor: colors.glass.subtle }}>
                                    <Typography variant="caption" color="text.tertiary" display="block">{region}</Typography>
                                    <Typography variant="h5" fontWeight="bold">{count}</Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </CardContent>
            </Card>
        </Grid>

        {/* Resource Usage */}
        <Grid item xs={12}>
            <Card>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 3 }}>Resource Utilization (Avg)</Typography>
                    <Grid container spacing={4}>
                         <Grid item xs={12} md={3}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Cpu size={32} color={colors.text.secondary} style={{ marginBottom: 12 }} />
                                <Typography variant="h4" sx={{ mb: 1 }}>{metrics.resources.avgCpu}%</Typography>
                                <Typography variant="body2" color="text.tertiary">vCPU Usage</Typography>
                                <LinearProgress variant="determinate" value={metrics.resources.avgCpu} sx={{ mt: 2 }} />
                            </Box>
                         </Grid>
                         <Grid item xs={12} md={3}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Zap size={32} color={colors.text.secondary} style={{ marginBottom: 12 }} />
                                <Typography variant="h4" sx={{ mb: 1 }}>{metrics.resources.avgMemory}%</Typography>
                                <Typography variant="body2" color="text.tertiary">Memory Usage</Typography>
                                <LinearProgress variant="determinate" value={metrics.resources.avgMemory} color="warning" sx={{ mt: 2 }} />
                            </Box>
                         </Grid>
                         <Grid item xs={12} md={3}>
                            <Box sx={{ textAlign: 'center' }}>
                                <HardDrive size={32} color={colors.text.secondary} style={{ marginBottom: 12 }} />
                                <Typography variant="h4" sx={{ mb: 1 }}>{metrics.resources.avgDisk}%</Typography>
                                <Typography variant="body2" color="text.tertiary">Disk Usage</Typography>
                                <LinearProgress variant="determinate" value={metrics.resources.avgDisk} sx={{ mt: 2 }} />
                            </Box>
                         </Grid>
                         <Grid item xs={12} md={3}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Activity size={32} color={colors.text.secondary} style={{ marginBottom: 12 }} />
                                <Typography variant="h4" sx={{ mb: 1 }}>{metrics.resources.avgNetwork}%</Typography>
                                <Typography variant="body2" color="text.tertiary">Network Load</Typography>
                                <LinearProgress variant="determinate" value={metrics.resources.avgNetwork} color="success" sx={{ mt: 2 }} />
                            </Box>
                         </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

export default MetricsPage;
