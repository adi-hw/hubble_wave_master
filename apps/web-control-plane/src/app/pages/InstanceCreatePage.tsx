import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Grid
} from '@mui/material';
import { ArrowLeft, Check, Server } from 'lucide-react';
import { controlPlaneApi, Customer } from '../services/api';
import { colors } from '../theme/theme';

export function InstanceCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerId: location.state?.customerId || '',
    environment: 'development',
    region: 'us-east-1',
    version: '2.4.1',
    resourceTier: 'standard'
  });

  useEffect(() => {
    async function loadCustomers() {
      try {
        const response = await controlPlaneApi.getCustomers({ page: 1 });
        setCustomers(response.data);
      } catch (err) {
        console.error('Failed to load customers:', err);
        setError('Failed to load customers list');
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
        setError('Please select a customer');
        return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await controlPlaneApi.createInstance(formData);
      navigate('/instances');
    } catch (err: any) {
      console.error('Failed to create instance:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create instance');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Button
        startIcon={<ArrowLeft size={16} />}
        onClick={() => navigate('/instances')}
        sx={{ mb: 3, color: colors.text.secondary }}
      >
        Back to Instances
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary, mb: 3 }}>
        Provision New Instance
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: colors.brand.glow }}>
                <Server size={24} color={colors.brand.primary} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ color: colors.text.primary }}>
                  Instance Configuration
                </Typography>
                <Typography variant="body2" sx={{ color: colors.text.tertiary }}>
                  Configure deployment details for the new tenant environment
                </Typography>
              </Box>
            </Box>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth>
                  <InputLabel>Customer</InputLabel>
                  <Select
                    value={formData.customerId}
                    label="Customer"
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  >
                    {customers.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                 <FormControl fullWidth>
                  <InputLabel>Environment</InputLabel>
                  <Select
                    value={formData.environment}
                    label="Environment"
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                  >
                    <MenuItem value="development">Development</MenuItem>
                    <MenuItem value="staging">Staging</MenuItem>
                    <MenuItem value="production">Production</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Region</InputLabel>
                  <Select
                    value={formData.region}
                    label="Region"
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  >
                    <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
                    <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
                    <MenuItem value="eu-west-1">EU (Ireland)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Version</InputLabel>
                  <Select
                    value={formData.version}
                    label="Version"
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  >
                    <MenuItem value="2.5.0-beta">2.5.0-beta (Latest)</MenuItem>
                    <MenuItem value="2.4.1">2.4.1 (Stable)</MenuItem>
                    <MenuItem value="2.4.0">2.4.0</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Resource Tier</InputLabel>
                  <Select
                    value={formData.resourceTier}
                    label="Resource Tier"
                    onChange={(e) => setFormData({ ...formData, resourceTier: e.target.value })}
                  >
                    <MenuItem value="standard">Standard (2 vCPU, 4GB RAM)</MenuItem>
                    <MenuItem value="professional">Professional (4 vCPU, 8GB RAM)</MenuItem>
                    <MenuItem value="enterprise">Enterprise (8 vCPU, 16GB RAM)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/instances')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <Check size={20} />}
                disabled={submitting}
              >
                {submitting ? 'Provisioning...' : 'Provision Instance'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </form>
    </Box>
  );
}

export default InstanceCreatePage;
