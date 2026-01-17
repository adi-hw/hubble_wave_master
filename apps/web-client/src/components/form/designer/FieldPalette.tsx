import React, { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Search,
  X,
  GripVertical,
  Lock,
  AlertCircle,
  Check,
  Type,
  Hash,
  Calendar,
  Clock,
  ToggleLeft,
  List,
  Link2,
  User,
  Mail,
  Phone,
  Globe,
  FileText,
  Paperclip,
  Image,
  Code,
  DollarSign,
  Percent,
  Tag,
  LayoutGrid,
  ListOrdered,
  SeparatorHorizontal,
  Info,
  Square,
} from 'lucide-react';
import { PaletteItem } from './types';

interface PropertyPaletteProps {
  items: PaletteItem[];
  propertiesInLayout: Set<string>;
}

// Helper function to get type icon classes
function getTypeIconClasses(type?: string): string {
  const t = type?.toLowerCase() || '';

  // Text properties - use neutral/surface colors
  if (['string', 'text', 'rich_text'].includes(t)) {
    return 'bg-muted text-muted-foreground';
  }

  // Number properties - use interactive primary (blue-ish)
  if (['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(t)) {
    return 'bg-primary/10 text-primary';
  }

  // Date/Time properties - use accent colors (purple-ish)
  if (['date', 'datetime', 'time', 'duration'].includes(t)) {
    return 'bg-accent/20 text-accent-foreground';
  }

  // Choice/Selection properties - use warning colors (amber-ish)
  if (['boolean', 'choice', 'multi_choice', 'tags'].includes(t)) {
    return 'bg-warning-subtle text-warning-text';
  }

  // Reference properties - use secondary interactive colors (pink-ish)
  if (['reference', 'multi_reference', 'user_reference'].includes(t)) {
    return 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400';
  }

  // Contact properties (email, phone, url) - use info colors (cyan-ish)
  if (['email', 'phone', 'url'].includes(t)) {
    return 'bg-info-subtle text-info-text';
  }

  // File/Image properties - use success colors (green-ish)
  if (['file', 'image'].includes(t)) {
    return 'bg-success-subtle text-success-text';
  }

  // Default fallback
  return 'bg-muted text-muted-foreground';
}

// Draggable palette item component
const DraggablePaletteItem: React.FC<{
  item: PaletteItem;
  isInLayout: boolean;
}> = ({ item, isInLayout }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: item.protection === 'locked',
    data: { item },
  });

  const Icon = getIconComponent(item.icon);

  const isLocked = item.protection === 'locked';

  // Base transform style for drag
  const transformStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)${isDragging ? ' scale(0.95)' : ''}` }
    : {};

  // Determine container classes based on state
  const getContainerClasses = () => {
    const base = 'group flex items-center gap-2 px-2.5 py-2 min-h-[44px] border rounded-lg transition-all duration-150';

    if (isLocked) {
      return `${base} bg-muted border-border cursor-not-allowed opacity-60`;
    }
    if (isInLayout) {
      return `${base} bg-success-subtle border-success-border cursor-grab`;
    }
    return `${base} bg-card border-border cursor-grab hover:border-primary hover:shadow-sm`;
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="listitem"
      aria-label={`${item.label} property ${isInLayout ? '(in layout)' : ''} ${isLocked ? '(locked)' : ''}`}
      aria-disabled={isLocked}
      style={transformStyle}
      className={`${getContainerClasses()} ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Drag Handle */}
      <div className="text-border group-hover:text-muted-foreground">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Type Icon */}
      <div
        className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${getTypeIconClasses(item.propertyType)}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Label & Code */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground">
          {item.label}
        </p>
        <p className="text-[10px] truncate text-muted-foreground">
          {item.propertyCode}
        </p>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isLocked && (
          <div
            role="status"
            aria-label="System property - Cannot be modified"
            title="System property - Cannot be modified"
            className="w-5 h-5 rounded flex items-center justify-center bg-muted"
          >
            <Lock className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
        {item.protection === 'required_visible' && (
          <div
            role="status"
            aria-label="Required property - Cannot be hidden"
            title="Required property - Cannot be hidden"
            className="w-5 h-5 rounded flex items-center justify-center bg-warning-subtle"
          >
            <AlertCircle className="h-3 w-3 text-warning-text" />
          </div>
        )}
        {isInLayout && (
          <div
            role="status"
            aria-label="In layout"
            title="In layout"
            className="w-5 h-5 rounded flex items-center justify-center bg-success-subtle"
          >
            <Check className="h-3 w-3 text-success-text" />
          </div>
        )}
      </div>
    </div>
  );
};

// Layout element items for the palette
const layoutElements: PaletteItem[] = [
  {
    id: 'palette-new-section',
    type: 'new_section',
    label: 'Section',
    icon: 'layout-grid',
    description: 'Add a new section to organize properties',
    category: 'layout',
  },
  {
    id: 'palette-spacer',
    type: 'spacer',
    label: 'Spacer',
    icon: 'separator-horizontal',
    description: 'Add vertical space',
    category: 'layout',
  },
  {
    id: 'palette-divider',
    type: 'divider',
    label: 'Divider',
    icon: 'separator-horizontal',
    description: 'Add a horizontal line',
    category: 'layout',
  },
  {
    id: 'palette-info-box',
    type: 'info_box',
    label: 'Info Box',
    icon: 'info',
    description: 'Display informational text',
    category: 'display',
  },
];

