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
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          {node.icon && (
            <span className="text-muted-foreground">
              <Icon name={node.icon} className="h-5 w-5" />
            </span>
          )}
          <h3 className="text-lg font-semibold text-foreground">
            {isNew ? 'New Node' : node.label || 'Edit Node'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {node.isVisible === false ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-warning-subtle text-warning-text">
              <EyeOff className="h-3 w-3" />
              Hidden
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-success-subtle text-success-text">
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
          <label htmlFor="node-key" className="text-xs font-semibold uppercase text-muted-foreground">Key</label>
          <input
            id="node-key"
            type="text"
            value={node.key}
            onChange={(e) => updateField('key', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
            disabled={disabled || !isNew}
            placeholder="unique-key"
            aria-label="Node unique identifier key"
            className={`w-full px-3 py-2 rounded-lg border border-border text-sm font-mono ${
              disabled || !isNew ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground'
            }`}
          />
          <p className="text-xs text-muted-foreground">Unique identifier for patch targeting</p>
        </div>



        {/* Parent Group */}
        <div className="space-y-1.5">
          <label htmlFor="node-parent" className="text-xs font-semibold uppercase text-muted-foreground">Parent Group</label>
          <select
             id="node-parent"
             value={node.parentKey || ''}
             onChange={(e) => updateField('parentKey', e.target.value || undefined)}
             disabled={disabled}
             aria-label="Parent group selection"
             className={`w-full px-3 py-2 rounded-lg border border-border text-sm ${
               disabled ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground'
             }`}
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
          <label htmlFor="node-type" className="text-xs font-semibold uppercase text-muted-foreground">Type</label>
          <select
            id="node-type"
            value={node.type}
            onChange={(e) => updateField('type', e.target.value as NavNodeType)}
            disabled={disabled || !isNew}
            aria-label="Node type"
            className={`w-full px-3 py-2 rounded-lg border border-border text-sm ${
              disabled || !isNew ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground'
            }`}
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
          <label htmlFor="node-label" className="text-xs font-semibold uppercase text-muted-foreground">Label</label>
          <input
            id="node-label"
            type="text"
            value={node.label}
            onChange={(e) => updateField('label', e.target.value)}
            disabled={disabled}
            placeholder="Display Label"
            aria-label="Node display label"
            className={`w-full px-3 py-2 rounded-lg border border-border text-sm ${
              disabled ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground'
            }`}
          />
        </div>
      )}

      {/* Icon (not for separator) */}
      {!isSeparator && (
        <div className="space-y-1.5">
          <label htmlFor="node-icon" className="text-xs font-semibold uppercase text-muted-foreground">Icon</label>
          <div className="flex items-center gap-2">
            <select
              id="node-icon"
              value={node.icon || ''}
              onChange={(e) => updateField('icon', e.target.value || undefined)}
              disabled={disabled}
              aria-label="Node icon"
              className={`flex-1 px-3 py-2 rounded-lg border border-border text-sm ${
                disabled ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground'
              }`}
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
                className="p-2 rounded-lg bg-muted"
                aria-label="Icon preview"
              >
                <span className="text-foreground">
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
          <label className="text-xs font-semibold uppercase text-muted-foreground">Module</label>
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
          <label htmlFor="node-url" className="text-xs font-semibold uppercase text-muted-foreground">URL</label>
          <input
            id="node-url"
            type="text"
            value={node.url || ''}
            onChange={(e) => updateField('url', e.target.value)}
            disabled={disabled}
            placeholder="https://example.com"
            aria-label="External link URL"
            className={`w-full px-3 py-2 rounded-lg border border-border text-sm ${
              disabled || !isNew ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground'
            }`}
          />
        </div>
      )}

      {/* Smart Group Type (for smart_group) */}
      {isSmartGroup && (
        <div className="space-y-1.5">
          <label htmlFor="node-smart-group-type" className="text-xs font-semibold uppercase text-muted-foreground">Smart Group Type</label>
          <select
            id="node-smart-group-type"
            value={node.smartGroupType || 'recent'}
            onChange={(e) => updateField('smartGroupType', e.target.value as any)}
            disabled={disabled}
            aria-label="Smart group type"
            className={`w-full px-3 py-2 rounded-lg border border-border text-sm ${
              disabled ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground'
            }`}
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
          <label htmlFor="node-order" className="text-xs font-semibold uppercase text-muted-foreground">Sort Order</label>
          <input
            id="node-order"
            type="number"
            value={node.order}
            onChange={(e) => updateField('order', parseInt(e.target.value) || 0)}
            disabled={disabled}
            aria-label="Sort order"
            className={`w-full px-3 py-2 rounded-lg border border-border text-sm ${
              disabled ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground'
            }`}
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
          aria-label="Visible in navigation"
          className="h-4 w-4 rounded border-border text-primary accent-primary"
        />
        <label htmlFor="isVisible" className="text-sm font-medium cursor-pointer">
          <span className="text-sm text-foreground">Visible in navigation</span>
        </label>
      </div>

      {/* Visibility Rules Section */}
      {!isSeparator && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowVisibility(!showVisibility)}
            aria-expanded={showVisibility}
            aria-controls="visibility-rules-content"
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-80 min-h-[44px]"
          >
            {showVisibility ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Visibility Rules
          </button>

          {showVisibility && (
            <div id="visibility-rules-content" className="mt-4 p-4 rounded-lg bg-card">
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
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowContextTags(!showContextTags)}
            aria-expanded={showContextTags}
            aria-controls="context-tags-content"
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-80 min-h-[44px]"
          >
            {showContextTags ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Context Tags
          </button>

          {showContextTags && (
            <div id="context-tags-content" className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Tags for device/context filtering (e.g., mobile, desktop, beta)
              </p>
              <input
                id="node-context-tags"
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
                aria-label="Context tags"
                className={`w-full px-3 py-2 rounded-lg border border-border text-sm ${
                  disabled ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground'
                }`}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        {onDelete && !isNew && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label="Delete node"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-destructive bg-transparent hover:bg-destructive/10 min-h-[44px]"
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
            aria-label={isNew ? 'Create node' : 'Save node'}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-primary-foreground bg-primary hover:bg-primary/90 min-h-[44px]"
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
