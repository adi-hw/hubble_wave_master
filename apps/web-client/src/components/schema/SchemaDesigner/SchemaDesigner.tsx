/**
 * SchemaDesigner Component
 * HubbleWave Platform - Phase 2
 *
 * A visual schema designer for creating and managing collections, properties,
 * and relationships. Supports drag-and-drop property reordering and visual
 * relationship mapping.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Database,
  Plus,
  Save,
  RefreshCw,
  ChevronRight,
  Search,
  AlertCircle,
  Loader2,
  Trash2,
  Link2,
} from 'lucide-react';
import { CollectionPanel } from './CollectionPanel';
import { PropertyEditor } from './PropertyEditor';
import { RelationshipEditor } from './RelationshipEditor';
import {
  SchemaCollection,
  SchemaProperty,
  SchemaRelationship,
  PropertyType,
} from './types';

interface SchemaDesignerProps {
  collections: SchemaCollection[];
  relationships: SchemaRelationship[];
  loading?: boolean;
  error?: string | null;
  onSave: (collections: SchemaCollection[], relationships: SchemaRelationship[]) => Promise<void>;
  onRefresh?: () => void;
}

type EditorMode = 'collections' | 'properties' | 'relationships';

export const SchemaDesigner: React.FC<SchemaDesignerProps> = ({
  collections: initialCollections,
  relationships: initialRelationships,
  loading,
  error,
  onSave,
  onRefresh,
}) => {
  const [collections, setCollections] = useState<SchemaCollection[]>(initialCollections);
  const [relationships, setRelationships] = useState<SchemaRelationship[]>(initialRelationships);
  const [selectedCollection, setSelectedCollection] = useState<SchemaCollection | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<SchemaProperty | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('collections');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [showNewPropertyModal, setShowNewPropertyModal] = useState(false);

  // Filter collections by search
  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const query = searchQuery.toLowerCase();
    return collections.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
    );
  }, [collections, searchQuery]);

  // Handle collection selection
  const handleSelectCollection = useCallback((collection: SchemaCollection) => {
    setSelectedCollection(collection);
    setSelectedProperty(null);
    setEditorMode('properties');
  }, []);

  // Handle property selection
  const handleSelectProperty = useCallback((property: SchemaProperty) => {
    setSelectedProperty(property);
  }, []);

  // Add new collection
  const handleAddCollection = useCallback((name: string, code: string, description?: string) => {
    const newCollection: SchemaCollection = {
      id: `col_${Date.now()}`,
      name,
      code,
      description,
      properties: [
        {
          id: `prop_${Date.now()}_id`,
          code: 'id',
          name: 'ID',
          type: 'guid',
          required: true,
          system: true,
        },
        {
          id: `prop_${Date.now()}_created`,
          code: 'created_at',
          name: 'Created At',
          type: 'datetime',
          required: true,
          system: true,
        },
        {
          id: `prop_${Date.now()}_updated`,
          code: 'updated_at',
          name: 'Updated At',
          type: 'datetime',
          required: true,
          system: true,
        },
      ],
      isSystem: false,
    };

    setCollections((prev) => [...prev, newCollection]);
    setSelectedCollection(newCollection);
    setHasChanges(true);
    setShowNewCollectionModal(false);
  }, []);

  // Delete collection
  const handleDeleteCollection = useCallback((collectionId: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    setRelationships((prev) =>
      prev.filter((r) => r.sourceCollection !== collectionId && r.targetCollection !== collectionId)
    );
    if (selectedCollection?.id === collectionId) {
      setSelectedCollection(null);
      setSelectedProperty(null);
    }
    setHasChanges(true);
  }, [selectedCollection]);

  // Add new property
  const handleAddProperty = useCallback(
    (property: Omit<SchemaProperty, 'id'>) => {
      if (!selectedCollection) return;

      const newProperty: SchemaProperty = {
        ...property,
        id: `prop_${Date.now()}`,
      };

      setCollections((prev) =>
        prev.map((c) =>
          c.id === selectedCollection.id
            ? { ...c, properties: [...c.properties, newProperty] }
            : c
        )
      );
      setSelectedCollection((prev) =>
        prev ? { ...prev, properties: [...prev.properties, newProperty] } : null
      );
      setSelectedProperty(newProperty);
      setHasChanges(true);
      setShowNewPropertyModal(false);
    },
    [selectedCollection]
  );

  // Update property
  const handleUpdateProperty = useCallback(
    (propertyId: string, updates: Partial<SchemaProperty>) => {
      if (!selectedCollection) return;

      setCollections((prev) =>
        prev.map((c) =>
          c.id === selectedCollection.id
            ? {
                ...c,
                properties: c.properties.map((p) =>
                  p.id === propertyId ? { ...p, ...updates } : p
                ),
              }
            : c
        )
      );
      setSelectedCollection((prev) =>
        prev
          ? {
              ...prev,
              properties: prev.properties.map((p) =>
                p.id === propertyId ? { ...p, ...updates } : p
              ),
            }
          : null
      );
      setSelectedProperty((prev) =>
        prev?.id === propertyId ? { ...prev, ...updates } : prev
      );
      setHasChanges(true);
    },
    [selectedCollection]
  );

  // Delete property
  const handleDeleteProperty = useCallback(
    (propertyId: string) => {
      if (!selectedCollection) return;

      setCollections((prev) =>
        prev.map((c) =>
          c.id === selectedCollection.id
            ? { ...c, properties: c.properties.filter((p) => p.id !== propertyId) }
            : c
        )
      );
      setSelectedCollection((prev) =>
        prev
          ? { ...prev, properties: prev.properties.filter((p) => p.id !== propertyId) }
          : null
      );
      if (selectedProperty?.id === propertyId) {
        setSelectedProperty(null);
      }
      setHasChanges(true);
    },
    [selectedCollection, selectedProperty]
  );

  // Add relationship
  const handleAddRelationship = useCallback((relationship: Omit<SchemaRelationship, 'id'>) => {
    const newRelationship: SchemaRelationship = {
      ...relationship,
      id: `rel_${Date.now()}`,
    };
    setRelationships((prev) => [...prev, newRelationship]);
    setHasChanges(true);
  }, []);

  // Delete relationship
  const handleDeleteRelationship = useCallback((relationshipId: string) => {
    setRelationships((prev) => prev.filter((r) => r.id !== relationshipId));
    setHasChanges(true);
  }, []);

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(collections, relationships);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[600px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-base text-muted-foreground">Loading schema...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[600px] flex flex-col items-center justify-center rounded-xl bg-muted border border-destructive">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-base font-medium text-destructive">Failed to load schema</p>
        <p className="text-sm mt-1 text-destructive">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-6 px-4 py-2 rounded-lg font-medium transition-colors bg-primary text-primary-foreground"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[600px] flex flex-col rounded-xl overflow-hidden bg-background border border-border">
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <Database size={24} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Schema Designer</h2>
          <span className="text-sm px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {collections.length} collections
          </span>
          {hasChanges && (
            <span className="text-sm px-2 py-0.5 rounded-full bg-warning-subtle text-warning-text">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-accent"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              hasChanges ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden border-r border-border bg-muted">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collections..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-card border border-border text-foreground"
              />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredCollections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => handleSelectCollection(collection)}
                className={`w-full px-3 py-3 flex items-center gap-3 text-left transition-colors border-b border-border ${
                  selectedCollection?.id === collection.id ? 'bg-primary/10' : ''
                }`}
              >
                <Database
                  size={18}
                  className={collection.isSystem ? 'text-muted-foreground' : 'text-primary'}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-foreground">
                    {collection.name}
                  </div>
                  <div className="text-xs truncate text-muted-foreground">
                    {collection.code} • {collection.properties.length} properties
                  </div>
                </div>
                {collection.isSystem && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    System
                  </span>
                )}
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-border">
            <button
              onClick={() => setShowNewCollectionModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-primary text-primary-foreground"
            >
              <Plus size={18} />
              New Collection
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedCollection ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-card border-b border-border">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {selectedCollection.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCollection.description || selectedCollection.code}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditorMode('properties')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      editorMode === 'properties'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    Properties
                  </button>
                  <button
                    onClick={() => setEditorMode('relationships')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      editorMode === 'relationships'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <Link2 size={14} className="inline mr-1" />
                    Relationships
                  </button>
                  {!selectedCollection.isSystem && (
                    <button
                      onClick={() => handleDeleteCollection(selectedCollection.id)}
                      className="p-2 rounded-lg transition-colors text-destructive hover:bg-destructive/10"
                      title="Delete collection"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Editor content */}
              <div className="flex-1 flex overflow-hidden">
                {editorMode === 'properties' && (
                  <CollectionPanel
                    collection={selectedCollection}
                    selectedProperty={selectedProperty}
                    onSelectProperty={handleSelectProperty}
                    onAddProperty={() => setShowNewPropertyModal(true)}
                    onDeleteProperty={handleDeleteProperty}
                  />
                )}
                {editorMode === 'relationships' && (
                  <RelationshipEditor
                    collection={selectedCollection}
                    collections={collections}
                    relationships={relationships.filter(
                      (r) =>
                        r.sourceCollection === selectedCollection.id ||
                        r.targetCollection === selectedCollection.id
                    )}
                    onAddRelationship={handleAddRelationship}
                    onDeleteRelationship={handleDeleteRelationship}
                  />
                )}

                {/* Property detail panel */}
                {editorMode === 'properties' && selectedProperty && (
                  <PropertyEditor
                    property={selectedProperty}
                    collection={selectedCollection}
                    collections={collections}
                    onUpdate={(updates) => handleUpdateProperty(selectedProperty.id, updates)}
                    onClose={() => setSelectedProperty(null)}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Database size={48} className="text-muted-foreground" />
              <p className="mt-4 text-base text-muted-foreground">
                Select a collection to view its properties
              </p>
              <p className="text-sm mt-1 text-muted-foreground">
                Or create a new collection to get started
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Collection Modal */}
      {showNewCollectionModal && (
        <NewCollectionModal
          onSubmit={handleAddCollection}
          onClose={() => setShowNewCollectionModal(false)}
        />
      )}

      {/* New Property Modal */}
      {showNewPropertyModal && selectedCollection && (
        <NewPropertyModal
          collection={selectedCollection}
          collections={collections}
          onSubmit={handleAddProperty}
          onClose={() => setShowNewPropertyModal(false)}
        />
      )}
    </div>
  );
};

