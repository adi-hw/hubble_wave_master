/**
 * GridCardView - Futuristic Card Grid Layout
 *
 * A modern, glassmorphic card grid view for displaying collection records.
 * Features:
 * - Responsive grid layout with auto-sizing cards
 * - Customizable visible fields per card
 * - Type-aware field rendering with icons and formatting
 * - Hover effects with glow and depth
 * - Column configuration popover
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Check,
  Calendar,
  Mail,
  Phone,
  Link2,
  User,
  Tag,
  Hash,
  DollarSign,
  Percent,
  Clock,
  ToggleLeft,
  Star,
  ChevronDown,
  Search,
  X,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface PropertyDefinition {
  id: string;
  code: string;
  label?: string;
  name?: string;
  dataType?: string;
  propertyType?: string;
  description?: string;
  options?: Array<{ value: string; label: string; color?: string }>;
  choiceList?: Array<{ value: string; label: string; color?: string }>;
}

interface GridCardViewProps {
  data: Record<string, unknown>[];
  properties: PropertyDefinition[];
  loading: boolean;
  collectionCode: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
}

interface FieldConfig {
  code: string;
  visible: boolean;
  order: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getFieldIcon(dataType: string) {
  const iconMap: Record<string, React.ReactNode> = {
    text: <Hash size={12} />,
    string: <Hash size={12} />,
    number: <Hash size={12} />,
    integer: <Hash size={12} />,
    decimal: <Hash size={12} />,
    currency: <DollarSign size={12} />,
    percent: <Percent size={12} />,
    percentage: <Percent size={12} />,
    date: <Calendar size={12} />,
    datetime: <Calendar size={12} />,
    time: <Clock size={12} />,
    duration: <Clock size={12} />,
    boolean: <ToggleLeft size={12} />,
    email: <Mail size={12} />,
    url: <Link2 size={12} />,
    phone: <Phone size={12} />,
    user: <User size={12} />,
    reference: <Link2 size={12} />,
    choice: <Tag size={12} />,
    status: <Tag size={12} />,
    tags: <Tag size={12} />,
    multi_choice: <Tag size={12} />,
    rating: <Star size={12} />,
    priority: <Tag size={12} />,
  };
  return iconMap[dataType?.toLowerCase()] || <Hash size={12} />;
}

function stringToColor(str: string): string {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatValue(value: unknown, dataType: string, options?: Array<{ value: string; label: string; color?: string }>): React.ReactNode {
  if (value == null || value === '') return <span className="text-muted-foreground">-</span>;

  const type = dataType?.toLowerCase() || 'text';

  switch (type) {
    case 'currency': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return '-';
      return (
        <span className="font-mono tabular-nums">
          <span className="text-success-text">$</span>
          {num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }

    case 'percent':
    case 'percentage': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return '-';
      return <span className="font-mono tabular-nums">{num.toFixed(1)}%</span>;
    }

    case 'date': {
      const date = new Date(String(value));
      if (isNaN(date.getTime())) return '-';
      return (
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={12} className="text-muted-foreground" />
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      );
    }

    case 'datetime': {
      const date = new Date(String(value));
      if (isNaN(date.getTime())) return '-';
      return (
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={12} className="text-muted-foreground" />
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      );
    }

    case 'boolean':
      return (
        <span className={`inline-flex items-center gap-1 ${value ? 'text-success-text' : 'text-muted-foreground'}`}>
          <span className={`w-2 h-2 rounded-full ${value ? 'bg-success' : 'bg-muted-foreground'}`} />
          {value ? 'Yes' : 'No'}
        </span>
      );

    case 'choice':
    case 'status':
    case 'priority': {
      const strValue = String(value);
      const option = options?.find(o => o.value === strValue || o.label === strValue);
      const color = option?.color || stringToColor(strValue);
      const label = option?.label || strValue;
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[--badge-bg] text-[--badge-color] border border-[--badge-border]"
          data-badge-color={color}
          ref={(el) => {
            if (el) {
              el.style.setProperty('--badge-bg', `color-mix(in srgb, ${color} 20%, transparent)`);
              el.style.setProperty('--badge-color', color);
              el.style.setProperty('--badge-border', `color-mix(in srgb, ${color} 30%, transparent)`);
            }
          }}
        >
          <ChevronDown size={10} />
          {label}
        </span>
      );
    }

    case 'tags':
    case 'multi_choice': {
      const tags = Array.isArray(value) ? value : [value];
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag, i) => {
            const strTag = String(tag);
            const color = stringToColor(strTag);
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-[--tag-bg] text-[--tag-color] border border-[--tag-border]"
                ref={(el) => {
                  if (el) {
                    el.style.setProperty('--tag-bg', `color-mix(in srgb, ${color} 15%, transparent)`);
                    el.style.setProperty('--tag-color', color);
                    el.style.setProperty('--tag-border', `color-mix(in srgb, ${color} 25%, transparent)`);
                  }
                }}
              >
                {strTag}
              </span>
            );
          })}
          {tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
          )}
        </div>
      );
    }

    case 'user': {
      const name = typeof value === 'object' && value !== null
        ? ((value as Record<string, unknown>).display_name || (value as Record<string, unknown>).name || (value as Record<string, unknown>).username)
        : value;
      const strName = String(name || '');
      if (!strName) return '-';
      const color = stringToColor(strName);
      const initials = strName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
      return (
        <span className="inline-flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-primary-foreground ring-2 ring-offset-1 ring-offset-card bg-[--avatar-bg]"
            ref={(el) => {
              if (el) {
                el.style.setProperty('--avatar-bg', color);
              }
            }}
          >
            {initials}
          </span>
          <span className="truncate">{strName}</span>
        </span>
      );
    }

    case 'email':
      return (
        <span className="inline-flex items-center gap-1.5 text-info-text hover:text-info-text transition-colors">
          <Mail size={12} />
          <span className="truncate">{String(value)}</span>
        </span>
      );

    case 'url':
      return (
        <span className="inline-flex items-center gap-1.5 text-info-text hover:text-info-text transition-colors">
          <Link2 size={12} />
          <span className="truncate max-w-[150px]">{String(value).replace(/^https?:\/\//, '')}</span>
        </span>
      );

    case 'phone':
      return (
        <span className="inline-flex items-center gap-1.5 text-info-text">
          <Phone size={12} />
          {String(value)}
        </span>
      );

    case 'rating': {
      const num = typeof value === 'number' ? value : parseInt(String(value), 10);
      if (isNaN(num)) return '-';
      return (
        <span className="inline-flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={12}
              className={i < num ? 'text-warning-text fill-warning-text' : 'text-muted-foreground'}
            />
          ))}
        </span>
      );
    }

    case 'number':
    case 'integer':
    case 'decimal': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return '-';
      return <span className="font-mono tabular-nums">{num.toLocaleString()}</span>;
    }

    default:
      return <span className="truncate">{String(value)}</span>;
  }
}

// =============================================================================
// COLUMN CONFIG POPOVER
// =============================================================================

function ColumnConfigPopover({
  properties,
  fieldConfig,
  onConfigChange,
  onClose,
}: {
  properties: PropertyDefinition[];
  fieldConfig: FieldConfig[];
  onConfigChange: (config: FieldConfig[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredProps = useMemo(() => {
    const searchLower = search.toLowerCase();
    return properties.filter(p => {
      const label = p.label || p.name || p.code;
      return label.toLowerCase().includes(searchLower) || p.code.toLowerCase().includes(searchLower);
    });
  }, [properties, search]);

  const toggleField = (code: string) => {
    const newConfig = fieldConfig.map(f =>
      f.code === code ? { ...f, visible: !f.visible } : f
    );
    onConfigChange(newConfig);
  };

  const visibleCount = fieldConfig.filter(f => f.visible).length;

  return (
    <div
      ref={popoverRef}
      className="absolute top-full right-0 mt-2 w-72 rounded-xl overflow-hidden z-50 bg-card border border-border shadow-2xl"
    >
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">
            Card Fields
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {visibleCount} visible
          </span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields..."
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg outline-none bg-input border border-border text-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Field List */}
      <div className="max-h-64 overflow-y-auto py-2">
        {filteredProps.map((prop) => {
          const config = fieldConfig.find(f => f.code === prop.code);
          const isVisible = config?.visible ?? true;
          const dataType = prop.dataType || prop.propertyType || 'text';

          return (
            <button
              key={prop.code}
              onClick={() => toggleField(prop.code)}
              className="w-full px-4 py-2 flex items-center gap-3 hover:bg-muted transition-colors"
            >
              <span
                className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                  isVisible
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-transparent text-muted-foreground border border-border'
                }`}
              >
                {isVisible && <Check size={12} />}
              </span>

              <span className="text-muted-foreground">
                {getFieldIcon(dataType)}
              </span>

              <span className="flex-1 text-left text-sm text-foreground">
                {prop.label || prop.name || prop.code}
              </span>

              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {dataType}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// CARD COMPONENT
// =============================================================================

function GridCard({
  item,
  properties,
  fieldConfig,
  onClick,
  isSelected,
  onSelect,
}: {
  item: Record<string, unknown>;
  properties: PropertyDefinition[];
  fieldConfig: FieldConfig[];
  onClick: () => void;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
}) {
  // Get title field (try common names)
  const titleField = properties.find(p =>
    ['title', 'name', 'subject', 'label'].includes(p.code.toLowerCase())
  ) || properties.find(p => (p.dataType || p.propertyType || '').toLowerCase() === 'text');

  const title = titleField ? String(item[titleField.code] || 'Untitled') : 'Untitled';

  // Get visible fields (excluding title)
  const visibleFields = useMemo(() => {
    return fieldConfig
      .filter(f => f.visible && f.code !== titleField?.code && f.code !== 'id')
      .sort((a, b) => a.order - b.order)
      .slice(0, 6); // Max 6 fields on card
  }, [fieldConfig, titleField]);

  // Find priority/status for corner badge
  const priorityProp = properties.find(p => p.code === 'priority' || p.code === 'priority_field');
  const statusProp = properties.find(p => p.code === 'status' || p.code === 'status_field');
  const cornerProp = priorityProp || statusProp;
  const cornerValue = cornerProp ? item[cornerProp.code] as string | null : null;
  const cornerOption = cornerProp?.options?.find(o => o.value === cornerValue) ||
                       cornerProp?.choiceList?.find(o => o.value === cornerValue);

  return (
    <div
      onClick={onClick}
      className={`
        group relative rounded-2xl p-4 cursor-pointer transition-all duration-300
        hover:scale-[1.02] hover:-translate-y-1
        bg-card border border-border shadow-lg
        ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
      `}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-primary/10 to-accent/10 shadow-[0_0_30px_rgba(var(--color-primary-500-rgb),0.15)]"
      />

      {/* Selection Checkbox */}
      <div
        className="absolute top-3 left-3 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e);
        }}
      >
        <div
          className={`
            w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer
            ${isSelected
              ? 'bg-primary border-primary'
              : 'border-muted-foreground hover:border-primary bg-transparent'
            }
          `}
        >
          {isSelected && <Check size={12} className="text-primary-foreground" />}
        </div>
      </div>

      {cornerValue && (
        <div className="absolute top-3 right-3 z-10">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
              cornerOption?.color
                ? 'bg-[--corner-bg] text-[--corner-color] border border-[--corner-border]'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
            ref={(el) => {
              if (el && cornerOption?.color) {
                el.style.setProperty('--corner-bg', `color-mix(in srgb, ${cornerOption.color} 20%, transparent)`);
                el.style.setProperty('--corner-color', cornerOption.color);
                el.style.setProperty('--corner-border', `color-mix(in srgb, ${cornerOption.color} 30%, transparent)`);
              }
            }}
          >
            <ChevronDown size={10} />
            {cornerOption?.label || String(cornerValue)}
          </span>
        </div>
      )}

      <div className="relative z-0 pt-6">
        <h3
          className="text-base font-semibold mb-4 pr-20 line-clamp-2 text-foreground"
        >
          {title}
        </h3>

        {/* Fields */}
        <div className="space-y-3">
          {visibleFields.map((fieldConf) => {
            const prop = properties.find(p => p.code === fieldConf.code);
            if (!prop) return null;

            const value = item[prop.code];
            const dataType = prop.dataType || prop.propertyType || 'text';
            const options = prop.options || prop.choiceList;

            return (
              <div key={prop.code} className="flex items-start gap-2">
                <div className="flex-1 min-w-0 text-sm text-muted-foreground">
                  {formatValue(value, dataType, options)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="absolute bottom-0 left-4 right-4 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GridCardView({
  data,
  properties,
  loading,
  collectionCode,
  onRowClick,
  onSelectionChange,
}: GridCardViewProps) {
  const navigate = useNavigate();
  const safeData = Array.isArray(data) ? data : [];
  const safeProperties = Array.isArray(properties) ? properties : [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [search, setSearch] = useState('');

  // Initialize field configuration
  const [fieldConfig, setFieldConfig] = useState<FieldConfig[]>(() => {
    return safeProperties
      .filter(p => p.code !== 'id' && p.code !== 'created_at' && p.code !== 'updated_at')
      .map((p, i) => ({
        code: p.code,
        visible: i < 8, // Show first 8 fields by default
        order: i,
      }));
  });

  // Update field config when properties change
  useEffect(() => {
    setFieldConfig(prev => {
      const existingCodes = new Set(prev.map(f => f.code));
      const newFields = safeProperties
        .filter(p => !existingCodes.has(p.code) && p.code !== 'id' && p.code !== 'created_at' && p.code !== 'updated_at')
        .map((p, i) => ({
          code: p.code,
          visible: false,
          order: prev.length + i,
        }));
      return [...prev, ...newFields];
    });
  }, [safeProperties]);

  // Filter data by search
  const filteredData = useMemo(() => {
    if (!search.trim()) return safeData;
    const searchLower = search.toLowerCase();
    return safeData.filter(item => {
      return Object.values(item).some(val =>
        val != null && String(val).toLowerCase().includes(searchLower)
      );
    });
  }, [safeData, search]);

  const handleCardClick = useCallback((item: Record<string, unknown>) => {
    if (onRowClick) {
      onRowClick(item);
    } else {
      navigate(`/data/${collectionCode}/${item.id}`);
    }
  }, [navigate, collectionCode, onRowClick]);

  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (e.shiftKey && prev.size > 0) {
        // Shift-click: toggle selection
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd-click: toggle selection
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      } else {
        // Regular click: toggle single
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      }
      return newSet;
    });
  }, []);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedIds));
  }, [selectedIds, onSelectionChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Loading cards...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border"
      >
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or type a command..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg outline-none transition-all focus:ring-2 focus:ring-primary/20 bg-input border border-border text-foreground"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowColumnConfig(!showColumnConfig)}
            className="btn-secondary btn-sm"
          >
            <Eye size={16} />
            <span>Columns</span>
          </button>

          {showColumnConfig && (
            <ColumnConfigPopover
              properties={safeProperties}
              fieldConfig={fieldConfig}
              onConfigChange={setFieldConfig}
              onClose={() => setShowColumnConfig(false)}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-muted"
              >
                <Search size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {search ? 'No matching records found' : 'No records to display'}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]"
          >
            {filteredData.map((item) => (
              <GridCard
                key={String(item.id ?? '')}
                item={item}
                properties={safeProperties}
                fieldConfig={fieldConfig}
                onClick={() => handleCardClick(item)}
                isSelected={selectedIds.has(String(item.id ?? ''))}
                onSelect={(e) => handleSelect(String(item.id ?? ''), e)}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="px-4 py-2 text-xs border-t border-border flex items-center justify-between text-muted-foreground bg-muted"
      >
        <span>
          {filteredData.length} {filteredData.length === 1 ? 'record' : 'records'}
          {search && ` (filtered from ${safeData.length})`}
        </span>
        {selectedIds.size > 0 && (
          <span className="text-primary">
            {selectedIds.size} selected
          </span>
        )}
      </div>
    </div>
  );
}

export default GridCardView;
