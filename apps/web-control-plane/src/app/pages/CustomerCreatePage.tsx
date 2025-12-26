import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import { ArrowLeft, Save } from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi } from '../services/api';

export function CustomerCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    contactEmail: '',
    contactName: '',
    tier: 'starter',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await controlPlaneApi.createCustomer({
        name: formData.name,
        code: formData.code,
        contactEmail: formData.contactEmail,
        contactName: formData.contactName,
        tier: formData.tier as any,
      });
      navigate('/customers');
    } catch (err: any) {
      console.error('Failed to create customer:', err);
      setError(err.response?.data?.message || 'Failed to create customer.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: string } }) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/customers')} sx={{ color: colors.text.secondary }}>
          <ArrowLeft size={20} />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
          New Customer
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Customer Name"
                  value={formData.name}
                  onChange={handleChange('name')}
                  required
                  placeholder="e.g. Acme Corp"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Customer Code"
                  value={formData.code}
                  onChange={handleChange('code')}
                  required
                  placeholder="e.g. acme"
                  helperText="Unique identifier for URL and internal use"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Contact Name"
                  value={formData.contactName}
                  onChange={handleChange('contactName')}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Contact Email"
                  type="email"
                  value={formData.contactEmail}
                  onChange={handleChange('contactEmail')}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Tier</InputLabel>
                  <Select
                    value={formData.tier}
                    label="Tier"
                    onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                  >
                    <MenuItem value="starter">Starter</MenuItem>
                    <MenuItem value="professional">Professional</MenuItem>
                    <MenuItem value="enterprise">Enterprise</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                  <Button variant="outlined" onClick={() => navigate('/customers')}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Save size={20} />}
                    disabled={loading}
                  >
                    Create Customer
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
