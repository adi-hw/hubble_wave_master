import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Container
} from '@mui/material';
import {
  MoreVertical,
  Plus,
  RefreshCw
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi } from '../services/api';

export function LicensesPage() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLicenses = async () => {
    try {
        setLoading(true);
        // Mock data for now since API returns "any"
        // In real impl, this would be: await controlPlaneApi.getLicenses();
        // Since we don't have a backend returning this yet, let's pretend.
        const data = await controlPlaneApi.getLicenses().catch(() => ({ data: [] }));
        setLicenses(data.data || []);
        setError(null);
    } catch (err: any) {
        console.error('Failed to load licenses:', err);
        setError('Failed to load licenses.');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [newLicenseData, setNewLicenseData] = useState({
      customerId: '',
      type: 'enterprise',
      seats: 10,
      expiresAt: ''
  });

  const handleIssueLicense = async () => {
      try {
          await controlPlaneApi.createLicense(newLicenseData);
          setShowIssueDialog(false);
          fetchLicenses();
      } catch (error) {
          console.error('Failed to issue license:', error);
      }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
          License Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={fetchLicenses}>
                Refresh
            </Button>
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setShowIssueDialog(true)}>
                Issue License
            </Button>
        </Box>
      </Box>

        {loading ? (
             <LinearProgress />
        ) : error ? (
            <Alert severity="error">{error}</Alert>
        ) : (
             <Card>
                <TableContainer>
                <Table>
                    <TableHead>
                    <TableRow>
                        <TableCell>Customer</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Expires</TableCell>
                        <TableCell>Seats</TableCell>
                        <TableCell align="right">Actions</TableCell>
                    </TableRow>
                    </TableHead>
                    <TableBody>
                        {licenses.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 4, color: colors.text.tertiary }}>
                                    No licenses found.
                                </TableCell>
                             </TableRow>
                        ) : (
                            licenses.map((license) => (
                                <TableRow key={license.id} hover>
                                    <TableCell>{license.customerName || license.customerId}</TableCell>
                                    <TableCell>{license.type}</TableCell>
                                    <TableCell>
                                        <Chip label={license.status} size="small" />
                                    </TableCell>
                                    <TableCell>{license.expiresAt}</TableCell>
                                    <TableCell>{license.seats}</TableCell>
                                    <TableCell align="right">
                                        <IconButton>
                                            <MoreVertical size={16} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                </TableContainer>
            </Card>
        )}

        {/* Issue License Dialog */}
        {/* Placeholder for now - would need Customers list to select from */}
      <Dialog open={showIssueDialog} onClose={() => setShowIssueDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Issue New License</DialogTitle>
        <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField
                    label="Customer ID"
                    fullWidth
                    value={newLicenseData.customerId}
                    onChange={(e) => setNewLicenseData({ ...newLicenseData, customerId: e.target.value })}
                    helperText="Enter the Customer ID to license"
                />
                
                <FormControl fullWidth>
                    <InputLabel>License Type</InputLabel>
                    <Select
                        value={newLicenseData.type}
                        label="License Type"
                        onChange={(e) => setNewLicenseData({ ...newLicenseData, type: e.target.value })}
                    >
                        <MenuItem value="starter">Starter</MenuItem>
                        <MenuItem value="professional">Professional</MenuItem>
                        <MenuItem value="enterprise">Enterprise</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    label="Seats"
                    type="number"
                    fullWidth
                    value={newLicenseData.seats}
                    onChange={(e) => setNewLicenseData({ ...newLicenseData, seats: Number(e.target.value) })}
                />

                <TextField
                    label="Expiration Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={newLicenseData.expiresAt}
                    onChange={(e) => setNewLicenseData({ ...newLicenseData, expiresAt: e.target.value })}
                />
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setShowIssueDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleIssueLicense}>
                Issue License
            </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default LicensesPage;
