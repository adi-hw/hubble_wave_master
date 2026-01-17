/**
 * RelationshipEditor Component
 * HubbleWave Platform - Phase 2
 *
 * Manages relationships between collections.
 */

import React, { useState } from 'react';
import { Link2, Plus, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
import {
  SchemaCollection,
  SchemaRelationship,
  RelationshipType,
} from './types';

interface RelationshipEditorProps {
  collection: SchemaCollection;
  collections: SchemaCollection[];
  relationships: SchemaRelationship[];
  onAddRelationship: (relationship: Omit<SchemaRelationship, 'id'>) => void;
  onDeleteRelationship: (relationshipId: string) => void;
}

const RELATIONSHIP_TYPES: { value: RelationshipType; label: string; description: string }[] = [
  {
    value: 'one_to_one',
    label: 'One to One',
    description: 'Each record links to exactly one record',
  },
  {
    value: 'one_to_many',
    label: 'One to Many',
    description: 'One record can link to many records',
  },
  {
    value: 'many_to_many',
    label: 'Many to Many',
    description: 'Multiple records can link to multiple records',
  },
];

export const RelationshipEditor: React.FC<RelationshipEditorProps> = ({
  collection,
  collections,
  relationships,
  onAddRelationship,
  onDeleteRelationship,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);

  const outgoingRelationships = relationships.filter(
    (r) => r.sourceCollection === collection.id
  );
  const incomingRelationships = relationships.filter(
    (r) => r.targetCollection === collection.id
  );

  const getCollectionName = (id: string) => {
    return collections.find((c) => c.id === id)?.name || 'Unknown';
  };

  const getRelationshipTypeLabel = (type: RelationshipType) => {
    return RELATIONSHIP_TYPES.find((t) => t.value === type)?.label || type;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">
            Outgoing Relationships
          </h4>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors bg-primary text-primary-foreground"
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        {outgoingRelationships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-lg bg-muted border border-dashed border-border">
            <Link2 size={32} className="text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No outgoing relationships
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2 text-sm font-medium text-primary"
            >
              Create one
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {outgoingRelationships.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border"
              >
                <Link2 size={18} className="text-primary" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {rel.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {getRelationshipTypeLabel(rel.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs mt-1 text-muted-foreground">
                    <span>{rel.sourceProperty}</span>
                    <ArrowRight size={12} />
                    <span>{getCollectionName(rel.targetCollection)}</span>
                    {rel.targetProperty && <span>.{rel.targetProperty}</span>}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteRelationship(rel.id)}
                  className="p-1 rounded hover:bg-opacity-50 text-destructive"
                  title="Delete relationship"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">
          Incoming Relationships
        </h4>

        {incomingRelationships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-lg bg-muted border border-dashed border-border">
            <Link2 size={32} className="text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No incoming relationships
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {incomingRelationships.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border"
              >
                <Link2
                  size={18}
                  className="text-muted-foreground rotate-180"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {rel.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {getRelationshipTypeLabel(rel.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs mt-1 text-muted-foreground">
                    <span>{getCollectionName(rel.sourceCollection)}</span>
                    <span>.{rel.sourceProperty}</span>
                    <ArrowRight size={12} />
                    <span>{rel.targetProperty || 'id'}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  From other collection
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddRelationshipModal
          collection={collection}
          collections={collections}
          onAdd={onAddRelationship}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

interface AddRelationshipModalProps {
  collection: SchemaCollection;
  collections: SchemaCollection[];
  onAdd: (relationship: Omit<SchemaRelationship, 'id'>) => void;
  onClose: () => void;
}

const AddRelationshipModal: React.FC<AddRelationshipModalProps> = ({
  collection,
  collections,
  onAdd,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [sourceProperty, setSourceProperty] = useState('');
  const [targetCollection, setTargetCollection] = useState('');
  const [targetProperty, setTargetProperty] = useState('');
  const [type, setType] = useState<RelationshipType>('one_to_many');
  const [cascadeDelete, setCascadeDelete] = useState(false);
  const [required, setRequired] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && sourceProperty.trim() && targetCollection) {
      onAdd({
        name: name.trim(),
        sourceCollection: collection.id,
        sourceProperty: sourceProperty.trim(),
        targetCollection,
        targetProperty: targetProperty.trim() || undefined,
        type,
        cascadeDelete,
        required,
      });
      onClose();
    }
  };

  const targetCollectionObj = collections.find((c) => c.id === targetCollection);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
      <div className="w-full max-w-md rounded-xl shadow-lg overflow-hidden bg-card">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            Add Relationship
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-opacity-50 text-muted-foreground"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Relationship Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., has_many_tasks"
              className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Type
            </label>
            <div className="space-y-2">
              {RELATIONSHIP_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                    type === t.value
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {t.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Source Property
              </label>
              <select
                value={sourceProperty}
                onChange={(e) => setSourceProperty(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                required
              >
                <option value="">Select property...</option>
                {collection.properties.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Target Collection
              </label>
              <select
                value={targetCollection}
                onChange={(e) => setTargetCollection(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                required
              >
                <option value="">Select collection...</option>
                {collections
                  .filter((c) => c.id !== collection.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {targetCollectionObj && (
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Target Property (optional)
              </label>
              <select
                value={targetProperty}
                onChange={(e) => setTargetProperty(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
              >
                <option value="">Default (id)</option>
                {targetCollectionObj.properties.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-foreground">
                Required relationship
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cascadeDelete}
                onChange={(e) => setCascadeDelete(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-foreground">
                Cascade delete
              </span>
            </label>
          </div>

          {cascadeDelete && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-subtle text-warning-text">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm">
                Deleting a source record will also delete related target records.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !sourceProperty || !targetCollection}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 bg-primary text-primary-foreground"
            >
              Create Relationship
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RelationshipEditor;
