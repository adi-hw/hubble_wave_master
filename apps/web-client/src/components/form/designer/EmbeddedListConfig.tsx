import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Layers,
  Search,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
  Loader2,
} from 'lucide-react';
import { ModelProperty } from '../../../services/platform.service';
import { DesignerEmbeddedList } from './types';

interface RelatedCollection {
  collectionCode: string;
  collectionName: string;
  referenceProperty: string; // Property on child collection pointing to parent
  description?: string;
}


interface EmbeddedListConfigProps {
  /**
   * The parent collection code
   */
  parentCollectionCode: string;

  /**
   * Available related collections that reference this collection
   */
  relatedCollections: RelatedCollection[];

  /**
   * Function to fetch properties for a collection
   */
  onFetchCollectionProperties: (collectionCode: string) => Promise<ModelProperty[]>;

  /**
   * Callback when configuration is complete
   */
  onSave: (config: DesignerEmbeddedList) => void;

  /**
   * Callback to close the configurator
   */
  onClose: () => void;

  /**
   * Existing configuration for editing (optional)
   */
  existingConfig?: DesignerEmbeddedList;
}

interface ColumnConfig {
  propertyCode: string;
  label: string;
  visible: boolean;
  width?: number;
}

export const EmbeddedListConfig: React.FC<EmbeddedListConfigProps> = ({
  parentCollectionCode,
  relatedCollections,
  onFetchCollectionProperties,
  onSave,
  onClose,
  existingConfig,
}) => {
  const [step, setStep] = useState<'collection' | 'columns' | 'options'>(existingConfig ? 'columns' : 'collection');
  const [selectedCollection, setSelectedCollection] = useState<RelatedCollection | null>(
    existingConfig
      ? relatedCollections.find((c) => c.collectionCode === existingConfig.collectionCode) || null
      : null
  );
  const [collectionProperties, setCollectionProperties] = useState<ModelProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');

  // Column configuration
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [columnSearch, setColumnSearch] = useState('');

  // Options
  const [label, setLabel] = useState(existingConfig?.label || '');
  const [description, setDescription] = useState(existingConfig?.description || '');
  const [maxRows, setMaxRows] = useState(existingConfig?.maxRows || 10);
  const [allowCreate, setAllowCreate] = useState(existingConfig?.allowCreate ?? true);
  const [allowEdit, setAllowEdit] = useState(existingConfig?.allowEdit ?? true);
  const [allowDelete, setAllowDelete] = useState(existingConfig?.allowDelete ?? false);
  const [collapsible, setCollapsible] = useState(existingConfig?.collapsible ?? true);
  const [defaultCollapsed, setDefaultCollapsed] = useState(existingConfig?.defaultCollapsed ?? false);
  const [sortProperty, setSortProperty] = useState(existingConfig?.defaultSort?.property || '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    existingConfig?.defaultSort?.direction || 'desc'
  );

  // Load properties when collection is selected
  useEffect(() => {
    if (selectedCollection) {
      loadCollectionProperties(selectedCollection.collectionCode);
    }
  }, [selectedCollection]);

  // Initialize columns from existing config
  useEffect(() => {
    if (existingConfig && collectionProperties.length > 0) {
      const existingColumns = existingConfig.columns.map((code) => {
        const property = collectionProperties.find((p) => p.code === code);
        return {
          propertyCode: code,
          label: property?.label || code,
          visible: true,
        };
      });
      setColumns(existingColumns);
    }
  }, [existingConfig, collectionProperties]);

  const loadCollectionProperties = async (collectionCode: string) => {
    setLoadingProperties(true);
    try {
      const properties = await onFetchCollectionProperties(collectionCode);
      setCollectionProperties(properties);

      // If no existing config, pre-select some common columns
      if (!existingConfig) {
        const defaultColumns = properties
          .filter((p) => !['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(p.code))
          .slice(0, 5)
          .map((p) => ({
            propertyCode: p.code,
            label: p.label,
            visible: true,
          }));
        setColumns(defaultColumns);
      }
    } catch (error) {
      console.error('Failed to load collection properties:', error);
    } finally {
      setLoadingProperties(false);
    }
  };

  // Filter collections by search
  const filteredCollections = useMemo(() => {
    if (!collectionSearch.trim()) return relatedCollections;
    const term = collectionSearch.toLowerCase();
    return relatedCollections.filter(
      (c) =>
        c.collectionName.toLowerCase().includes(term) ||
        c.collectionCode.toLowerCase().includes(term)
    );
  }, [relatedCollections, collectionSearch]);

  // Filter available properties
  const availableProperties = useMemo(() => {
    const selectedCodes = new Set(columns.map((c) => c.propertyCode));
    let available = collectionProperties.filter((p) => !selectedCodes.has(p.code));

    if (columnSearch.trim()) {
      const term = columnSearch.toLowerCase();
      available = available.filter(
        (p) =>
          p.label.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term)
      );
    }

    return available;
  }, [collectionProperties, columns, columnSearch]);

  // Handle collection selection
  const handleSelectCollection = (collection: RelatedCollection) => {
    setSelectedCollection(collection);
    setLabel(collection.collectionName);
    setStep('columns');
  };

  // Handle add column
  const handleAddColumn = (property: ModelProperty) => {
    setColumns([
      ...columns,
      {
        propertyCode: property.code,
        label: property.label,
        visible: true,
      },
    ]);
  };

  // Handle remove column
  const handleRemoveColumn = (propertyCode: string) => {
    setColumns(columns.filter((c) => c.propertyCode !== propertyCode));
  };

  // Handle reorder columns
  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    [newColumns[index], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[index]];
    setColumns(newColumns);
  };

  // Handle save
  const handleSave = () => {
    if (!selectedCollection || columns.length === 0) return;

    const config: DesignerEmbeddedList = {
      type: 'embedded_list',
      id: existingConfig?.id || `embedded-${Date.now()}`,
      label,
      description: description || undefined,
      collectionCode: selectedCollection.collectionCode,
      referenceProperty: selectedCollection.referenceProperty,
      columns: columns.filter((c) => c.visible).map((c) => c.propertyCode),
      defaultSort: sortProperty ? { property: sortProperty, direction: sortDirection } : undefined,
      maxRows,
      allowCreate,
      allowEdit,
      allowDelete,
      collapsible,
      defaultCollapsed,
      span: 4, // Full width by default
    };

    onSave(config);
  };

  // Validate current step
  const canProceed = () => {
    switch (step) {
      case 'collection':
        return selectedCollection !== null;
      case 'columns':
        return columns.filter((c) => c.visible).length > 0;
      case 'options':
        return label.trim().length > 0;
      default:
        return false;
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="embedded-list-config-title"
      aria-modal="true"
      className="rounded-xl shadow-xl w-[500px] max-h-[600px] flex flex-col overflow-hidden bg-card border border-border"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3
                id="embedded-list-config-title"
                className="text-sm font-semibold text-foreground"
              >
                {existingConfig ? 'Edit Embedded List' : 'Add Embedded List'}
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Display related records from another collection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 mt-4" role="tablist" aria-label="Configuration steps">
          {(['collection', 'columns', 'options'] as const).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <div className="flex-1 h-px bg-border" />}
              <button
                onClick={() => s !== 'collection' || !existingConfig ? null : setStep(s)}
                disabled={
                  (s === 'columns' && !selectedCollection) ||
                  (s === 'options' && columns.length === 0)
                }
                role="tab"
                aria-selected={step === s}
                aria-label={`Step ${i + 1}: ${s === 'collection' ? 'Select Collection' : s === 'columns' ? 'Columns' : 'Options'}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors min-h-[44px] ${
                  step === s
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    step === s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </span>
                {s === 'collection' ? 'Select Collection' : s === 'columns' ? 'Columns' : 'Options'}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {/* Step 1: Select Collection */}
        {step === 'collection' && (
          <div className="p-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
                placeholder="Search related collections..."
                aria-label="Search related collections"
                className="w-full h-8 pl-8 pr-3 text-sm rounded-lg focus:outline-none transition-colors border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Collection List */}
            <div className="space-y-2" role="listbox" aria-label="Related collections">
              {filteredCollections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No related collections found</p>
                  <p className="text-xs mt-1">
                    Collections that reference {parentCollectionCode} will appear here
                  </p>
                </div>
              ) : (
                filteredCollections.map((collection) => (
                  <button
                    key={collection.collectionCode}
                    onClick={() => handleSelectCollection(collection)}
                    role="option"
                    aria-selected={selectedCollection?.collectionCode === collection.collectionCode}
                    aria-label={`Select ${collection.collectionName} collection`}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left min-h-[44px] border ${
                      selectedCollection?.collectionCode === collection.collectionCode
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                      <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{collection.collectionName}</p>
                      <p className="text-xs truncate text-muted-foreground">
                        {collection.collectionCode} • via {collection.referenceProperty}
                      </p>
                      {collection.description && (
                        <p className="text-xs truncate mt-0.5 text-muted-foreground/70">
                          {collection.description}
                        </p>
                      )}
                    </div>
                    {selectedCollection?.collectionCode === collection.collectionCode && (
                      <Check className="h-5 w-5 flex-shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Configure Columns */}
        {step === 'columns' && (
          <div className="p-4 space-y-4">
            {loadingProperties ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <span className="text-sm">Loading properties...</span>
              </div>
            ) : (
              <>
                {/* Selected Columns */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                    Selected Columns ({columns.length})
                  </h4>
                  <div
                    className="space-y-1 min-h-[100px] p-2 border border-dashed rounded-lg border-border"
                    role="list"
                    aria-label="Selected columns"
                  >
                    {columns.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        Add columns from below
                      </div>
                    ) : (
                      columns.map((col, index) => (
                        <div
                          key={col.propertyCode}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-card border border-border"
                          role="listitem"
                        >
                          <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/50" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground">
                              {col.label}
                            </span>
                            <span className="text-xs ml-2 text-muted-foreground/70">
                              {col.propertyCode}
                            </span>
                          </div>
                          <button
                            onClick={() => handleMoveColumn(index, 'up')}
                            disabled={index === 0}
                            aria-label={`Move ${col.label} up`}
                            className="p-1 disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveColumn(index, 'down')}
                            disabled={index === columns.length - 1}
                            aria-label={`Move ${col.label} down`}
                            className="p-1 disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveColumn(col.propertyCode)}
                            aria-label={`Remove ${col.label}`}
                            className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Available Properties */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                    Available Properties
                  </h4>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      placeholder="Search properties..."
                      aria-label="Search available properties"
                      className="w-full h-8 pl-8 pr-3 text-sm rounded-lg focus:outline-none transition-colors border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="max-h-[150px] overflow-y-auto space-y-1" role="list" aria-label="Available properties">
                    {availableProperties.map((property) => (
                      <button
                        key={property.code}
                        onClick={() => handleAddColumn(property)}
                        aria-label={`Add ${property.label} column`}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-lg transition-colors min-h-[44px] hover:bg-muted"
                      >
                        <Plus className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">
                          {property.label}
                        </span>
                        <span className="text-xs text-muted-foreground/70">{property.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Options */}
        {step === 'options' && (
          <div className="p-4 space-y-4">
            {/* Label */}
            <div>
              <label htmlFor="display-label" className="block text-xs font-medium mb-1 text-foreground">
                Display Label *
              </label>
              <input
                id="display-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                aria-required="true"
                className="w-full h-9 px-3 text-sm rounded-lg focus:outline-none transition-colors border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-xs font-medium mb-1 text-foreground">
                Description
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="w-full h-9 px-3 text-sm rounded-lg focus:outline-none transition-colors border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Default Sort */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sort-field" className="block text-xs font-medium mb-1 text-foreground">
                  Default Sort
                </label>
                <select
                  id="sort-field"
                  value={sortProperty}
                  onChange={(e) => setSortProperty(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg focus:outline-none transition-colors border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">None</option>
                  {collectionProperties.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sort-direction" className="block text-xs font-medium mb-1 text-foreground">
                  Direction
                </label>
                <select
                  id="sort-direction"
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                  disabled={!sortProperty}
                  aria-disabled={!sortProperty}
                  className="w-full h-9 px-3 text-sm rounded-lg focus:outline-none transition-colors disabled:opacity-50 border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>

            {/* Max Rows */}
            <div>
              <label htmlFor="max-rows" className="block text-xs font-medium mb-1 text-foreground">
                Max Rows to Display
              </label>
              <input
                id="max-rows"
                type="number"
                value={maxRows}
                onChange={(e) => setMaxRows(parseInt(e.target.value) || 10)}
                min={1}
                max={100}
                aria-valuemin={1}
                aria-valuemax={100}
                className="w-full h-9 px-3 text-sm rounded-lg focus:outline-none transition-colors border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-2" role="group" aria-label="List options">
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={allowCreate}
                  onChange={(e) => setAllowCreate(e.target.checked)}
                  className="w-4 h-4 rounded focus:ring-2 border-border accent-primary"
                />
                <span className="text-sm text-foreground">Allow creating new records</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={allowEdit}
                  onChange={(e) => setAllowEdit(e.target.checked)}
                  className="w-4 h-4 rounded focus:ring-2 border-border accent-primary"
                />
                <span className="text-sm text-foreground">Allow editing records</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={allowDelete}
                  onChange={(e) => setAllowDelete(e.target.checked)}
                  className="w-4 h-4 rounded focus:ring-2 border-border accent-primary"
                />
                <span className="text-sm text-foreground">Allow deleting records</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={collapsible}
                  onChange={(e) => setCollapsible(e.target.checked)}
                  className="w-4 h-4 rounded focus:ring-2 border-border accent-primary"
                />
                <span className="text-sm text-foreground">Collapsible section</span>
              </label>
              {collapsible && (
                <label className="flex items-center gap-2 cursor-pointer ml-6 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={defaultCollapsed}
                    onChange={(e) => setDefaultCollapsed(e.target.checked)}
                    className="w-4 h-4 rounded focus:ring-2 border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">Collapsed by default</span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 flex items-center justify-between border-t border-border bg-muted">
        <button
          onClick={() => {
            if (step === 'columns') setStep('collection');
            else if (step === 'options') setStep('columns');
          }}
          disabled={step === 'collection'}
          aria-label="Go back to previous step"
          className="px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] text-muted-foreground hover:text-foreground"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            aria-label="Cancel configuration"
            className="px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          {step === 'options' ? (
            <button
              onClick={handleSave}
              disabled={!canProceed()}
              aria-label={existingConfig ? 'Save changes' : 'Add embedded list'}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:cursor-not-allowed min-h-[44px] ${
                canProceed()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {existingConfig ? 'Save Changes' : 'Add Embedded List'}
            </button>
          ) : (
            <button
              onClick={() => {
                if (step === 'collection') setStep('columns');
                else if (step === 'columns') setStep('options');
              }}
              disabled={!canProceed()}
              aria-label="Continue to next step"
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:cursor-not-allowed min-h-[44px] ${
                canProceed()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbeddedListConfig;
