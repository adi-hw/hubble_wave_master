import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Button,
  Collapse,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  Server,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, AuditLog } from '../services/api';

const categoryConfig: Record<string, { icon: any; color: string; label: string }> = {
  auth: { icon: Shield, color: colors.info.base, label: 'Authentication' },
  customer: { icon: User, color: colors.brand.primary, label: 'Customer' },
  instance: { icon: Server, color: colors.cyan.base, label: 'Instance' },
  system: { icon: Settings, color: colors.warning.base, label: 'System' },
  settings: { icon: Settings, color: colors.text.secondary, label: 'Settings' },
  license: { icon: Layers, color: colors.success.base, label: 'License' },
  terraform: { icon: Layers, color: colors.brand.secondary, label: 'Terraform' },
};

const severityConfig: Record<string, { icon: any; color: string; bg: string }> = {
  info: { icon: Info, color: colors.info.base, bg: colors.info.glow },
  warning: { icon: AlertTriangle, color: colors.warning.base, bg: colors.warning.glow },
  error: { icon: XCircle, color: colors.danger.base, bg: colors.danger.glow },
  critical: { icon: XCircle, color: colors.danger.base, bg: colors.danger.glow },
  success: { icon: CheckCircle, color: colors.success.base, bg: colors.success.glow }, // Mapped from 'info' if needed
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatAction(action: string): string {
  return action
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .join(' > ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ info: 0, success: 0, warning: 0, error: 0 });

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await controlPlaneApi.getAuditLogs();
      setLogs(data.data);
      
      // Calculate simple stats client-side
      const newStats = { info: 0, success: 0, warning: 0, error: 0 };
      data.data.forEach(l => {
         const k = l.severity === 'critical' ? 'error' : l.severity;
         if (k in newStats) newStats[k as keyof typeof newStats]++;
      });
      setStats(newStats);

      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !log.eventType.toLowerCase().includes(searchLower) &&
          !log.actor.toLowerCase().includes(searchLower) &&
          !log.target.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Category filter (using targetType as category)
      if (categoryFilter !== 'all' && log.targetType !== categoryFilter) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && log.severity !== severityFilter) {
        return false;
      }

      return true;
    });
  }, [logs, search, categoryFilter, severityFilter]);

  const paginatedLogs = filteredLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Action', 'Category', 'Severity', 'Actor', 'Target', 'Description'].join(','),
      ...filteredLogs.map((log) =>
        [
          log.createdAt,
          log.eventType,
          log.targetType,
          log.severity,
          log.actor,
          log.target,
          `"${log.description}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
          Audit Logs
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={fetchLogs} disabled={loading}>
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<Download size={16} />} onClick={handleExport} disabled={logs.length === 0}>
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              fullWidth
              placeholder="Search by action, actor, or resource..."
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
                flex: 1,
                '& .MuiOutlinedInput-root': { bgcolor: colors.glass.medium },
              }}
            />
            <Button
              variant={showFilters ? 'contained' : 'outlined'}
              startIcon={<Filter size={16} />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
          </Box>

          <Collapse in={showFilters}>
            <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${colors.glass.border}` }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      label="Category"
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <MenuItem value="all">All Categories</MenuItem>
                      <MenuItem value="auth">Authentication</MenuItem>
                      <MenuItem value="customer">Customer</MenuItem>
                      <MenuItem value="instance">Instance</MenuItem>
                      <MenuItem value="system">System</MenuItem>
                      <MenuItem value="settings">Settings</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={severityFilter}
                      label="Severity"
                      onChange={(e) => setSeverityFilter(e.target.value)}
                    >
                      <MenuItem value="all">All Severities</MenuItem>
                      <MenuItem value="info">Info</MenuItem>
                      <MenuItem value="warning">Warning</MenuItem>
                      <MenuItem value="error">Error</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Date Range</InputLabel>
                    <Select
                      value={dateRange}
                      label="Date Range"
                      onChange={(e) => setDateRange(e.target.value)}
                    >
                      <MenuItem value="1h">Last Hour</MenuItem>
                      <MenuItem value="24h">Last 24 Hours</MenuItem>
                      <MenuItem value="7d">Last 7 Days</MenuItem>
                      <MenuItem value="30d">Last 30 Days</MenuItem>
                      <MenuItem value="custom">Custom Range</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Button
                    fullWidth
                    variant="text"
                    onClick={() => {
                      setCategoryFilter('all');
                      setSeverityFilter('all');
                      setDateRange('7d');
                      setSearch('');
                    }}
                    sx={{ height: '100%' }}
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </Box>
      </Card>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 3 }}>
          <Card>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: colors.info.glow }}>
                <Info size={20} color={colors.info.base} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                  {stats.info}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.text.tertiary }}>Info Events</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: colors.success.glow }}>
                <CheckCircle size={20} color={colors.success.base} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                  {stats.success}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.text.tertiary }}>Success Events</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: colors.warning.glow }}>
                <AlertTriangle size={20} color={colors.warning.base} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                   {stats.warning}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.text.tertiary }}>Warnings</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: colors.danger.glow }}>
                <XCircle size={20} color={colors.danger.base} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                   {stats.error}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.text.tertiary }}>Errors</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Logs Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={40}></TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Target Type</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell>Target</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                  <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          Loading logs...
                      </TableCell>
                  </TableRow>
              ) : filteredLogs.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No logs found</Typography>
                      </TableCell>
                  </TableRow>
              ) : (
                paginatedLogs.map((log) => {
                const category = categoryConfig[log.targetType] || { icon: Info, color: colors.text.secondary, label: log.targetType };
                const severity = severityConfig[log.severity] || { icon: Info, color: colors.text.secondary, bg: colors.glass.medium };
                const CategoryIcon = category.icon;
                const SeverityIcon = severity.icon;
                const isExpanded = expandedRow === log.id;

                return (
                  <>
                    <TableRow
                      key={log.id}
                      hover
                      onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <IconButton size="small" sx={{ color: colors.text.muted }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Calendar size={14} color={colors.text.muted} />
                          <Typography variant="body2" sx={{ color: colors.text.secondary, fontFamily: 'monospace' }}>
                            {formatDate(log.createdAt)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: colors.text.primary, fontWeight: 500 }}>
                          {formatAction(log.eventType)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={<CategoryIcon size={12} />}
                          label={category.label}
                          sx={{
                            bgcolor: colors.glass.medium,
                            color: category.color,
                            '& .MuiChip-icon': { color: category.color },
                            fontWeight: 500,
                            fontSize: 11,
                            textTransform: 'capitalize'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={<SeverityIcon size={12} />}
                          label={log.severity}
                          sx={{
                            bgcolor: severity.bg,
                            color: severity.color,
                            '& .MuiChip-icon': { color: severity.color },
                            fontWeight: 500,
                            fontSize: 11,
                            textTransform: 'capitalize',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={log.actorType}>
                          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                            {log.actor}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                          {log.target}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 3, bgcolor: colors.glass.subtle, borderRadius: 1, my: 1 }}>
                            <Grid container spacing={3}>
                              <Grid size={{ xs: 12 }}>
                                <Typography variant="caption" sx={{ color: colors.text.muted, display: 'block', mb: 0.5 }}>
                                  Description
                                </Typography>
                                <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                                  {log.description}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <Typography variant="caption" sx={{ color: colors.text.muted, display: 'block', mb: 0.5 }}>
                                  Metadata
                                </Typography>
                                <Typography
                                  variant="body2"
                                  component="pre"
                                  sx={{
                                    color: colors.text.secondary,
                                    fontFamily: 'monospace',
                                    fontSize: 11,
                                    m: 0,
                                    p: 1,
                                    bgcolor: colors.glass.medium,
                                    borderRadius: 1,
                                    overflow: 'auto',
                                  }}
                                >
                                  {JSON.stringify(log.metadata, null, 2)}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                );
              }))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredLogs.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Card>
    </Box>
  );
}

export default AuditPage;
