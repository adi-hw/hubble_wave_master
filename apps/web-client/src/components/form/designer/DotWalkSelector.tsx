import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  Link2,
  Search,
  X,
  Plus,
  Loader2,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { ModelProperty } from '../../../services/platform.service';

interface DotWalkSelectorProps {
  /**
   * The base collection code to start navigating from
   */
  baseCollectionCode: string;

  /**
   * Properties of the base collection (should include reference properties)
   */
  baseProperties: ModelProperty[];

  /**
   * Function to fetch properties for a related collection
   */
  onFetchCollectionProperties: (collectionCode: string) => Promise<ModelProperty[]>;

  /**
   * Maximum depth of reference traversal (default: 3)
   */
  maxDepth?: number;

  /**
   * Callback when a property is selected
   */
  onSelectProperty: (propertyPath: string[], displayLabel: string, finalProperty: ModelProperty) => void;

  /**
   * Callback to close the selector
   */
  onClose: () => void;
}

interface PathNode {
  collectionCode: string;
  propertyCode: string;
  propertyLabel: string;
  properties: ModelProperty[];
  isLoading: boolean;
}

export const DotWalkSelector: React.FC<DotWalkSelectorProps> = ({
  baseCollectionCode,
  baseProperties,
  onFetchCollectionProperties,
  maxDepth = 3,
  onSelectProperty,
  onClose,
}) => {
  const [path, setPath] = useState<PathNode[]>([
    {
      collectionCode: baseCollectionCode,
      propertyCode: '',
      propertyLabel: baseCollectionCode,
      properties: baseProperties,
      isLoading: false,
    },
  ]);
  const [search, setSearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<ModelProperty | null>(null);

  // Get current node
  const currentNode = path[path.length - 1];
  const canGoDeeper = path.length < maxDepth;

  // Filter properties by search
  const filteredProperties = useMemo(() => {
    if (!currentNode.properties) return [];
    if (!search.trim()) return currentNode.properties;

    const term = search.toLowerCase();
    return currentNode.properties.filter(
      (p) =>
        p.label.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term)
    );
  }, [currentNode.properties, search]);

  // Group properties by type
  const groupedProperties = useMemo(() => {
    const references: ModelProperty[] = [];
    const others: ModelProperty[] = [];

    filteredProperties.forEach((property) => {
      if (isReferenceProperty(property.type)) {
        references.push(property);
      } else {
        others.push(property);
      }
    });

    return { references, others };
  }, [filteredProperties]);

  // Get reference collection from property config
  const getReferenceCollection = (property: ModelProperty): string | undefined => {
    return property.config?.referenceCollection;
  };

  // Navigate into a reference property
  const handleNavigateInto = async (property: ModelProperty) => {
    const refCollection = getReferenceCollection(property);
    if (!isReferenceProperty(property.type) || !refCollection) return;
    if (!canGoDeeper) return;

    // Add new loading node
    const newNode: PathNode = {
      collectionCode: refCollection,
      propertyCode: property.code,
      propertyLabel: property.label,
      properties: [],
      isLoading: true,
    };
    setPath([...path, newNode]);
    setSearch('');
    setSelectedProperty(null);

    // Fetch properties for the referenced collection
    try {
      const properties = await onFetchCollectionProperties(refCollection);
      setPath((prev) => {
        const updated = [...prev];
        const lastNode = updated[updated.length - 1];
        if (lastNode.collectionCode === refCollection) {
          lastNode.properties = properties;
          lastNode.isLoading = false;
        }
        return updated;
      });
    } catch (error) {
      console.error('Failed to fetch collection properties:', error);
      setPath((prev) => {
        const updated = [...prev];
        const lastNode = updated[updated.length - 1];
        lastNode.isLoading = false;
        return updated;
      });
    }
  };

  // Go back one level
  const handleGoBack = () => {
    if (path.length <= 1) return;
    setPath(path.slice(0, -1));
    setSearch('');
    setSelectedProperty(null);
  };

  // Navigate to a specific level
  const handleNavigateTo = (index: number) => {
    if (index === path.length - 1) return;
    setPath(path.slice(0, index + 1));
    setSearch('');
    setSelectedProperty(null);
  };

  // Handle property selection
  const handleSelectProperty = (property: ModelProperty) => {
    if (isReferenceProperty(property.type)) {
      // For reference properties, allow both selecting and navigating
      setSelectedProperty(property);
    } else {
      setSelectedProperty(property);
    }
  };

  // Confirm selection
  const handleConfirmSelection = () => {
    if (!selectedProperty) return;

    // Build the full path
    const propertyPath = path.slice(1).map((node) => node.propertyCode);
    propertyPath.push(selectedProperty.code);

    // Build display label
    const labels = path.slice(1).map((node) => node.propertyLabel);
    labels.push(selectedProperty.label);
    const displayLabel = labels.join(' → ');

    onSelectProperty(propertyPath, displayLabel, selectedProperty);
  };

  // Get breadcrumb path string
  const pathString = path.slice(1).map((node) => node.propertyCode).join('.');

  return (
    <div className="rounded-xl shadow-xl w-96 max-h-[500px] flex flex-col overflow-hidden bg-card border border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Dot-Walk Property
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Navigate through references
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close dot-walk selector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {path.map((node, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight className="h-3 w-3 flex-shrink-0 text-border" />
              )}
              <button
                onClick={() => handleNavigateTo(index)}
                className={`px-2 py-1 rounded transition-colors min-h-[44px] flex items-center ${
                  index === path.length - 1
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
                aria-label={`Navigate to ${index === 0 ? node.collectionCode : node.propertyLabel}`}
                aria-current={index === path.length - 1 ? 'location' : undefined}
              >
                {index === 0 ? node.collectionCode : node.propertyLabel}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Current path display */}
        {pathString && (
          <div className="mt-2 px-2 py-1.5 rounded text-xs font-mono bg-muted text-muted-foreground">
            {baseCollectionCode}.{pathString}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search properties..."
            className="w-full h-8 pl-8 pr-8 text-sm rounded-lg focus:outline-none transition-colors border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Search properties"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Properties List */}
      <div className="flex-1 overflow-y-auto p-2" role="list" aria-label="Available properties">
        {currentNode.isLoading ? (
          <div
            className="flex flex-col items-center justify-center py-8 text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <span className="text-sm">Loading properties...</span>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" role="status">
            <Search className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">No properties found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Back button if not at root */}
            {path.length > 1 && (
              <button
                onClick={handleGoBack}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-muted-foreground hover:bg-muted min-h-[44px]"
                aria-label={`Back to ${path[path.length - 2].propertyLabel || path[path.length - 2].collectionCode}`}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {path[path.length - 2].propertyLabel || path[path.length - 2].collectionCode}
              </button>
            )}

            {/* Reference properties (navigable) */}
            {canGoDeeper && groupedProperties.references.length > 0 && (
              <div>
                <h4 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  References ({groupedProperties.references.length})
                </h4>
                <div className="space-y-1">
                  {groupedProperties.references.map((property) => (
                    <div
                      key={property.code}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors min-h-[44px] ${
                        selectedProperty?.code === property.code
                          ? 'bg-primary/10 border border-primary'
                          : 'border border-transparent hover:bg-muted'
                      }`}
                      onClick={() => handleSelectProperty(property)}
                      role="listitem"
                      aria-label={`Reference property: ${property.label}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectProperty(property);
                        }
                      }}
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 text-primary">
                        <Link2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">
                          {property.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {property.code} → {getReferenceCollection(property)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateInto(property);
                        }}
                        className="p-1.5 rounded transition-colors text-muted-foreground hover:text-primary hover:bg-primary/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Navigate into"
                        aria-label={`Navigate into ${property.label}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other properties */}
            {groupedProperties.others.length > 0 && (
              <div>
                <h4 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Properties ({groupedProperties.others.length})
                </h4>
                <div className="space-y-1">
                  {groupedProperties.others.map((property) => {
                    const typeClasses = getPropertyTypeClasses(property.type);
                    return (
                      <div
                        key={property.code}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors min-h-[44px] ${
                          selectedProperty?.code === property.code
                            ? 'bg-primary/10 border border-primary'
                            : 'border border-transparent hover:bg-muted'
                        }`}
                        onClick={() => handleSelectProperty(property)}
                        role="listitem"
                        aria-label={`Property: ${property.label}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectProperty(property);
                          }
                        }}
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${typeClasses}`}>
                          {getPropertyTypeIcon(property.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">
                            {property.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {property.code}
                          </p>
                        </div>
                        {selectedProperty?.code === property.code && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with action buttons */}
      <div className="p-3 flex items-center justify-between border-t border-border bg-muted">
        <div className="text-xs text-muted-foreground">
          {path.length > 1 && selectedProperty && (
            <span className="font-mono">{pathString}.{selectedProperty.code}</span>
          )}
          {path.length === 1 && selectedProperty && (
            <span className="italic text-muted-foreground">
              Select from a reference collection
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium transition-colors text-muted-foreground hover:text-foreground min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSelection}
            disabled={!selectedProperty || path.length === 1}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 min-h-[44px] ${
              !selectedProperty || path.length === 1
                ? 'text-muted-foreground bg-muted cursor-not-allowed'
                : 'text-primary-foreground bg-primary hover:bg-primary/90'
            }`}
            aria-label="Add selected property"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Property
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions
function isReferenceProperty(type: string): boolean {
  return ['reference', 'multi_reference', 'user_reference'].includes(type.toLowerCase());
}

function getPropertyTypeClasses(type: string): string {
  const t = type.toLowerCase();
  if (['string', 'text', 'rich_text'].includes(t)) {
    return 'bg-muted text-muted-foreground';
  }
  if (['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(t)) {
    return 'bg-info-subtle text-info-text';
  }
  if (['date', 'datetime', 'time', 'duration'].includes(t)) {
    return 'bg-primary/10 text-primary';
  }
  if (['boolean', 'choice', 'multi_choice', 'tags'].includes(t)) {
    return 'bg-warning-subtle text-warning-text';
  }
  if (['email', 'phone', 'url'].includes(t)) {
    return 'bg-info-subtle text-info-text';
  }
  if (['file', 'image'].includes(t)) {
    return 'bg-success-subtle text-success-text';
  }
  return 'bg-muted text-muted-foreground';
}

function getPropertyTypeIcon(type: string): React.ReactNode {
  const t = type.toLowerCase();
  if (['string', 'text'].includes(t)) return <span className="text-[10px] font-bold">Aa</span>;
  if (['integer', 'long', 'decimal', 'number'].includes(t)) return <span className="text-[10px] font-bold">#</span>;
  if (['date', 'datetime'].includes(t)) return <span className="text-[10px] font-bold">D</span>;
  if (['boolean'].includes(t)) return <span className="text-[10px] font-bold">?</span>;
  return <span className="text-[10px] font-bold">*</span>;
}

export default DotWalkSelector;
