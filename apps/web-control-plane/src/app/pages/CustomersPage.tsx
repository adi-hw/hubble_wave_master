import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { controlPlaneApi, Customer } from '../services/api';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Avatar,
  IconButton,
} from '@mui/material';
import {
  Search,
  Plus,
  Server,
  Users,
  // ChevronRight, // Unused
  MoreVertical,
} from 'lucide-react';
import { colors } from '../theme/theme';
// import { Customer } from '../services/api'; // Already imported at top

// Mock data for demo
// Mock data removed in favor of real API calls

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

export function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const response = await controlPlaneApi.getCustomers({ search });
        setCustomers(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        setError('Failed to load customers. Please ensure the control plane service is running.');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timeoutId);
  }, [search]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
          Customers
        </Typography>
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          sx={{ px: 3 }}
          onClick={() => navigate('new')} // Assumption: 'new' route exists or will be created
        >
          Add Customer
        </Button>
      </Box>

      {/* Search */}
      <Card sx={{ mb: 3, p: 2 }}>
        <TextField
          fullWidth
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} color={colors.text.muted} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: colors.glass.medium,
            },
          }}
        />
      </Card>

      {/* Error Message */}
      {error && (
        <Card sx={{ mb: 3, p: 2, bgcolor: colors.danger.glow, borderColor: colors.danger.base }}>
           <Typography color="error">{error}</Typography>
        </Card>
      )}

      {/* Customer List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {loading ? (
           <Typography sx={{ textAlign: 'center', py: 4, color: colors.text.secondary }}>
             Loading customers...
           </Typography>
        ) : customers.map((customer) => {
          const status = statusConfig[customer.status] || { color: colors.text.muted, bg: colors.glass.medium, label: customer.status };
          const tier = tierConfig[customer.tier] || { color: colors.text.muted, bg: colors.glass.medium, label: customer.tier };

          return (
            <Card
              key={customer.id}
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: colors.glass.subtle,
                  borderColor: colors.glass.strong,
                },
              }}
              onClick={() => navigate(`/customers/${customer.id}`)}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {/* Avatar */}
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: colors.glass.medium,
                        color: colors.text.secondary,
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {customer.name ? customer.name.split(' ').map((w) => w[0]).join('').slice(0, 2) : '??'}
                    </Avatar>

                    {/* Info */}
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: colors.text.primary }}>
                          {customer.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={status.label}
                          sx={{
                            bgcolor: status.bg,
                            color: status.color,
                            fontWeight: 600,
                            fontSize: 11,
                            height: 22,
                          }}
                        />
                        <Chip
                          size="small"
                          label={tier.label}
                          sx={{
                            bgcolor: tier.bg,
                            color: tier.color,
                            fontWeight: 600,
                            fontSize: 11,
                            height: 22,
                          }}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: colors.text.tertiary, mb: 1 }}>
                        {customer.code} • {customer.contactEmail}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Server size={14} color={colors.text.muted} />
                          <Typography variant="caption" sx={{ color: colors.text.secondary }}>
                            {customer.instances?.length || 0} instances
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Users size={14} color={colors.text.muted} />
                          <Typography variant="caption" sx={{ color: colors.text.secondary }}>
                            {(customer.totalUsers / 1000).toFixed(1)}K users
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* MRR */}
                  <Box sx={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                        ${(customer.mrr / 1000).toFixed(0)}K
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.text.tertiary }}>
                        /month
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      sx={{ color: colors.text.muted }}
                    >
                      <MoreVertical size={18} />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {!loading && customers.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            color: colors.text.tertiary,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            No customers found
          </Typography>
          <Typography variant="body2">
             {search ? 'Try adjusting your search criteria' : 'Click "Add Customer" to get started'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default CustomersPage;
