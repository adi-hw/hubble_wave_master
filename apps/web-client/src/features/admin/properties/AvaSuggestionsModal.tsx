import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  Stack,
  CircularProgress
} from '@mui/material';
import { AutoAwesome, CheckCircle } from '@mui/icons-material';
import { propertyApi } from '../../../services/propertyApi';

interface AvaSuggestionsModalProps {
  open: boolean;
  collectionId: string;
  onClose: () => void;
  onApply: (suggestion: { dataType: string; formatOptions?: any }) => void;
}

export const AvaSuggestionsModal: React.FC<AvaSuggestionsModalProps> = ({
  open,
  collectionId,
  onClose,
  onApply
}) => {
  const [samples, setSamples] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ dataType: string; confidence: number; formatOptions?: any } | null>(null);

  const handleAnalyze = async () => {
    if (!samples.trim()) return;

    setLoading(true);
    try {
      const sampleList = samples.split('\n').filter(s => s.trim());
      const detection = await propertyApi.detectType(collectionId, sampleList);
      setResult(detection);
    } catch (error) {
      console.error('Failed to detect type', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply({ 
        dataType: result.dataType,
        formatOptions: result.formatOptions
      });
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesome color="primary" />
        Smart Type Detection
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3}>
           <Typography variant="body2" color="text.secondary">
             Paste some sample data (one per line) and AVA will detect the best property type for you.
           </Typography>

           <TextField
             multiline
             rows={6}
             placeholder={`e.g.\n$12,500\n$450.00\n$1,200`}
             value={samples}
             onChange={(e) => {
               setSamples(e.target.value);
               setResult(null); 
             }}
             fullWidth
             variant="outlined"
             sx={{ fontFamily: 'monospace' }}
           />

           {loading && (
             <Box display="flex" justifyContent="center" p={2}>
               <CircularProgress size={24} />
             </Box>
           )}

           {result && (
             <Alert 
                severity="success" 
                icon={<CheckCircle fontSize="inherit" />}
                action={
                  <Button color="inherit" size="small" onClick={handleApply}>
                    Use This
                  </Button>
                }
             >
               <Typography variant="subtitle2">
                 Detected: <strong>{result.dataType}</strong>
               </Typography>
               <Typography variant="caption">
                 Confidence: {Math.round(result.confidence * 100)}%
               </Typography>
             </Alert>
           )}
        </Stack>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleAnalyze} 
          disabled={!samples.trim() || loading}
        >
          Analyze
        </Button>
      </DialogActions>
    </Dialog>
  );
};
