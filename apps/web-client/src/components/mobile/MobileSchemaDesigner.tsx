/**
 * Mobile Schema Designer
 *
 * Touch-optimized schema designer for mobile devices.
 * Provides simplified property management with drag-to-reorder support.
 */

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './MobileSchemaDesigner.css';

interface PropertyDefinition {
  id: string;
  name: string;
  displayName: string;
  type: string;
  required: boolean;
  indexed: boolean;
  config?: Record<string, unknown>;
}

interface CollectionDefinition {
  id: string;
  code: string;
  name: string;
  icon?: string;
  description?: string;
  properties: PropertyDefinition[];
}

interface MobileSchemaDesignerProps {
  collection: CollectionDefinition;
  onChange: (collection: CollectionDefinition) => void;
  onSave: () => void;
  onPropertyEdit: (property: PropertyDefinition) => void;
  onPropertyAdd: () => void;
}

interface SortablePropertyItemProps {
  property: PropertyDefinition;
  onEdit: (property: PropertyDefinition) => void;
}

const TYPE_ICONS: Record<string, string> = {
  text: 'T',
  number: '#',
  date: 'D',
  datetime: 'DT',
  choice: 'C',
  boolean: 'B',
  reference: 'R',
  formula: 'fx',
  rollup: 'SUM',
  lookup: 'LK',
  currency: '$',
  user: 'U',
  rich_text: 'RT',
  attachment: 'F',
  geolocation: 'G',
  duration: 'H',
};

