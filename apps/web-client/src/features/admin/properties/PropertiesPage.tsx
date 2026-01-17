/**
 * PropertiesPage
 * HubbleWave Platform - Phase 3
 *
 * Page for managing property definitions within a collection.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';
import { PropertyList } from './PropertyList';
import { PropertyEditor } from './PropertyEditor';
import { AvaSuggestionsModal } from './AvaSuggestionsModal';
import { propertyApi, PropertyDefinition } from '../../../services/propertyApi';

export const PropertiesPage: React.FC = () => {
  const { id: collectionId, propertyId } = useParams<{ id: string; propertyId?: string }>();
  const navigate = useNavigate();

  const [editorOpen, setEditorOpen] = useState(false);
  const [avaOpen, setAvaOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyDefinition | undefined>(
    undefined
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
    console.log('Delete', property);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSave = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSmartCreate = (suggestion: { dataType: string; formatOptions?: Record<string, unknown> }) => {
    console.log('Applying suggestion:', suggestion);
    setSelectedProperty(undefined);
    setEditorOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/collections.list')}
          className="flex items-center gap-2 text-sm mb-4 transition-colors hover:opacity-80 text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Collections
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1
              className="text-2xl font-semibold mb-2 text-foreground"
            >
              Properties
            </h1>
            <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={() => navigate('/studio/collections')}
                className="transition-colors hover:opacity-80 text-muted-foreground"
              >
                Collections
              </button>
              <ChevronRight
                className="w-4 h-4 text-muted-foreground"
              />
              <span className="text-foreground">{collectionId}</span>
            </nav>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAvaOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded border transition-colors hover:bg-hover border-border text-foreground"
            >
              <Sparkles className="w-4 h-4" />
              Smart Detect
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors hover:opacity-90 bg-primary text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              New Property
            </button>
          </div>
        </div>
      </div>

      <PropertyList
        collectionId={collectionId}
        refreshTrigger={refreshTrigger}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <PropertyEditor
        open={editorOpen}
        collectionId={collectionId}
        property={selectedProperty}
        onClose={handleCloseEditor}
        onSave={handleSave}
      />

      <AvaSuggestionsModal
        open={avaOpen}
        collectionId={collectionId}
        onClose={() => setAvaOpen(false)}
        onApply={handleSmartCreate}
      />
    </div>
  );
};
