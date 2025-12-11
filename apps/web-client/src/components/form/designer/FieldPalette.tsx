import React, { useState, useMemo } from 'react';
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

interface FieldPaletteProps {
  items: PaletteItem[];
  fieldsInLayout: Set<string>;
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

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const Icon = getIconComponent(item.icon);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${item.protection === 'locked'
          ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
          : isInLayout
            ? 'bg-green-50 border-green-200 cursor-grab'
            : 'bg-white border-slate-200 cursor-grab hover:border-primary-300 hover:shadow-sm'
        }
      `}
    >
      {/* Drag Handle */}
      <div className={`text-slate-300 ${item.protection !== 'locked' ? 'group-hover:text-slate-400' : ''}`}>
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Type Icon */}
      <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${getTypeColor(item.fieldType)}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Label & Code */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{item.label}</p>
        <p className="text-[10px] text-slate-400 truncate">{item.fieldCode}</p>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {item.protection === 'locked' && (
          <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-200" title="System field - Cannot be modified">
            <Lock className="h-3 w-3 text-slate-500" />
          </div>
        )}
        {item.protection === 'required_visible' && (
          <div className="w-5 h-5 rounded flex items-center justify-center bg-amber-100" title="Required field - Cannot be hidden">
            <AlertCircle className="h-3 w-3 text-amber-600" />
          </div>
        )}
        {isInLayout && (
          <div className="w-5 h-5 rounded flex items-center justify-center bg-green-100" title="In layout">
            <Check className="h-3 w-3 text-green-600" />
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
    description: 'Add a new section to organize fields',
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

export const FieldPalette: React.FC<FieldPaletteProps> = ({
  items,
  fieldsInLayout,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'fields' | 'layout' | 'unused'>('all');

  // Filter items based on search and category
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by search
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.label.toLowerCase().includes(term) ||
          (item.fieldCode?.toLowerCase().includes(term)) ||
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
      const fieldType = item.fieldType?.toLowerCase() || '';
      if (['string', 'text', 'rich_text', 'email', 'phone', 'url'].includes(fieldType)) {
        groups.text.push(item);
      } else if (['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(fieldType)) {
        groups.number.push(item);
      } else if (['date', 'datetime', 'time', 'duration'].includes(fieldType)) {
        groups.datetime.push(item);
      } else if (['choice', 'multi_choice', 'tags', 'boolean'].includes(fieldType)) {
        groups.choice.push(item);
      } else if (['reference', 'multi_reference', 'user_reference'].includes(fieldType)) {
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
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields..."
            className="w-full h-8 pl-8 pr-8 text-sm border border-slate-200 rounded-lg bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-3 py-2 border-b border-slate-100 flex gap-1">
        {(['all', 'unused'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeCategory === cat
                ? 'bg-primary-100 text-primary-700'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {cat === 'all' ? `All (${stats.total})` : `Unused (${stats.unused})`}
          </button>
        ))}
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Layout Elements */}
        {activeCategory === 'all' && !search && (
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Layout Elements
            </h4>
            <div className="space-y-1.5">
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

        {/* Field Groups */}
        {Object.entries(groupedItems).map(([group, groupItems]) => {
          if (groupItems.length === 0) return null;
          return (
            <div key={group}>
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                {getGroupLabel(group)} ({groupItems.length})
              </h4>
              <div className="space-y-1.5">
                {groupItems.map((item) => (
                  <DraggablePaletteItem
                    key={item.id}
                    item={item}
                    isInLayout={fieldsInLayout.has(item.fieldCode || '')}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-8">
            <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No fields found</p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-xs text-primary-600 hover:text-primary-700"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{stats.inLayout} of {stats.total} in layout</span>
          <span className="text-slate-400">Drag to add</span>
        </div>
      </div>
    </div>
  );
};

// Helper function to get group label
function getGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    text: 'Text Fields',
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

// Helper function to get type color
function getTypeColor(type?: string): string {
  const t = type?.toLowerCase() || '';
  if (['string', 'text', 'rich_text'].includes(t)) {
    return 'bg-slate-100 text-slate-600';
  }
  if (['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(t)) {
    return 'bg-blue-50 text-blue-600';
  }
  if (['date', 'datetime', 'time', 'duration'].includes(t)) {
    return 'bg-purple-50 text-purple-600';
  }
  if (['boolean', 'choice', 'multi_choice', 'tags'].includes(t)) {
    return 'bg-amber-50 text-amber-600';
  }
  if (['reference', 'multi_reference', 'user_reference'].includes(t)) {
    return 'bg-pink-50 text-pink-600';
  }
  if (['email', 'phone', 'url'].includes(t)) {
    return 'bg-cyan-50 text-cyan-600';
  }
  if (['file', 'image'].includes(t)) {
    return 'bg-green-50 text-green-600';
  }
  return 'bg-slate-100 text-slate-500';
}

export default FieldPalette;
