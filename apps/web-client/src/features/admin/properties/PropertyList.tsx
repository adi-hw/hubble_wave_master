/**
 * PropertyList
 * HubbleWave Platform - Phase 3
 *
 * Draggable list of property definitions with reordering support.
 */

import React, { useState, useEffect } from 'react';
import { GripVertical, Pencil, Trash2, Lock, Loader2, AlertCircle } from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DraggableProvided,
  DraggableStateSnapshot,
} from '@hello-pangea/dnd';
import { PropertyDefinition, propertyApi } from '../../../services/propertyApi';

interface PropertyListProps {
  collectionId: string;
  onEdit: (property: PropertyDefinition) => void;
  onDelete: (property: PropertyDefinition) => void;
  refreshTrigger: number;
}

const getTypeBadgeClasses = (type: string): string => {
  switch (type) {
    case 'number':
    case 'currency':
      return 'border-primary text-primary';
    case 'date':
    case 'datetime':
      return 'border-purple-600 text-purple-600';
    case 'choice':
    case 'multi_choice':
      return 'border-success-border text-success-text';
    case 'reference':
      return 'border-warning-border text-warning-text';
    default:
      return 'border-muted-foreground text-muted-foreground';
  }
};

export const PropertyList: React.FC<PropertyListProps> = ({
  collectionId,
  onEdit,
  onDelete,
  refreshTrigger,
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

    const updatedItems = items.map((item, index) => ({
      ...item,
      displayOrder: index,
    }));
    setProperties(updatedItems);

    try {
      await propertyApi.reorder(
        collectionId,
        updatedItems.map((p) => ({ id: p.id, displayOrder: p.displayOrder }))
      );
    } catch (err) {
      console.error('Failed to reorder properties', err);
      loadProperties();
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card border-border">
        <div className="flex justify-center items-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card border-border">
        <div className="flex items-center gap-2 m-4 p-3 rounded border bg-danger-subtle border-danger-border text-danger-text">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="rounded-lg border bg-card border-border">
        <div className="flex flex-col items-center py-8">
          <p className="mb-1 text-muted-foreground">
            No properties defined yet
          </p>
          <p className="text-sm text-muted-foreground/70">
            Click "New Property" to add your first property to this collection
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden bg-card border-border">
      <DragDropContext onDragEnd={handleDragEnd}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted border-border">
              <th className="w-12 p-3"></th>
              <th className="p-3 text-left font-semibold text-muted-foreground">
                Name
              </th>
              <th className="p-3 text-left font-semibold text-muted-foreground">
                Code
              </th>
              <th className="p-3 text-left font-semibold text-muted-foreground">
                Type
              </th>
              <th className="p-3 text-center font-semibold w-24 text-muted-foreground">
                Required
              </th>
              <th className="p-3 text-right font-semibold w-24 text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <Droppable droppableId="properties">
            {(provided: DroppableProvided) => (
              <tbody ref={provided.innerRef} {...provided.droppableProps}>
                {properties.map((prop, index) => (
                  <Draggable
                    key={prop.id}
                    draggableId={prop.id}
                    index={index}
                    isDragDisabled={prop.isSystem}
                  >
                    {(
                      dragProvided: DraggableProvided,
                      snapshot: DraggableStateSnapshot
                    ) => (
                      <tr
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`border-b border-border transition-colors ${
                          snapshot.isDragging ? 'bg-muted/60 border-transparent' : ''
                        }`}
                        style={dragProvided.draggableProps.style}
                      >
                        <td className="p-3">
                          {!prop.isSystem && (
                            <div
                              {...dragProvided.dragHandleProps}
                              className="cursor-grab flex items-center"
                            >
                              <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">
                              {prop.label}
                            </span>
                            {prop.isSystem && (
                              <span title="System Property">
                                <Lock className="w-3 h-3 text-muted-foreground/50" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <code className="text-xs font-mono text-muted-foreground">
                            {prop.code}
                          </code>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium border rounded ${getTypeBadgeClasses(prop.dataType)}`}
                          >
                            {prop.dataType}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {prop.isRequired && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded border border-destructive text-destructive">
                              Req
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onEdit(prop)}
                              disabled={prop.isSystem && prop.isReadonly}
                              className="p-1.5 rounded transition-colors hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Edit property"
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </button>
                            {!prop.isSystem && (
                              <button
                                type="button"
                                onClick={() => onDelete(prop)}
                                className="p-1.5 rounded transition-colors hover:bg-danger-subtle"
                                aria-label="Delete property"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </tbody>
            )}
          </Droppable>
        </table>
      </DragDropContext>
    </div>
  );
};