// New Collection Modal
interface NewCollectionModalProps {
  onSubmit: (name: string, code: string, description?: string) => void;
  onClose: () => void;
}

const NewCollectionModal: React.FC<NewCollectionModalProps> = ({ onSubmit, onClose }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && code.trim()) {
      onSubmit(name.trim(), code.trim(), description.trim() || undefined);
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!code || code === name.toLowerCase().replace(/\s+/g, '_')) {
      setCode(value.toLowerCase().replace(/\s+/g, '_'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
      <div className="w-full max-w-md rounded-xl shadow-lg overflow-hidden bg-card">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">New Collection</h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:bg-accent"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Assets"
              className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder="e.g., assets"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-muted border border-border text-foreground"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-muted border border-border text-foreground"
              rows={3}
            />
          </div>
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
              disabled={!name.trim() || !code.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 bg-primary text-primary-foreground"
            >
              Create Collection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// New Property Modal
interface NewPropertyModalProps {
  collection: SchemaCollection;
  collections: SchemaCollection[];
  onSubmit: (property: Omit<SchemaProperty, 'id'>) => void;
  onClose: () => void;
}

const PROPERTY_TYPES: { value: PropertyType; label: string; category: string }[] = [
  { value: 'string', label: 'Text', category: 'Text' },
  { value: 'text', label: 'Long Text', category: 'Text' },
  { value: 'rich_text', label: 'Rich Text', category: 'Text' },
  { value: 'integer', label: 'Integer', category: 'Number' },
  { value: 'decimal', label: 'Decimal', category: 'Number' },
  { value: 'currency', label: 'Currency', category: 'Number' },
  { value: 'percent', label: 'Percent', category: 'Number' },
  { value: 'boolean', label: 'Checkbox', category: 'Boolean' },
  { value: 'date', label: 'Date', category: 'Date & Time' },
  { value: 'datetime', label: 'Date & Time', category: 'Date & Time' },
  { value: 'time', label: 'Time', category: 'Date & Time' },
  { value: 'duration', label: 'Duration', category: 'Date & Time' },
  { value: 'choice', label: 'Single Select', category: 'Choice' },
  { value: 'multi_choice', label: 'Multi Select', category: 'Choice' },
  { value: 'reference', label: 'Reference', category: 'Relation' },
  { value: 'multi_reference', label: 'Multi Reference', category: 'Relation' },
  { value: 'user_reference', label: 'User', category: 'Relation' },
  { value: 'file', label: 'File', category: 'Media' },
  { value: 'image', label: 'Image', category: 'Media' },
  { value: 'email', label: 'Email', category: 'Contact' },
  { value: 'phone', label: 'Phone', category: 'Contact' },
  { value: 'url', label: 'URL', category: 'Contact' },
  { value: 'formula', label: 'Formula', category: 'Computed' },
  { value: 'rollup', label: 'Rollup', category: 'Computed' },
  { value: 'lookup', label: 'Lookup', category: 'Computed' },
  { value: 'json', label: 'JSON', category: 'Advanced' },
  { value: 'hierarchical', label: 'Hierarchical', category: 'Advanced' },
];

const NewPropertyModal: React.FC<NewPropertyModalProps> = ({
  collection,
  onSubmit,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<PropertyType>('string');
  const [required, setRequired] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && code.trim()) {
      onSubmit({
        name: name.trim(),
        code: code.trim(),
        type,
        required,
        system: false,
      });
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!code || code === name.toLowerCase().replace(/\s+/g, '_')) {
      setCode(value.toLowerCase().replace(/\s+/g, '_'));
    }
  };

  const groupedTypes = PROPERTY_TYPES.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, typeof PROPERTY_TYPES>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
      <div className="w-full max-w-lg rounded-xl shadow-lg overflow-hidden bg-card">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            Add Property to {collection.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:bg-accent"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Serial Number"
                className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="e.g., serial_number"
                className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-muted border border-border text-foreground"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              Type
            </label>
            <div className="max-h-48 overflow-y-auto rounded-lg p-2 bg-muted border border-border">
              {Object.entries(groupedTypes).map(([category, types]) => (
                <div key={category} className="mb-2">
                  <div className="text-xs font-medium mb-1 px-1 text-muted-foreground">
                    {category}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {types.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        className={`px-2 py-1.5 rounded text-sm text-left transition-colors ${
                          type === t.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-foreground'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="required" className="text-sm text-foreground">
              Required field
            </label>
          </div>

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
              disabled={!name.trim() || !code.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 bg-primary text-primary-foreground"
            >
              Add Property
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SchemaDesigner;
