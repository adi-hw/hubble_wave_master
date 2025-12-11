import React, { useState, useRef, useEffect } from 'react';
import {
  Layout,
  ChevronDown,
  Check,
  User,
  Building2,
  RotateCcw,
  Settings,
  Star,
  AlertTriangle,
} from 'lucide-react';

export interface LayoutOption {
  id: string;
  name: string;
  type: 'system' | 'admin' | 'role' | 'personal';
  isDefault?: boolean;
  isActive?: boolean;
  version?: number;
  hasConflict?: boolean;
  lastModified?: Date;
  modifiedBy?: string;
}

interface LayoutSwitcherProps {
  /**
   * Available layouts to switch between
   */
  layouts: LayoutOption[];

  /**
   * Currently active layout ID
   */
  activeLayoutId: string;

  /**
   * Callback when a layout is selected
   */
  onSelectLayout: (layoutId: string) => void;

  /**
   * Callback when user wants to customize current layout
   */
  onCustomize?: () => void;

  /**
   * Callback when user wants to reset to default
   */
  onResetToDefault?: () => void;

  /**
   * Callback when there's a version conflict to resolve
   */
  onResolveConflict?: (layoutId: string) => void;

  /**
   * Whether the user has unsaved changes
   */
  hasUnsavedChanges?: boolean;

  /**
   * Compact mode for smaller spaces
   */
  compact?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;
}

export const LayoutSwitcher: React.FC<LayoutSwitcherProps> = ({
  layouts,
  activeLayoutId,
  onSelectLayout,
  onCustomize,
  onResetToDefault,
  onResolveConflict,
  hasUnsavedChanges = false,
  compact = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get active layout
  const activeLayout = layouts.find((l) => l.id === activeLayoutId) || layouts[0];

  // Group layouts by type
  const groupedLayouts = {
    personal: layouts.filter((l) => l.type === 'personal'),
    role: layouts.filter((l) => l.type === 'role'),
    admin: layouts.filter((l) => l.type === 'admin'),
    system: layouts.filter((l) => l.type === 'system'),
  };

  // Get icon for layout type
  const getLayoutIcon = (type: LayoutOption['type']) => {
    switch (type) {
      case 'personal':
        return <User className="h-3.5 w-3.5" />;
      case 'role':
        return <Building2 className="h-3.5 w-3.5" />;
      case 'admin':
        return <Settings className="h-3.5 w-3.5" />;
      case 'system':
        return <Layout className="h-3.5 w-3.5" />;
    }
  };

  // Get color for layout type
  const getLayoutColor = (type: LayoutOption['type']) => {
    switch (type) {
      case 'personal':
        return 'text-purple-600 bg-purple-50';
      case 'role':
        return 'text-blue-600 bg-blue-50';
      case 'admin':
        return 'text-amber-600 bg-amber-50';
      case 'system':
        return 'text-slate-600 bg-slate-100';
    }
  };

  // Get label for layout type group
  const getGroupLabel = (type: LayoutOption['type']) => {
    switch (type) {
      case 'personal':
        return 'My Layouts';
      case 'role':
        return 'Role Layouts';
      case 'admin':
        return 'Admin Layouts';
      case 'system':
        return 'System Default';
    }
  };

  const handleSelectLayout = (layoutId: string) => {
    const layout = layouts.find((l) => l.id === layoutId);
    if (layout?.hasConflict && onResolveConflict) {
      onResolveConflict(layoutId);
    } else {
      onSelectLayout(layoutId);
    }
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          inline-flex items-center gap-2 rounded-lg border transition-all
          ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
          ${disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
          }
          ${isOpen ? 'border-primary-300 ring-2 ring-primary-100' : ''}
        `}
      >
        <div className={`flex items-center justify-center rounded ${getLayoutColor(activeLayout?.type || 'system')} ${compact ? 'w-5 h-5' : 'w-6 h-6'}`}>
          {getLayoutIcon(activeLayout?.type || 'system')}
        </div>

        {!compact && (
          <span className="font-medium truncate max-w-[120px]">
            {activeLayout?.name || 'Default Layout'}
          </span>
        )}

        {hasUnsavedChanges && (
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
        )}

        {activeLayout?.hasConflict && (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
        )}

        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-fade-in">
          {/* Layout Groups */}
          {(['personal', 'role', 'admin', 'system'] as const).map((type) => {
            const group = groupedLayouts[type];
            if (group.length === 0) return null;

            return (
              <div key={type} className="py-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {getGroupLabel(type)}
                </div>
                {group.map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => handleSelectLayout(layout.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                      ${layout.id === activeLayoutId
                        ? 'bg-primary-50 text-primary-700'
                        : 'hover:bg-slate-50 text-slate-700'
                      }
                    `}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${getLayoutColor(layout.type)}`}>
                      {getLayoutIcon(layout.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{layout.name}</span>
                        {layout.isDefault && (
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                        )}
                        {layout.hasConflict && (
                          <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      {layout.version && (
                        <span className="text-[10px] text-slate-400">v{layout.version}</span>
                      )}
                    </div>

                    {layout.id === activeLayoutId && (
                      <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-slate-100" />

          {/* Actions */}
          <div className="px-2 space-y-1">
            {onCustomize && (
              <button
                onClick={() => {
                  onCustomize();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                Customize Layout...
              </button>
            )}

            {onResetToDefault && activeLayout?.type === 'personal' && (
              <button
                onClick={() => {
                  onResetToDefault();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <RotateCcw className="h-4 w-4 text-slate-400" />
                Reset to Default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutSwitcher;
