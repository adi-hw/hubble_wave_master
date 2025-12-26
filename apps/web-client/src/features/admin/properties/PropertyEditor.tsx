import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Box, 
  TextField, 
  Stack, 
  Typography,
  InputAdornment,
  FormControlLabel, 
  Switch, 
  Alert,
  Stepper,
  Step,
  StepLabel,
  CircularProgress
} from '@mui/material';
import { TypeSelector } from './TypeSelector';
import { PropertyDefinition, propertyApi, CreatePropertyDto } from '../../../services/propertyApi';
import { AutoAwesome } from '@mui/icons-material';

interface PropertyEditorProps {
  open: boolean;
  collectionId: string;
  property?: PropertyDefinition;
  onClose: () => void;
  onSave: () => void;
}

export const PropertyEditor: React.FC<PropertyEditorProps> = ({ 
  open, 
  collectionId, 
  property, 
  onClose, 
  onSave 
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<CreatePropertyDto>>({
    label: '',
    code: '',
    dataType: 'text',
    isRequired: false,
    isUnique: false,
    description: '',
    showInGrid: true,
  });

  useEffect(() => {
    if (open) {
      if (property) {
        setFormData(property);
        setActiveStep(1); // Skip to config for edit
      } else {
        setFormData({
          label: '',
          code: '',
          dataType: 'text',
          isRequired: false,
          isUnique: false,
          description: '',
          showInGrid: true,
        });
        setActiveStep(0);
      }
      setError(null);
    }
  }, [open, property]);

  // Handle Label Change -> AVA Suggestion
  const handleLabelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const label = e.target.value;
    setFormData((prev: any) => ({ ...prev, label }));
    
    if (!property && label.length > 2) { // Only suggest on create
      const code = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      setFormData((prev: any) => ({ ...prev, code }));

      setSuggestionLoading(true);
      try {
        const suggestion = await propertyApi.suggest(collectionId, label);
        if (suggestion.dataType) {
          setFormData((prev: any) => ({ 
            ...prev, 
            dataType: suggestion.dataType as string,
            // Keep user input if they typed something else
          }));
        }
      } catch (err) {
        // Ignore suggestion errors
      } finally {
        setSuggestionLoading(false);
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      if (property) {
        // Update
        await propertyApi.update(collectionId, property.id, {
          label: formData.label,
          description: formData.description,
          isRequired: formData.isRequired,
          isUnique: formData.isUnique,
          showInGrid: formData.showInGrid,
          // ... property specific types
        });
      } else {
        // Create
        await propertyApi.create(collectionId, formData as CreatePropertyDto);
      }
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save property');
    } finally {
      setLoading(false);
    }
  };

  const steps = property ? ['Configuration'] : ['Select Type', 'Configuration'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {property ? 'Edit Property' : 'New Property'}
      </DialogTitle>
      
      <DialogContent dividers>
        {!property && (
           <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
             {steps.map((label, index) => (
                <Step key={label}>
                  <StepLabel onClick={() => setActiveStep(index)} sx={{ cursor: 'pointer' }}>
                    {label}
                  </StepLabel>
                </Step>
             ))}
           </Stepper>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ mt: 2 }}>
          {/* Step 0: Type Selection (only for create) */}
          {!property && activeStep === 0 && (
            <Stack spacing={3}>
              <TextField
                label="Property Name"
                fullWidth
                value={formData.label}
                onChange={handleLabelChange}
                placeholder="e.g. Employee Email"
                InputProps={{
                  endAdornment: suggestionLoading && (
                    <InputAdornment position="end">
                      <AutoAwesome color="primary" sx={{ animation: 'pulse 1s infinite' }} />
                    </InputAdornment>
                  )
                }}
              />
              
              <TypeSelector 
                selectedType={formData.dataType}
                onSelect={(type) => {
                  setFormData((prev: any) => ({ ...prev, dataType: type }));
                  setActiveStep(1);
                }}
              />
            </Stack>
          )}

          {/* Step 1: Configuration */}
          {(property || activeStep === 1) && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
               <Box flex={1}>
                 <Stack spacing={2}>
                   <TextField
                     fullWidth
                     label="Label"
                     value={formData.label}
                     onChange={(e) => setFormData((prev: any) => ({ ...prev, label: e.target.value }))}
                     required
                   />
                   
                   <Stack direction="row" spacing={2}>
                     <Box flex={1}>
                       <TextField
                         fullWidth
                         label="Code"
                         value={formData.code}
                         disabled={!!property} // Cannot change code after create
                         onChange={(e) => setFormData((prev: any) => ({ ...prev, code: e.target.value }))}
                         required
                         helperText="System name (snake_case)"
                       />
                     </Box>
                     <Box flex={1}>
                       <TextField
                         fullWidth
                         label="Type"
                         value={formData.dataType}
                         disabled
                         InputProps={{
                           startAdornment: (
                             <InputAdornment position="start">
                               {/* Icon could go here */}
                             </InputAdornment>
                           ),
                         }}
                       />
                     </Box>
                   </Stack>
                   
                   <TextField
                     fullWidth
                     multiline
                     rows={3}
                     label="Description"
                     value={formData.description}
                     onChange={(e) => setFormData((prev: any) => ({ ...prev, description: e.target.value }))}
                   />
                 </Stack>
               </Box>
               
               <Box width={{ xs: '100%', md: 300 }}>
                  <Stack spacing={2} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                     <Typography variant="overline" color="text.secondary">
                       Settings
                     </Typography>
                     <FormControlLabel
                       control={
                         <Switch 
                           checked={formData.isRequired} 
                           onChange={(e) => setFormData((prev: any) => ({ ...prev, isRequired: e.target.checked }))} 
                         />
                       }
                       label="Required"
                     />
                     <FormControlLabel
                       control={
                         <Switch 
                           checked={formData.isUnique} 
                           onChange={(e) => setFormData((prev: any) => ({ ...prev, isUnique: e.target.checked }))} 
                         />
                       }
                       label="Unique"
                     />
                     <FormControlLabel
                       control={
                         <Switch 
                           checked={formData.showInGrid} 
                           onChange={(e) => setFormData((prev: any) => ({ ...prev, showInGrid: e.target.checked }))} 
                         />
                       }
                       label="Show in Grid"
                     />
                  </Stack>
               </Box>
            </Stack>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSave} 
          disabled={loading || (!property && !formData.code)}
        >
          {loading ? <CircularProgress size={24} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
