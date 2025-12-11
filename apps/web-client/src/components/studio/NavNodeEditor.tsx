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
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {node.icon && <Icon name={node.icon} className="h-5 w-5 text-slate-500" />}
          <h3 className="text-lg font-semibold text-slate-800">
            {isNew ? 'New Node' : node.label || 'Edit Node'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {node.isVisible === false ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              <EyeOff className="h-3 w-3" />
              Hidden
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
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
          <label className="text-xs font-semibold uppercase text-slate-500">Key</label>
          <input
            type="text"
            value={node.key}
            onChange={(e) => updateField('key', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
            disabled={disabled || !isNew}
            placeholder="unique-key"
            className={`
              w-full px-3 py-2 rounded-lg border text-sm font-mono
              ${disabled || !isNew
                ? 'bg-slate-100 border-slate-200 text-slate-500'
                : 'bg-white border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
              }
            `}
          />
          <p className="text-xs text-slate-500">Unique identifier for patch targeting</p>
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-slate-500">Type</label>
          <select
            value={node.type}
            onChange={(e) => updateField('type', e.target.value as NavNodeType)}
            disabled={disabled || !isNew}
            className={`
              w-full px-3 py-2 rounded-lg border text-sm
              ${disabled || !isNew
                ? 'bg-slate-100 border-slate-200 text-slate-500'
                : 'bg-white border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
              }
            `}
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
          <label className="text-xs font-semibold uppercase text-slate-500">Label</label>
          <input
            type="text"
            value={node.label}
            onChange={(e) => updateField('label', e.target.value)}
            disabled={disabled}
            placeholder="Display Label"
            className={`
              w-full px-3 py-2 rounded-lg border text-sm
              ${disabled
                ? 'bg-slate-100 border-slate-200 text-slate-500'
                : 'bg-white border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
              }
            `}
          />
        </div>
      )}

      {/* Icon (not for separator) */}
      {!isSeparator && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-slate-500">Icon</label>
          <div className="flex items-center gap-2">
            <select
              value={node.icon || ''}
              onChange={(e) => updateField('icon', e.target.value || undefined)}
              disabled={disabled}
              className={`
                flex-1 px-3 py-2 rounded-lg border text-sm
                ${disabled
                  ? 'bg-slate-100 border-slate-200 text-slate-500'
                  : 'bg-white border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
                }
              `}
            >
              <option value="">No icon</option>
              {ICON_OPTIONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
            {node.icon && (
              <div className="p-2 bg-slate-100 rounded-lg">
                <Icon name={node.icon} className="h-5 w-5 text-slate-600" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Module Picker (for module type) */}
      {isModule && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-slate-500">Module</label>
          <ModulePicker
            value={node.moduleKey}
            onChange={(key) => updateField('moduleKey', key)}
            modules={modules}
            disabled={disabled}
            placeholder="Select a module..."
          />
        </div>
      )}

      {/* URL (for link type) */}
      {isLink && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-slate-500">URL</label>
          <input
            type="url"
            value={node.url || ''}
            onChange={(e) => updateField('url', e.target.value || undefined)}
            disabled={disabled}
            placeholder="https://example.com"
            className={`
              w-full px-3 py-2 rounded-lg border text-sm
              ${disabled
                ? 'bg-slate-100 border-slate-200 text-slate-500'
                : 'bg-white border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
              }
            `}
          />
        </div>
      )}

      {/* Smart Group Type */}
      {isSmartGroup && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-slate-500">Smart Group Type</label>
          <select
            value={node.smartGroupType || ''}
            onChange={(e) => updateField('smartGroupType', e.target.value as NavNodeData['smartGroupType'])}
            disabled={disabled}
            className={`
              w-full px-3 py-2 rounded-lg border text-sm
              ${disabled
                ? 'bg-slate-100 border-slate-200 text-slate-500'
                : 'bg-white border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
              }
            `}
          >
            <option value="">Select type...</option>
            {SMART_GROUP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Order */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-slate-500">Sort Order</label>
        <input
          type="number"
          value={node.order ?? 0}
          onChange={(e) => updateField('order', parseInt(e.target.value) || 0)}
          disabled={disabled}
          className={`
            w-32 px-3 py-2 rounded-lg border text-sm
            ${disabled
              ? 'bg-slate-100 border-slate-200 text-slate-500'
              : 'bg-white border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
            }
          `}
        />
      </div>

      {/* Visibility Toggle */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={node.isVisible !== false}
            onChange={(e) => updateField('isVisible', e.target.checked ? undefined : false)}
            disabled={disabled}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span className="text-sm text-slate-700">Visible in navigation</span>
        </label>
      </div>

      {/* Visibility Rules Section */}
      {!isSeparator && (
        <div className="border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setShowVisibility(!showVisibility)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            {showVisibility ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Visibility Rules
          </button>

          {showVisibility && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
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
        <div className="border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setShowContextTags(!showContextTags)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
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
              <p className="text-xs text-slate-500">
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
                className={`
                  w-full px-3 py-2 rounded-lg border text-sm
                  ${disabled
                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                    : 'bg-white border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
                  }
                `}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        {onDelete && !isNew && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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
