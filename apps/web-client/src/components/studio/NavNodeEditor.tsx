/**
 * NavNodeEditor Component
 *
 * Editor panel for navigation node properties.
 */

import React, { useState } from 'react';
import {
  FolderOpen,
  Link as LinkIcon,
  Package,
  Minus,
  Star,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Icon } from '../Icon';
import { VisibilityRuleEditor, VisibilityRules } from './VisibilityRuleEditor';
import { ModulePicker, ModuleOption } from './ModulePicker';

export type NavNodeType = 'group' | 'module' | 'link' | 'separator' | 'smart_group';

export interface NavNodeData {
  key: string;
  label: string;
  icon?: string;
  type: NavNodeType;
  moduleKey?: string;
  url?: string;
  parentKey?: string;
  order?: number;
  isVisible?: boolean;
  visibility?: VisibilityRules;
  contextTags?: string[];
  smartGroupType?: 'favorites' | 'recent' | 'frequent';
}

interface NavNodeEditorProps {
  node: NavNodeData;
  onChange: (node: NavNodeData) => void;
  onSave?: () => void;
  onDelete?: () => void;
  modules?: ModuleOption[];
  availableRoles?: string[];
  availablePermissions?: string[];
  availableFlags?: string[];
  parentOptions?: { key: string; label: string }[];
  isNew?: boolean;
  disabled?: boolean;
}

const NODE_TYPE_OPTIONS: { value: NavNodeType; label: string; icon: React.ReactNode }[] = [
  { value: 'group', label: 'Group', icon: <FolderOpen className="h-4 w-4" /> },
  { value: 'module', label: 'Module', icon: <Package className="h-4 w-4" /> },
  { value: 'link', label: 'External Link', icon: <LinkIcon className="h-4 w-4" /> },
  { value: 'separator', label: 'Separator', icon: <Minus className="h-4 w-4" /> },
  { value: 'smart_group', label: 'Smart Group', icon: <Star className="h-4 w-4" /> },
];

const SMART_GROUP_OPTIONS = [
  { value: 'favorites', label: 'Favorites' },
  { value: 'recent', label: 'Recently Used' },
  { value: 'frequent', label: 'Frequently Used' },
];

// Common Lucide icons for navigation
const ICON_OPTIONS = [
  'Home', 'LayoutDashboard', 'Package', 'Folder', 'FileText', 'Settings', 'Users',
  'Shield', 'Database', 'GitBranch', 'Bell', 'Calendar', 'Clock', 'Search',
  'Star', 'Heart', 'Bookmark', 'Tag', 'Layers', 'Grid', 'List', 'Box',
  'Truck', 'Building', 'Wrench', 'Tool', 'Zap', 'Activity', 'BarChart',
  'PieChart', 'TrendingUp', 'DollarSign', 'CreditCard', 'ShoppingCart',
];

