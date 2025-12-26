
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  IconButton,
  Divider,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { BusinessSchedule, commitmentApi } from '../../../services/commitmentApi';

interface BusinessScheduleEditorProps {
  scheduleId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

const defaultSchedule: Partial<BusinessSchedule> = {
  name: 'New Schedule',
  code: 'new_schedule',
  timezone: 'UTC',
  is_default: false,
  work_days: {
    monday: [{ start: '09:00', end: '17:00' }],
    tuesday: [{ start: '09:00', end: '17:00' }],
    wednesday: [{ start: '09:00', end: '17:00' }],
    thursday: [{ start: '09:00', end: '17:00' }],
    friday: [{ start: '09:00', end: '17:00' }],
    saturday: [],
    sunday: []
  }
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const BusinessScheduleEditor: React.FC<BusinessScheduleEditorProps> = ({ scheduleId, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<BusinessSchedule>>(defaultSchedule);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scheduleId && scheduleId !== 'new') {
        loadSchedule(scheduleId);
    }
  }, [scheduleId]);

  const loadSchedule = async (id: string) => {
    try {
        setLoading(true);
        const data = await commitmentApi.getSchedule(id);
        setFormData(data);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
        if (scheduleId && scheduleId !== 'new') {
            await commitmentApi.updateSchedule(scheduleId, formData);
        } else {
            await commitmentApi.createSchedule(formData);
        }
        if (onSave) onSave();
    } catch (e) {
        console.error(e);
        alert('Failed to save schedule');
    }
  };

  const updateDay = (day: string, intervals: { start: string; end: string }[]) => {
      setFormData(prev => ({
          ...prev,
          work_days: {
              ...prev.work_days,
              [day]: intervals
          }
      }));
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Card>
        <CardContent>
            <Box display="flex" justifyContent="space-between" mb={2}>
                <Typography variant="h6">{scheduleId === 'new' ? 'New Schedule' : 'Edit Schedule'}</Typography>
                <Box>
                    <Button onClick={onCancel} sx={{ mr: 1 }}>Cancel</Button>
                    <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>Save</Button>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ width: 'calc(50% - 8px)' }}>
                    <TextField
                        fullWidth
                        label="Name"
                        value={formData.name || ''}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                </Box>
                <Box sx={{ width: 'calc(50% - 8px)' }}>
                    <TextField
                        fullWidth
                        label="Code"
                        value={formData.code || ''}
                        onChange={e => setFormData({...formData, code: e.target.value})}
                    />
                </Box>
                <Box sx={{ width: 'calc(50% - 8px)' }}>
                     <TextField
                        fullWidth
                        label="Timezone"
                        value={formData.timezone || ''}
                        onChange={e => setFormData({...formData, timezone: e.target.value})}
                        helperText="e.g. America/New_York or UTC"
                    />
                </Box>
                <Box sx={{ width: 'calc(50% - 8px)', display: 'flex', alignItems: 'center' }}>
                    <FormControlLabel
                        control={<Switch checked={formData.is_default || false} onChange={e => setFormData({...formData, is_default: e.target.checked})} />}
                        label="Default Schedule"
                    />
                </Box>
            </Box>

            <Divider sx={{ my: 3 }} />
            
            <Typography variant="subtitle1" gutterBottom>Work Hours</Typography>
            {DAYS.map(day => {
                const intervals = formData.work_days?.[day] || [];
                const isOpen = intervals.length > 0;

                return (
                    <Box key={day} mb={2} display="flex" alignItems="flex-start">
                        <Box width={100} pt={1}>
                            <Typography style={{ textTransform: 'capitalize' }}>{day}</Typography>
                        </Box>
                        <Box flex={1}>
                            <FormControlLabel 
                                control={
                                    <Switch 
                                        size="small" 
                                        checked={isOpen} 
                                        onChange={(e) => {
                                            if (e.target.checked) updateDay(day, [{ start: '09:00', end: '17:00' }]);
                                            else updateDay(day, []);
                                        }} 
                                    />
                                }
                                label={isOpen ? "Open" : "Closed"}
                            />
                            
                            {intervals.map((interval, idx) => (
                                <Box key={idx} display="flex" alignItems="center" mt={1}>
                                    <TextField 
                                        type="time" 
                                        size="small" 
                                        value={interval.start} 
                                        onChange={e => {
                                            const newIntervals = [...intervals];
                                            newIntervals[idx].start = e.target.value;
                                            updateDay(day, newIntervals);
                                        }}
                                        sx={{ width: 120, mr: 1 }}
                                    />
                                    <Typography sx={{ mx: 1 }}>to</Typography>
                                    <TextField 
                                        type="time" 
                                        size="small" 
                                        value={interval.end} 
                                        onChange={e => {
                                            const newIntervals = [...intervals];
                                            newIntervals[idx].end = e.target.value;
                                            updateDay(day, newIntervals);
                                        }}
                                        sx={{ width: 120, mr: 1 }}
                                    />
                                    <IconButton size="small" onClick={() => updateDay(day, intervals.filter((_, i) => i !== idx))}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))}
                            {isOpen && (
                                <Button size="small" startIcon={<AddIcon />} onClick={() => updateDay(day, [...intervals, { start: '12:00', end: '13:00' }])}>
                                    Add Break/Shift
                                </Button>
                            )}
                        </Box>
                    </Box>
                );
            })}
        </CardContent>
    </Card>
  );
};