function SortablePropertyItem({ property, onEdit }: SortablePropertyItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mobile-schema-designer__property ${isDragging ? 'mobile-schema-designer__property--dragging' : ''}`}
    >
      <button
        type="button"
        className="mobile-schema-designer__drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="4" y="2" width="2" height="2" rx="0.5" />
          <rect x="10" y="2" width="2" height="2" rx="0.5" />
          <rect x="4" y="7" width="2" height="2" rx="0.5" />
          <rect x="10" y="7" width="2" height="2" rx="0.5" />
          <rect x="4" y="12" width="2" height="2" rx="0.5" />
          <rect x="10" y="12" width="2" height="2" rx="0.5" />
        </svg>
      </button>

      <div className="mobile-schema-designer__property-info" onClick={() => onEdit(property)}>
        <div className="mobile-schema-designer__property-header">
          <span className="mobile-schema-designer__property-name">{property.displayName}</span>
          <span className="mobile-schema-designer__property-type">
            {TYPE_ICONS[property.type] || property.type}
          </span>
        </div>
        <div className="mobile-schema-designer__property-meta">
          {property.required && (
            <span className="mobile-schema-designer__tag mobile-schema-designer__tag--required">
              Required
            </span>
          )}
          {property.indexed && (
            <span className="mobile-schema-designer__tag mobile-schema-designer__tag--indexed">
              Indexed
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        className="mobile-schema-designer__chevron"
        onClick={() => onEdit(property)}
        aria-label={`Edit ${property.displayName}`}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

export function MobileSchemaDesigner({
  collection,
  onChange,
  onSave,
  onPropertyEdit,
  onPropertyAdd,
}: MobileSchemaDesignerProps) {
  const [activeTab, setActiveTab] = useState<'properties' | 'relationships' | 'settings'>('properties');
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = collection.properties.findIndex(p => p.id === active.id);
      const newIndex = collection.properties.findIndex(p => p.id === over.id);

      onChange({
        ...collection,
        properties: arrayMove(collection.properties, oldIndex, newIndex),
      });
    }
  }, [collection, onChange]);

  const handleCollectionUpdate = useCallback((updates: Partial<CollectionDefinition>) => {
    onChange({ ...collection, ...updates });
  }, [collection, onChange]);

  return (
    <div className="mobile-schema-designer">
      <header className="mobile-schema-designer__header">
        <button
          type="button"
          className="mobile-schema-designer__back"
          aria-label="Back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <h1 className="mobile-schema-designer__title">
          Schema: {collection.name}
        </h1>
        <button
          type="button"
          className="mobile-schema-designer__save"
          onClick={onSave}
          aria-label="Save"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </button>
      </header>

      <div className="mobile-schema-designer__collection-card">
        {isEditingDetails ? (
          <div className="mobile-schema-designer__details-edit">
            <input
              type="text"
              className="mobile-schema-designer__input"
              value={collection.name}
              onChange={(e) => handleCollectionUpdate({ name: e.target.value })}
              placeholder="Display Name"
            />
            <input
              type="text"
              className="mobile-schema-designer__input"
              value={collection.code}
              onChange={(e) => handleCollectionUpdate({ code: e.target.value })}
              placeholder="System Name"
              disabled
            />
            <textarea
              className="mobile-schema-designer__textarea"
              value={collection.description || ''}
              onChange={(e) => handleCollectionUpdate({ description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
            />
            <button
              type="button"
              className="mobile-schema-designer__button mobile-schema-designer__button--secondary"
              onClick={() => setIsEditingDetails(false)}
            >
              Done
            </button>
          </div>
        ) : (
          <div
            className="mobile-schema-designer__details"
            onClick={() => setIsEditingDetails(true)}
          >
            <div className="mobile-schema-designer__icon">
              {collection.icon || 'L'}
            </div>
            <div className="mobile-schema-designer__info">
              <h2 className="mobile-schema-designer__collection-name">{collection.name}</h2>
              <p className="mobile-schema-designer__collection-code">{collection.code}</p>
              {collection.description && (
                <p className="mobile-schema-designer__collection-desc">{collection.description}</p>
              )}
            </div>
            <span className="mobile-schema-designer__edit-hint">Tap to edit</span>
          </div>
        )}
      </div>

      <nav className="mobile-schema-designer__tabs">
        <button
          type="button"
          className={`mobile-schema-designer__tab ${activeTab === 'properties' ? 'mobile-schema-designer__tab--active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
        <button
          type="button"
          className={`mobile-schema-designer__tab ${activeTab === 'relationships' ? 'mobile-schema-designer__tab--active' : ''}`}
          onClick={() => setActiveTab('relationships')}
        >
          Relationships
        </button>
        <button
          type="button"
          className={`mobile-schema-designer__tab ${activeTab === 'settings' ? 'mobile-schema-designer__tab--active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <div className="mobile-schema-designer__content">
        {activeTab === 'properties' && (
          <>
            <div className="mobile-schema-designer__section-header">
              <span className="mobile-schema-designer__count">
                Properties ({collection.properties.length})
              </span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={collection.properties.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mobile-schema-designer__property-list">
                  {collection.properties.map((property) => (
                    <SortablePropertyItem
                      key={property.id}
                      property={property}
                      onEdit={onPropertyEdit}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}

        {activeTab === 'relationships' && (
          <div className="mobile-schema-designer__empty">
            <p>No relationships configured</p>
            <button
              type="button"
              className="mobile-schema-designer__button mobile-schema-designer__button--secondary"
            >
              Add Relationship
            </button>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="mobile-schema-designer__settings">
            <div className="mobile-schema-designer__setting">
              <label className="mobile-schema-designer__setting-label">
                Audit Logging
              </label>
              <input
                type="checkbox"
                className="mobile-schema-designer__checkbox"
                defaultChecked
              />
            </div>
            <div className="mobile-schema-designer__setting">
              <label className="mobile-schema-designer__setting-label">
                Soft Delete
              </label>
              <input
                type="checkbox"
                className="mobile-schema-designer__checkbox"
                defaultChecked
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="mobile-schema-designer__fab"
        onClick={onPropertyAdd}
        aria-label="Add Property"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </button>
    </div>
  );
}

export default MobileSchemaDesigner;
