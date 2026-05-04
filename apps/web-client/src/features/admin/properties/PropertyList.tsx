/**
 * PropertyList
 * HubbleWave Platform - Phase 3
 *
 * Draggable list of property definitions with reordering support.
 */

import React, { useState, useEffect } from 'react';
import { GripVertical, Pencil, Trash2, Lock, Loader2, AlertCircle } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface SortablePropertyRowProps {
  property: PropertyDefinition;
  onEdit: (property: PropertyDefinition) => void;
  onDelete: (property: PropertyDefinition) => void;
}

const SortablePropertyRow: React.FC<SortablePropertyRowProps> = ({
  property,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property.id, disabled: property.isSystem });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`border-b border-border transition-colors ${
        isDragging ? 'bg-muted/60 border-transparent' : ''
      }`}
    >
      <td className="p-3">
        {!property.isSystem && (
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing flex items-center"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground/50" />
          </div>
        )}
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-foreground">{property.label}</span>
          {property.isSystem && (
            <span title="System Property">
              <Lock className="w-3 h-3 text-muted-foreground/50" />
            </span>
          )}
        </div>
      </td>
      <td className="p-3">
        <code className="text-xs font-mono text-muted-foreground">
          {property.code}
        </code>
      </td>
      <td className="p-3">
        <span
          className={`px-2 py-0.5 text-xs font-medium border rounded ${getTypeBadgeClasses(property.dataType)}`}
        >
          {property.dataType}
        </span>
      </td>
      <td className="p-3 text-center">
        {property.isRequired && (
          <span className="px-2 py-0.5 text-xs font-medium rounded border border-destructive text-destructive">
            Req
          </span>
        )}
      </td>
      <td className="p-3">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => onEdit(property)}
            disabled={property.isSystem && property.isReadonly}
            className="p-1.5 rounded transition-colors hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Edit property"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
          {!property.isSystem && (
            <button
              type="button"
              onClick={() => onDelete(property)}
              className="p-1.5 rounded transition-colors hover:bg-danger-subtle"
              aria-label="Delete property"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  useEffect(() => {
    loadProperties();
  }, [collectionId, refreshTrigger]);

  const loadProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await propertyApi.list(collectionId);
      setProperties(result.data || []);
    } catch {
      // Properties fetch failed - show error message
      setError('Failed to load properties. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = properties.findIndex((p) => p.id === active.id);
    const newIndex = properties.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const items = [...properties];
    const [moved] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, moved);

    const updatedItems = items.map((item, index) => ({
      ...item,
      displayOrder: index,
    }));
    setProperties(updatedItems);

    try {
      await propertyApi.reorder(
        collectionId,
        updatedItems.map((p) => ({ id: p.id, displayOrder: p.displayOrder })),
      );
    } catch {
      // Reorder failed - reload properties to restore original order
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
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
          <SortableContext
            items={properties.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <tbody>
              {properties.map((prop) => (
                <SortablePropertyRow
                  key={prop.id}
                  property={prop}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  );
};
