import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  Typography, 
  Breadcrumbs, 
  Link,
  Container,
  Stack
} from '@mui/material';
import { Add as AddIcon, ArrowBack, AutoAwesome } from '@mui/icons-material';
import { PropertyList } from './PropertyList';
import { PropertyEditor } from './PropertyEditor';
import { AvaSuggestionsModal } from './AvaSuggestionsModal';
import { propertyApi, PropertyDefinition } from '../../../services/propertyApi';

export const PropertiesPage: React.FC = () => {
  // Route uses :id for collection, so we need to extract it as 'id' and alias it
  const { id: collectionId, propertyId } = useParams<{ id: string; propertyId?: string }>();
  const navigate = useNavigate();
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [avaOpen, setAvaOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyDefinition | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Deep link handling
  useEffect(() => {
    if (collectionId && propertyId) {
       loadPropertyForEdit(collectionId, propertyId);
    }
  }, [collectionId, propertyId]);

  const loadPropertyForEdit = async (cId: string, pId: string) => {
    try {
      const property = await propertyApi.get(cId, pId);
      setSelectedProperty(property);
      setEditorOpen(true);
    } catch (error) {
      console.error('Failed to load property', error);
      // If not found, maybe just stay on list
    }
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setSelectedProperty(undefined);
    navigate(`/studio/collections/${collectionId}/properties`);
  };

  if (!collectionId) return null;

  const handleCreate = () => {
    setSelectedProperty(undefined);
    setEditorOpen(true);
  };

  const handleEdit = (property: PropertyDefinition) => {
    setSelectedProperty(property);
    setEditorOpen(true);
  };

  const handleDelete = async (property: PropertyDefinition) => {
      // Implement delete confirmation dialog
      console.log('Delete', property);
      // For now, let's just trigger refresh for mockup
      setRefreshTrigger(prev => prev + 1); 
  };

  const handleSave = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSmartCreate = (suggestion: { dataType: string; formatOptions?: any }) => {
    console.log('Applying suggestion:', suggestion);
    setSelectedProperty(undefined);
    // TODO: Pass these defaults to the editor. 
    // Currently editor doesn't accept external defaults well without property object.
    // For now we just open editor.
    setEditorOpen(true);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
       {/* Header */}
       <Box mb={4}>
         <Button 
            startIcon={<ArrowBack />} 
            onClick={() => navigate('/studio/collections')}
            sx={{ mb: 2 }}
         >
            Back to Collections
         </Button>
         
         <Stack direction="row" justifyContent="space-between" alignItems="center">
           <Box>
             <Typography variant="h4" component="h1" gutterBottom>
               Properties
             </Typography>
             <Breadcrumbs aria-label="breadcrumb">
               <Link color="inherit" onClick={() => navigate('/studio/collections')}>
                 Collections
               </Link>
               <Typography color="text.primary">{collectionId}</Typography>
             </Breadcrumbs>
           </Box>

           <Stack direction="row" spacing={2}>
              <Button 
                variant="outlined" 
                startIcon={<AutoAwesome />}
                onClick={() => setAvaOpen(true)}
              >
                Smart Detect
              </Button>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={handleCreate}
              >
                New Property
              </Button>
           </Stack>
         </Stack>
       </Box>

       {/* List */}
       <PropertyList 
         collectionId={collectionId} 
         refreshTrigger={refreshTrigger}
         onEdit={handleEdit}
         onDelete={handleDelete}
       />

       {/* Editor Dialog */}
       <PropertyEditor
         open={editorOpen}
         collectionId={collectionId}
         property={selectedProperty}
         onClose={handleCloseEditor}
         onSave={handleSave}
       />

       {/* AVA Dialog */}
       <AvaSuggestionsModal
         open={avaOpen}
         collectionId={collectionId}
         onClose={() => setAvaOpen(false)}
         onApply={handleSmartCreate}
       />
    </Container>
  );
};