export const PropertyPalette: React.FC<PropertyPaletteProps> = ({
  items,
  propertiesInLayout,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'properties' | 'layout' | 'unused'>('all');

  // Filter items based on search and category
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by search
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.label.toLowerCase().includes(term) ||
          (item.propertyCode?.toLowerCase().includes(term)) ||
          (item.description?.toLowerCase().includes(term))
      );
    }

    // Filter by category
    if (activeCategory === 'unused') {
      filtered = filtered.filter((item) => !item.isInLayout);
    }

    return filtered;
  }, [items, search, activeCategory]);

  // Group items by type category
  const groupedItems = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {
      text: [],
      number: [],
      datetime: [],
      choice: [],
      reference: [],
      other: [],
    };

    filteredItems.forEach((item) => {
      const propertyType = item.propertyType?.toLowerCase() || '';
      if (['string', 'text', 'rich_text', 'email', 'phone', 'url'].includes(propertyType)) {
        groups.text.push(item);
      } else if (['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(propertyType)) {
        groups.number.push(item);
      } else if (['date', 'datetime', 'time', 'duration'].includes(propertyType)) {
        groups.datetime.push(item);
      } else if (['choice', 'multi_choice', 'tags', 'boolean'].includes(propertyType)) {
        groups.choice.push(item);
      } else if (['reference', 'multi_reference', 'user_reference'].includes(propertyType)) {
        groups.reference.push(item);
      } else {
        groups.other.push(item);
      }
    });

    return groups;
  }, [filteredItems]);

  const stats = useMemo(() => ({
    total: items.length,
    inLayout: items.filter((i) => i.isInLayout).length,
    unused: items.filter((i) => !i.isInLayout).length,
  }), [items]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search properties..."
            aria-label="Search properties"
            className="w-full h-8 pl-8 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div
        className="px-3 py-2 flex gap-1 border-b border-border"
        role="tablist"
        aria-label="Property categories"
      >
        {(['all', 'unused'] as const).map((cat) => {
          const isActive = activeCategory === cat;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${cat}-panel`}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors min-h-[32px] ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat === 'all' ? `All (${stats.total})` : `Unused (${stats.unused})`}
            </button>
          );
        })}
      </div>

      {/* Properties List */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-4"
        role="tabpanel"
        id={`${activeCategory}-panel`}
        aria-labelledby={`${activeCategory}-tab`}
      >
        {/* Layout Elements */}
        {activeCategory === 'all' && !search && (
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
              Layout Elements
            </h4>
            <div className="space-y-1.5" role="list" aria-label="Layout elements">
              {layoutElements.map((item) => (
                <DraggablePaletteItem
                  key={item.id}
                  item={item}
                  isInLayout={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Property Groups */}
        {Object.entries(groupedItems).map(([group, groupItems]) => {
          if (groupItems.length === 0) return null;
          return (
            <div key={group}>
              <h4 className="text-[10px] font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                {getGroupLabel(group)} ({groupItems.length})
              </h4>
              <div className="space-y-1.5" role="list" aria-label={getGroupLabel(group)}>
                {groupItems.map((item) => (
                  <DraggablePaletteItem
                    key={item.id}
                    item={item}
                    isInLayout={propertiesInLayout.has(item.propertyCode || '')}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <EmptyState search={search} onClearSearch={() => setSearch('')} />
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-3 py-2 border-t border-border bg-muted">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {stats.inLayout} of {stats.total} in layout
          </span>
          <span className="text-muted-foreground/70">
            Drag to add
          </span>
        </div>
      </div>
    </div>
  );
};

// Empty state component
const EmptyState: React.FC<{
  search: string;
  onClearSearch: () => void;
}> = ({ search, onClearSearch }) => {
  return (
    <div className="text-center py-8" role="status" aria-live="polite">
      <Search className="h-8 w-8 mx-auto mb-2 text-border" />
      <p className="text-sm text-muted-foreground">
        No properties found
      </p>
      {search && (
        <button
          onClick={onClearSearch}
          className="mt-2 text-xs text-primary hover:text-primary/80 min-h-[32px]"
        >
          Clear search
        </button>
      )}
    </div>
  );
};

// Helper function to get group label
function getGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    text: 'Text Properties',
    number: 'Numbers',
    datetime: 'Date & Time',
    choice: 'Selection',
    reference: 'References',
    other: 'Other',
  };
  return labels[group] || group;
}

// Helper function to get icon component
function getIconComponent(iconName: string): React.ComponentType<{ className?: string }> {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    type: Type,
    'file-text': FileText,
    hash: Hash,
    'dollar-sign': DollarSign,
    percent: Percent,
    calendar: Calendar,
    clock: Clock,
    'toggle-left': ToggleLeft,
    list: List,
    'link-2': Link2,
    user: User,
    mail: Mail,
    phone: Phone,
    globe: Globe,
    paperclip: Paperclip,
    image: Image,
    code: Code,
    tags: Tag,
    'layout-grid': LayoutGrid,
    'list-ordered': ListOrdered,
    'separator-horizontal': SeparatorHorizontal,
    info: Info,
    square: Square,
  };
  return icons[iconName] || Square;
}

// Deprecated alias for backward compatibility
export const FieldPalette = PropertyPalette;

export default PropertyPalette;
