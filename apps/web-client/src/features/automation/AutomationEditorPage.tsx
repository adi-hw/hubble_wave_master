import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { automationApi, Automation, CreateAutomationDto, AutomationAction } from '../../services/automationApi';

export const AutomationEditorPage: React.FC = () => {
  const { id: collectionId, automationId } = useParams<{ id: string; automationId: string }>();
  const navigate = useNavigate();
  const isNew = automationId === 'new';

  const [formData, setFormData] = useState<Partial<Automation>>({
    name: '',
    triggerTiming: 'after_insert',
    triggerOnInsert: true,
    triggerOnUpdate: false,
    triggerOnDelete: false,
    triggerOnQuery: false,
    conditionType: 'always',
    condition: {},
    actionType: 'no_code',
    actions: [],
    isActive: true,
    abortOnError: true,
  });

  const [jsonCondition, setJsonCondition] = useState('{}');
  const [loading, setLoading] = useState(!isNew);
  const [openActionDialog, setOpenActionDialog] = useState(false);
  const [currentAction, setCurrentAction] = useState<Partial<AutomationAction>>({});

  useEffect(() => {
    if (!isNew && automationId) {
      loadAutomation(automationId);
    }
  }, [automationId]);

  const loadAutomation = async (id: string) => {
    try {
      const data = await automationApi.getAutomation(id);
      setFormData(data);
      setJsonCondition(JSON.stringify(data.condition || {}, null, 2));
      setLoading(false);
    } catch (error) {
      console.error('Failed to load automation', error);
      navigate(-1);
    }
  };

  const handleSave = async () => {
    if (!collectionId) return;

    try {
      const payload: any = {
        ...formData,
        condition: JSON.parse(jsonCondition),
        collectionId,
      };

      if (isNew) {
        payload.code = `AUT_${Date.now()}`; // fast placeholder
        await automationApi.createAutomation(collectionId, payload as CreateAutomationDto);
      } else if (automationId) {
        await automationApi.updateAutomation(automationId, payload);
      }
      navigate(`/studio/collections/${collectionId}/automations`);
    } catch (error) {
      console.error('Failed to save automation', error);
      alert('Failed to save: ' + (error as Error).message);
    }
  };

  const handleActionSave = () => {
    const newAction = {
      ...currentAction,
      id: currentAction.id || `act_${Date.now()}`,
    } as AutomationAction;

    const actions = [...(formData.actions || [])];
    const index = actions.findIndex((a) => a.id === newAction.id);
    
    if (index >= 0) {
      actions[index] = newAction;
    } else {
      actions.push(newAction);
    }

    setFormData({ ...formData, actions });
    setOpenActionDialog(false);
  };

  const handleActionDelete = (id: string) => {
    setFormData({
      ...formData,
      actions: formData.actions?.filter((a) => a.id !== id),
    });
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{isNew ? 'New Automation' : 'Edit Automation'}</Typography>
        <Box>
            <Button onClick={() => navigate(-1)} sx={{ mr: 1 }}>Cancel</Button>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
            Save
            </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 3 }}>
        <Box sx={{ width: { xs: '100%', md: '66.67%' } }}>
          <Card sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>General</Typography>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              }
              label="Active"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.abortOnError}
                  onChange={(e) => setFormData({ ...formData, abortOnError: e.target.checked })}
                />
              }
              label="Abort on Error"
            />
          </Card>

          <Card sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Trigger</Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel>Timing</InputLabel>
              <Select
                value={formData.triggerTiming}
                label="Timing"
                onChange={(e) => setFormData({ ...formData, triggerTiming: e.target.value as any })}
              >
                <MenuItem value="before_insert">Before Insert</MenuItem>
                <MenuItem value="after_insert">After Insert</MenuItem>
                <MenuItem value="before_update">Before Update</MenuItem>
                <MenuItem value="after_update">After Update</MenuItem>
                <MenuItem value="before_delete">Before Delete</MenuItem>
                <MenuItem value="after_delete">After Delete</MenuItem>
              </Select>
            </FormControl>
            
            <Box mt={2}>
                <FormControlLabel control={<Switch checked={formData.triggerOnInsert || false} onChange={e => setFormData({...formData, triggerOnInsert: e.target.checked})} />} label="On Insert" />
                <FormControlLabel control={<Switch checked={formData.triggerOnUpdate || false} onChange={e => setFormData({...formData, triggerOnUpdate: e.target.checked})} />} label="On Update" />
                <FormControlLabel control={<Switch checked={formData.triggerOnDelete || false} onChange={e => setFormData({...formData, triggerOnDelete: e.target.checked})} />} label="On Delete" />
            </Box>
          </Card>

          <Card sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Condition (JSON)</Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={jsonCondition}
              onChange={(e) => setJsonCondition(e.target.value)}
              helperText="Enter simple JSON condition logic."
            />
          </Card>

          <Card sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Actions</Typography>
                <Button startIcon={<AddIcon />} onClick={() => { setCurrentAction({ type: 'set_value', config: {} }); setOpenActionDialog(true); }}>
                    Add Action
                </Button>
            </Box>
            <List>
                {formData.actions?.map((action, index) => (
                    <ListItem key={action.id || index} divider secondaryAction={
                        <IconButton edge="end" onClick={() => handleActionDelete(action.id)}>
                            <DeleteIcon />
                        </IconButton>
                    }>
                        <ListItemText 
                            primary={action.type} 
                            secondary={JSON.stringify(action.config)} 
                            onClick={() => { setCurrentAction(action); setOpenActionDialog(true); }}
                            sx={{ cursor: 'pointer' }}
                        />
                    </ListItem>
                ))}
            </List>
          </Card>
        </Box>
      </Box>

      <Dialog open={openActionDialog} onClose={() => setOpenActionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Action</DialogTitle>
        <DialogContent>
            <FormControl fullWidth margin="normal">
                <InputLabel>Type</InputLabel>
                <Select
                    value={currentAction.type || 'set_value'}
                    label="Type"
                    onChange={(e) => setCurrentAction({ ...currentAction, type: e.target.value })}
                >
                    <MenuItem value="set_value">Set Value</MenuItem>
                    <MenuItem value="send_notification">Send Notification</MenuItem>
                    <MenuItem value="abort">Abort</MenuItem>
                </Select>
            </FormControl>
            <TextField
                fullWidth
                multiline
                rows={4}
                label="Config (JSON)"
                value={JSON.stringify(currentAction.config || {}, null, 2)}
                onChange={(e) => {
                    try {
                        setCurrentAction({ ...currentAction, config: JSON.parse(e.target.value) });
                    } catch (err) {
                        // ignore parse error while typing
                    }
                }}
                margin="normal"
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setOpenActionDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleActionSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
