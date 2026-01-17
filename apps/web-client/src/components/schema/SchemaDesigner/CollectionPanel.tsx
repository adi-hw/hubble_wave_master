/**
 * CollectionPanel Component
 * HubbleWave Platform - Phase 2
 *
 * Displays and manages properties within a collection.
 */

import React from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Link2,
  File,
  AtSign,
  Braces,
  Calculator,
  Database,
  Lock,
} from 'lucide-react';
import { SchemaCollection, SchemaProperty, PropertyType } from './types';

interface CollectionPanelProps {
  collection: SchemaCollection;
  selectedProperty: SchemaProperty | null;
  onSelectProperty: (property: SchemaProperty) => void;
  onAddProperty: () => void;
  onDeleteProperty: (propertyId: string) => void;
}

const TYPE_ICONS: Record<string, React.FC<{ size?: number }>> = {
  string: Type,
  text: Type,
  rich_text: Type,
  integer: Hash,
  decimal: Hash,
  currency: Hash,
  percent: Hash,
  number: Hash,
  long: Hash,
  boolean: CheckSquare,
  date: Calendar,
  datetime: Calendar,
  time: Calendar,
  duration: Calendar,
  choice: List,
  multi_choice: List,
  tags: List,
  reference: Link2,
  multi_reference: Link2,
  user_reference: AtSign,
  group_reference: AtSign,
  file: File,
  image: File,
  audio: File,
  video: File,
  email: AtSign,
  phone: AtSign,
  url: Link2,
  json: Braces,
  formula: Calculator,
  rollup: Database,
  lookup: Link2,
  hierarchical: Database,
  default: Type,
};

const TYPE_CATEGORIES: Record<string, string> = {
  string: 'Text',
  text: 'Text',
  rich_text: 'Text',
  integer: 'Number',
  decimal: 'Number',
  currency: 'Number',
  percent: 'Number',
  number: 'Number',
  long: 'Number',
  boolean: 'Boolean',
  date: 'Date',
  datetime: 'Date',
  time: 'Date',
  duration: 'Date',
  choice: 'Choice',
  multi_choice: 'Choice',
  tags: 'Choice',
  reference: 'Relation',
  multi_reference: 'Relation',
  user_reference: 'Relation',
  group_reference: 'Relation',
  file: 'Media',
  image: 'Media',
  audio: 'Media',
  video: 'Media',
  email: 'Contact',
  phone: 'Contact',
  url: 'Contact',
  json: 'Advanced',
  formula: 'Computed',
  rollup: 'Computed',
  lookup: 'Computed',
  hierarchical: 'Advanced',
  auto_number: 'System',
  guid: 'System',
};

export const CollectionPanel: React.FC<CollectionPanelProps> = ({
  collection,
  selectedProperty,
  onSelectProperty,
  onAddProperty,
  onDeleteProperty,
}) => {
  const getIcon = (type: PropertyType) => {
    const Icon = TYPE_ICONS[type] || TYPE_ICONS.default;
    return Icon;
  };

  const getTypeLabel = (type: PropertyType): string => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Properties header */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 bg-muted border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">
          {collection.properties.length} Properties
        </span>
        <button
          onClick={onAddProperty}
          className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors bg-primary text-primary-foreground"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* Properties list */}
      <div className="flex-1 overflow-y-auto">
        {collection.properties.map((property) => {
          const Icon = getIcon(property.type);
          const isSelected = selectedProperty?.id === property.id;

          return (
            <div
              key={property.id}
              onClick={() => onSelectProperty(property)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border ${
                isSelected ? 'bg-primary/10' : 'bg-transparent'
              }`}
            >
              {/* Drag handle */}
              {!property.system && (
                <GripVertical
                  size={14}
                  className="flex-shrink-0 cursor-move text-muted-foreground"
                />
              )}

              {/* Type icon */}
              <div
                className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-muted ${
                  property.system ? 'text-muted-foreground' : 'text-primary'
                }`}
              >
                <Icon size={16} />
              </div>

              {/* Property info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate text-foreground">
                    {property.name}
                  </span>
                  {property.required && (
                    <span className="text-xs text-destructive" title="Required">
                      *
                    </span>
                  )}
                  {property.system && (
                    <span className="text-muted-foreground" title="System property">
                      <Lock size={12} />
                    </span>
                  )}
                </div>
                <div className="text-xs truncate text-muted-foreground">
                  {property.code} • {getTypeLabel(property.type)}
                </div>
              </div>

              {/* Type badge */}
              <span className="text-xs px-2 py-0.5 rounded flex-shrink-0 bg-muted text-muted-foreground">
                {TYPE_CATEGORIES[property.type] || 'Other'}
              </span>

              {/* Delete button */}
              {!property.system && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProperty(property.id);
                  }}
                  className="p-1 rounded hover:bg-opacity-50 flex-shrink-0 text-destructive"
                  title="Delete property"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CollectionPanel;
