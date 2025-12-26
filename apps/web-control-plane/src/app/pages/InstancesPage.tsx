import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton } from '@mui/material';
import { Plus, RefreshCw, ExternalLink, MoreVertical, Terminal } from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, TenantInstance } from '../services/api';

const envConfig = {
  production: { color: colors.success.base, bg: colors.success.glow },
  staging: { color: colors.warning.base, bg: colors.warning.glow },
  development: { color: colors.info.base, bg: colors.info.glow },
};

const healthConfig = {
  healthy: { color: colors.success.base, bg: colors.success.glow },
  degraded: { color: colors.warning.base, bg: colors.warning.glow },
  unhealthy: { color: colors.danger.base, bg: colors.danger.glow },
  unknown: { color: colors.text.muted, bg: colors.glass.medium },
};

const statusConfig = {
  active: { color: colors.success.base, bg: colors.success.glow },
  provisioning: { color: colors.info.base, bg: colors.info.glow },
  suspended: { color: colors.warning.base, bg: colors.warning.glow },
  terminated: { color: colors.danger.base, bg: colors.danger.glow },
};

export function InstancesPage() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<TenantInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await controlPlaneApi.getInstances();
      setInstances(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch instances:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load instances.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
          Instances
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button 
            variant="outlined" 
            startIcon={<RefreshCw size={16} />}
            onClick={fetchInstances}
            disabled={loading}
          >
            Sync
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Plus size={18} />}
            onClick={() => navigate('/instances/new')}
          >
            New Instance
          </Button>
        </Box>
      </Box>

      {error && (
        <Card sx={{ mb: 3, p: 2, bgcolor: colors.danger.glow, borderColor: colors.danger.base }}>
           <Typography color="error">{error}</Typography>
        </Card>
      )}

      <Card sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Domain</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Env</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Health</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    Loading instances...
                  </TableCell>
                </TableRow>
              ) : instances.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                     No instances found
                   </TableCell>
                </TableRow>
              ) : (
                instances.map((instance) => {
                  const env = envConfig[instance.environment as keyof typeof envConfig] || { color: colors.text.muted, bg: colors.glass.medium };
                  const health = healthConfig[instance.health as keyof typeof healthConfig] || { color: colors.text.muted, bg: colors.glass.medium };
                  const status = statusConfig[instance.status as keyof typeof statusConfig] || { color: colors.text.muted, bg: colors.glass.medium };

                  return (
                    <TableRow key={instance.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: colors.text.primary }}>
                          {instance.domain || 'Pending...'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                          {instance.customer?.name || 'Unknown'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={instance.environment}
                          sx={{
                            bgcolor: env.bg,
                            color: env.color,
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: 'capitalize',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                          {instance.region}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                          v{instance.version}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={instance.status}
                          sx={{
                            bgcolor: status.bg,
                            color: status.color,
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: 'capitalize',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={instance.health}
                          sx={{
                            bgcolor: health.bg,
                            color: health.color,
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: 'capitalize',
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <IconButton size="small" sx={{ color: colors.text.muted }}>
                            <ExternalLink size={16} />
                          </IconButton>
                          <IconButton size="small" sx={{ color: colors.text.muted }}>
                            <Terminal size={16} />
                          </IconButton>
                          <IconButton size="small" sx={{ color: colors.text.muted }}>
                            <MoreVertical size={16} />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

export default InstancesPage;