export const NavNodeEditor: React.FC<NavNodeEditorProps> = ({
  node,
  onChange,
  onSave,
  onDelete,
  modules = [],
  availableRoles = [],
  availablePermissions = [],
  availableFlags = [],
  parentOptions = [],
  isNew = false,
  disabled = false,
}) => {
  const [showVisibility, setShowVisibility] = useState(
    !!(node.visibility?.rolesAny?.length ||
      node.visibility?.rolesAll?.length ||
      node.visibility?.permissionsAny?.length ||
      node.visibility?.featureFlagsAny?.length ||
      node.visibility?.expression)
  );
  const [showContextTags, setShowContextTags] = useState(!!node.contextTags?.length);

  const updateField = <K extends keyof NavNodeData>(field: K, value: NavNodeData[K]) => {
    onChange({ ...node, [field]: value });
  };

  const isSeparator = node.type === 'separator';
  const isSmartGroup = node.type === 'smart_group';
  const isModule = node.type === 'module';
  const isLink = node.type === 'link';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div 
        className="flex items-center justify-between pb-4 border-b"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div className="flex items-center gap-2">
          {node.icon && (
            <span style={{ color: 'var(--text-muted)' }}>
              <Icon name={node.icon} className="h-5 w-5" />
            </span>
          )}
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isNew ? 'New Node' : node.label || 'Edit Node'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {node.isVisible === false ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-600">
              <EyeOff className="h-3 w-3" />
              Hidden
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-600">
              <Eye className="h-3 w-3" />
              Visible
            </span>
          )}
        </div>
      </div>

      {/* Basic Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Key</label>
          <input
            type="text"
            value={node.key}
            onChange={(e) => updateField('key', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
            disabled={disabled || !isNew}
            placeholder="unique-key"
            className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
            style={{ 
              backgroundColor: disabled || !isNew ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              color: disabled || !isNew ? 'var(--text-muted)' : 'var(--text-primary)'
            }}
          />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Unique identifier for patch targeting</p>
        </div>



        {/* Parent Group */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Parent Group</label>
          <select
             value={node.parentKey || ''}
             onChange={(e) => updateField('parentKey', e.target.value || undefined)}
             disabled={disabled}
             className="w-full px-3 py-2 rounded-lg border text-sm"
             style={{ 
               backgroundColor: disabled ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
               borderColor: 'var(--border-default)',
               color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
             }}
          >
            <option value="">(Root Level)</option>
            {parentOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Type</label>
          <select
            value={node.type}
            onChange={(e) => updateField('type', e.target.value as NavNodeType)}
            disabled={disabled || !isNew}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ 
              backgroundColor: disabled || !isNew ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              color: disabled || !isNew ? 'var(--text-muted)' : 'var(--text-primary)'
            }}
          >
            {NODE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Label (not for separator) */}
      {!isSeparator && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Label</label>
          <input
            type="text"
            value={node.label}
            onChange={(e) => updateField('label', e.target.value)}
            disabled={disabled}
            placeholder="Display Label"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ 
              backgroundColor: disabled ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
            }}
          />
        </div>
      )}

      {/* Icon (not for separator) */}
      {!isSeparator && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Icon</label>
          <div className="flex items-center gap-2">
            <select
              value={node.icon || ''}
              onChange={(e) => updateField('icon', e.target.value || undefined)}
              disabled={disabled}
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={{ 
                backgroundColor: disabled ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
                borderColor: 'var(--border-default)',
                color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
              }}
            >
              <option value="">No icon</option>
              {ICON_OPTIONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
            {node.icon && (
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-surface-secondary)' }}
              >
                <span style={{ color: 'var(--text-primary)' }}>
                  <Icon name={node.icon} className="h-5 w-5" />
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Module Picker (for module/group types) */}
      {(isModule || node.type === 'group') && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Module</label>
          <ModulePicker
            value={node.moduleKey}
            onChange={(val) => updateField('moduleKey', val)}
            modules={modules}
            disabled={disabled}
            placeholder="Select a module..."
          />
        </div>
      )}

      {/* URL (for link type) */}
      {isLink && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>URL</label>
          <input
            type="text"
            value={node.url || ''}
            onChange={(e) => updateField('url', e.target.value)}
            disabled={disabled}
            placeholder="https://example.com"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ 
              backgroundColor: disabled || !isNew ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              color: disabled || !isNew ? 'var(--text-muted)' : 'var(--text-primary)'
            }}
          />
        </div>
      )}

      {/* Smart Group Type (for smart_group) */}
      {isSmartGroup && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Smart Group Type</label>
          <select
            value={node.smartGroupType || 'recent'}
            onChange={(e) => updateField('smartGroupType', e.target.value as any)}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ 
              backgroundColor: disabled ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
            }}
          >
            {SMART_GROUP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sort Order */}
      {!isSeparator && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Sort Order</label>
          <input
            type="number"
            value={node.order}
            onChange={(e) => updateField('order', parseInt(e.target.value) || 0)}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ 
              backgroundColor: disabled ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
            }}
          />
        </div>
      )}

      {/* Visibility Toggle */}
      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="isVisible"
          checked={node.isVisible ?? true}
          onChange={(e) => updateField('isVisible', e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
        />
        <label htmlFor="isVisible" className="text-sm font-medium cursor-pointer">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Visible in navigation</span>
        </label>
      </div>

      {/* Visibility Rules Section */}
      {!isSeparator && (
        <div className="border-t pt-4" style={{ borderColor: 'var(--border-default)' }}>
          <button
            type="button"
            onClick={() => setShowVisibility(!showVisibility)}
            className="flex items-center gap-2 text-sm font-medium hover:opacity-80"
            style={{ color: 'var(--text-primary)' }}
          >
            {showVisibility ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Visibility Rules
          </button>

          {showVisibility && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <VisibilityRuleEditor
                value={node.visibility || {}}
                onChange={(v) => updateField('visibility', Object.keys(v).length > 0 ? v : undefined)}
                availableRoles={availableRoles}
                availablePermissions={availablePermissions}
                availableFlags={availableFlags}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {/* Context Tags Section */}
      {!isSeparator && (
        <div className="border-t pt-4" style={{ borderColor: 'var(--border-default)' }}>
          <button
            type="button"
            onClick={() => setShowContextTags(!showContextTags)}
            className="flex items-center gap-2 text-sm font-medium hover:opacity-80"
            style={{ color: 'var(--text-primary)' }}
          >
            {showContextTags ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Context Tags
          </button>

          {showContextTags && (
            <div className="mt-4 space-y-2">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Tags for device/context filtering (e.g., mobile, desktop, beta)
              </p>
              <input
                type="text"
                value={node.contextTags?.join(', ') || ''}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
                  updateField('contextTags', tags.length > 0 ? tags : undefined);
                }}
                disabled={disabled}
                placeholder="mobile, desktop, beta"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ 
                  backgroundColor: disabled ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div 
        className="flex items-center justify-between pt-4 border-t"
        style={{ borderColor: 'var(--border-default)' }}
      >
        {onDelete && !isNew && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        )}
        <div className="flex-1" />
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={disabled || !node.key}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-4 w-4" />
            {isNew ? 'Create' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
};

export default NavNodeEditor;
