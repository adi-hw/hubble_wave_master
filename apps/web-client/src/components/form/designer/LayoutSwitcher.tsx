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

  // Get Tailwind classes for layout type badge
  const getLayoutBadgeClasses = (type: LayoutOption['type']) => {
    switch (type) {
      case 'personal':
        return 'bg-primary/10 text-primary';
      case 'role':
        return 'bg-info-subtle text-info-text';
      case 'admin':
        return 'bg-warning-subtle text-warning-text';
      case 'system':
        return 'bg-muted text-muted-foreground';
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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Layout switcher"
        className={`
          inline-flex items-center gap-2 rounded-lg border transition-all min-h-[44px]
          ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
          ${
            disabled
              ? 'bg-muted border-border text-muted-foreground cursor-not-allowed'
              : 'bg-card border-border text-foreground hover:border-primary/50'
          }
          ${isOpen && !disabled ? 'border-primary ring-2 ring-primary/20' : ''}
        `}
      >
        <div
          className={`flex items-center justify-center rounded ${compact ? 'w-5 h-5' : 'w-6 h-6'} ${getLayoutBadgeClasses(activeLayout?.type || 'system')}`}
        >
          {getLayoutIcon(activeLayout?.type || 'system')}
        </div>

        {!compact && (
          <span className="font-medium truncate max-w-[120px]">
            {activeLayout?.name || 'Default Layout'}
          </span>
        )}

        {hasUnsavedChanges && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 bg-warning"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          />
        )}

        {activeLayout?.hasConflict && (
          <AlertTriangle
            className="h-3.5 w-3.5 flex-shrink-0 text-warning-text"
            aria-label="Layout conflict"
          />
        )}

        <ChevronDown
          className={`h-4 w-4 transition-transform text-muted-foreground ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Layout options"
          className="absolute right-0 mt-1 w-64 rounded-xl shadow-lg py-2 z-50 animate-fade-in bg-card border border-border"
        >
          {/* Layout Groups */}
          {(['personal', 'role', 'admin', 'system'] as const).map((type) => {
            const group = groupedLayouts[type];
            if (group.length === 0) return null;

            return (
              <div key={type} className="py-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {getGroupLabel(type)}
                </div>
                {group.map((layout) => (
                  <button
                    key={layout.id}
                    role="option"
                    aria-selected={layout.id === activeLayoutId}
                    onClick={() => handleSelectLayout(layout.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 text-left transition-colors min-h-[44px]
                      ${
                        layout.id === activeLayoutId
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted'
                      }
                    `}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${getLayoutBadgeClasses(layout.type)}`}
                    >
                      {getLayoutIcon(layout.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{layout.name}</span>
                        {layout.isDefault && (
                          <Star
                            className="h-3 w-3 flex-shrink-0 text-warning-text fill-warning-text"
                            aria-label="Default layout"
                          />
                        )}
                        {layout.hasConflict && (
                          <AlertTriangle
                            className="h-3 w-3 flex-shrink-0 text-warning-text"
                            aria-label="Layout conflict"
                          />
                        )}
                      </div>
                      {layout.version && (
                        <span className="text-[10px] text-muted-foreground">v{layout.version}</span>
                      )}
                    </div>

                    {layout.id === activeLayoutId && (
                      <Check className="h-4 w-4 flex-shrink-0 text-primary" aria-label="Selected" />
                    )}
                  </button>
                ))}
              </div>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-border" />

          {/* Actions */}
          <div className="px-2 space-y-1">
            {onCustomize && (
              <button
                onClick={() => {
                  onCustomize();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-foreground hover:bg-muted min-h-[44px]"
                aria-label="Customize layout"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Customize Layout...
              </button>
            )}

            {onResetToDefault && activeLayout?.type === 'personal' && (
              <button
                onClick={() => {
                  onResetToDefault();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-foreground hover:bg-muted min-h-[44px]"
                aria-label="Reset to default layout"
              >
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
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
