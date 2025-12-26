import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Typography,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  DragIndicator as DragIcon,
  Lock as SystemIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { PropertyDefinition, propertyApi } from '../../../services/propertyApi';

interface PropertyListProps {
  collectionId: string;
  onEdit: (property: PropertyDefinition) => void;
  onDelete: (property: PropertyDefinition) => void;
  refreshTrigger: number;
}

export const PropertyList: React.FC<PropertyListProps> = ({
  collectionId,
  onEdit,
  onDelete,
  refreshTrigger
}) => {
  const [properties, setProperties] = useState<PropertyDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, [collectionId, refreshTrigger]);

  const loadProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await propertyApi.list(collectionId);
      setProperties(result.data || []);
    } catch (err) {
      console.error('Failed to load properties', err);
      setError('Failed to load properties. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(properties);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for smooth UI
    const updatedItems = items.map((item, index) => ({
      ...item,
      displayOrder: index
    }));
    setProperties(updatedItems);

    // Persist to backend
    try {
      await propertyApi.reorder(
        collectionId, 
        updatedItems.map(p => ({ id: p.id, displayOrder: p.displayOrder }))
      );
    } catch (error) {
      console.error('Failed to reorder properties', error);
      loadProperties(); // Revert on error
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'text': return 'default';
      case 'number': 
      case 'currency': return 'primary';
      case 'date':
      case 'datetime': return 'secondary';
      case 'choice':
      case 'multi_choice': return 'success';
      case 'reference': return 'warning';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Card variant="outlined">
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress />
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined">
        <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
      </Card>
    );
  }

  if (properties.length === 0) {
    return (
      <Card variant="outlined">
        <Box display="flex" flexDirection="column" alignItems="center" py={4}>
          <Typography color="text.secondary" gutterBottom>
            No properties defined yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click "New Property" to add your first property to this collection
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <TableContainer>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={50}></TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Type</TableCell>
                <TableCell width={100} align="center">Required</TableCell>
                <TableCell width={100} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <Droppable droppableId="properties">
              {(provided: DroppableProvided) => (
                <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                  {properties.map((prop, index) => (
                    <Draggable 
                      key={prop.id} 
                      draggableId={prop.id} 
                      index={index}
                      isDragDisabled={prop.isSystem}
                    >
                      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                        <TableRow
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          sx={{ 
                            bgcolor: snapshot.isDragging ? 'action.hover' : 'inherit',
                            '& td': { borderBottom: snapshot.isDragging ? 'none' : undefined }
                          }}
                        >
                          <TableCell>
                            {!prop.isSystem && (
                              <Box 
                                {...provided.dragHandleProps} 
                                sx={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}
                              >
                                <DragIcon fontSize="small" color="action" />
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>
                             <Box display="flex" alignItems="center" gap={1}>
                               {prop.label}
                               {prop.isSystem && (
                                 <Tooltip title="System Property">
                                   <SystemIcon fontSize="inherit" color="disabled" />
                                 </Tooltip>
                               )}
                             </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                              {prop.code}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={prop.dataType} 
                              size="small" 
                              variant="outlined"
                              color={getTypeColor(prop.dataType) as any}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {prop.isRequired && (
                              <Chip label="Req" size="small" color="error" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Box display="flex" justifyContent="flex-end">
                              <IconButton 
                                size="small" 
                                onClick={() => onEdit(prop)}
                                disabled={prop.isSystem && prop.isReadonly}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              {!prop.isSystem && (
                                <IconButton 
                                  size="small" 
                                  color="error" 
                                  onClick={() => onDelete(prop)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </TableBody>
              )}
            </Droppable>
          </Table>
        </DragDropContext>
      </TableContainer>
    </Card>
  );
};
