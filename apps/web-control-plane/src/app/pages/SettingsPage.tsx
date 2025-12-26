import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  Switch,
  Alert,
  Divider,
  Container,
  FormControlLabel
} from '@mui/material';
import { Save } from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi } from '../services/api';

export function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Mock settings state for now
  const [settings, setSettings] = useState({
    platformName: 'HubbleWave Control Plane',
    maintenanceMode: false,
    publicSignup: false,
    defaultTrialDays: 14,
    supportEmail: 'support@hubblewave.com'
  });

  const handleSave = async () => {
      setLoading(true);
      setSaved(false);
      try {
          await controlPlaneApi.updateGlobalSettings(settings);
          setSaved(true);
      } catch (err) {
          console.error('Failed to save settings:', err);
      } finally {
          setLoading(false);
      }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
          Platform Settings
        </Typography>
      </Box>

      {saved && <Alert severity="success" sx={{ mb: 3 }}>Settings saved successfully.</Alert>}

      <Card>
        <CardContent sx={{ p: 4 }}>
            <Grid container spacing={4}>
                <Grid xs={12}>
                    <Typography variant="h6" sx={{ mb: 2 }}>General Configuration</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField 
                                label="Platform Name" 
                                fullWidth 
                                value={settings.platformName}
                                onChange={(e) => setSettings({...settings, platformName: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField 
                                label="Support Email" 
                                fullWidth 
                                value={settings.supportEmail}
                                onChange={(e) => setSettings({...settings, supportEmail: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField 
                                label="Default Trial Duration (Days)" 
                                type="number"
                                fullWidth 
                                value={settings.defaultTrialDays}
                                onChange={(e) => setSettings({...settings, defaultTrialDays: Number(e.target.value)})}
                            />
                        </Grid>
                    </Grid>
                </Grid>
                
                <Grid item xs={12}>
                    <Divider />
                </Grid>

                <Grid item xs={12}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Access & Availability</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControlLabel
                            control={<Switch checked={settings.publicSignup} onChange={(e) => setSettings({...settings, publicSignup: e.target.checked})} />}
                            label="Allow Public Signups"
                        />
                         <FormControlLabel
                            control={<Switch color="error" checked={settings.maintenanceMode} onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})} />}
                            label={
                                <Box>
                                    <Typography variant="body1">Maintenance Mode</Typography>
                                    <Typography variant="caption" color="text.secondary">Only admins can access the platform when enabled.</Typography>
                                </Box>
                            }
                        />
                    </Box>
                </Grid>
                
                <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                         <Button variant="contained" startIcon={<Save size={18} />} onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                         </Button>
                    </Box>
                </Grid>
            </Grid>
        </CardContent>
      </Card>
    </Container>
  );
}

export default SettingsPage;
