/**
 * TemplateBrowser Component
 * HubbleWave Platform - Phase 2
 *
 * Browse, search, and apply schema/form templates.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Star,
  Eye,
  Plus,
  ChevronRight,
  X,
  Layers,
  Package,
  Building2,
  Users,
  Wallet,
  ClipboardList,
  Shield,
  Boxes,
  Headphones,
  FolderPlus,
} from 'lucide-react';
import {
  SchemaTemplate,
  FormLayoutTemplate,
  ViewTemplate,
  TemplateBundle,
  TemplateCategory,
  TemplateScope,
  TemplateFilterOptions,
  TemplateVariable,
} from './types';

interface TemplateBrowserProps {
  templates: SchemaTemplate[];
  formTemplates?: FormLayoutTemplate[];
  viewTemplates?: ViewTemplate[];
  bundles?: TemplateBundle[];
  onApplyTemplate: (template: SchemaTemplate, variables?: Record<string, unknown>) => Promise<void>;
  onPreviewTemplate?: (template: SchemaTemplate) => void;
  onClose?: () => void;
  mode?: 'schema' | 'form' | 'view' | 'all';
}

// Category icons and Tailwind class mappings
const CATEGORY_CONFIG: Record<TemplateCategory, {
  icon: React.ReactNode;
  label: string;
  textClass: string;
  bgClass: string;
  bgSubtleClass: string;
  borderClass: string;
}> = {
  asset_management: { icon: <Package size={18} />, label: 'Asset Management', textClass: 'text-info-text', bgClass: 'bg-info', bgSubtleClass: 'bg-info-subtle', borderClass: 'border-info-border' },
  project_management: { icon: <ClipboardList size={18} />, label: 'Project Management', textClass: 'text-purple-500', bgClass: 'bg-purple-500', bgSubtleClass: 'bg-purple-500/10', borderClass: 'border-purple-500' },
  crm: { icon: <Users size={18} />, label: 'CRM', textClass: 'text-pink-500', bgClass: 'bg-pink-500', bgSubtleClass: 'bg-pink-500/10', borderClass: 'border-pink-500' },
  hr: { icon: <Building2 size={18} />, label: 'Human Resources', textClass: 'text-warning-text', bgClass: 'bg-warning', bgSubtleClass: 'bg-warning-subtle', borderClass: 'border-warning-border' },
  finance: { icon: <Wallet size={18} />, label: 'Finance', textClass: 'text-success-text', bgClass: 'bg-success', bgSubtleClass: 'bg-success-subtle', borderClass: 'border-success-border' },
  inventory: { icon: <Boxes size={18} />, label: 'Inventory', textClass: 'text-info-text', bgClass: 'bg-info', bgSubtleClass: 'bg-info-subtle', borderClass: 'border-info-border' },
  service_desk: { icon: <Headphones size={18} />, label: 'Service Desk', textClass: 'text-warning-text', bgClass: 'bg-warning', bgSubtleClass: 'bg-warning-subtle', borderClass: 'border-warning-border' },
  compliance: { icon: <Shield size={18} />, label: 'Compliance', textClass: 'text-danger-text', bgClass: 'bg-danger', bgSubtleClass: 'bg-danger-subtle', borderClass: 'border-danger-border' },
  custom: {
    icon: <FolderPlus size={18} />,
    label: 'Custom',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    bgSubtleClass: 'bg-muted/60',
    borderClass: 'border-border',
  },
};

const SCOPE_LABELS: Record<TemplateScope, string> = {
  system: 'System',
  instance: 'Organization',
  personal: 'Personal',
};

// Template Card Component
const TemplateCard: React.FC<{
  template: SchemaTemplate;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  viewMode: 'grid' | 'list';
}> = ({ template, isSelected, onSelect, onPreview, viewMode }) => {
  const categoryConfig = CATEGORY_CONFIG[template.category];

  if (viewMode === 'list') {
    return (
      <div
        className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all border ${
          isSelected
            ? 'bg-primary/10 border-primary'
            : 'bg-muted border-border'
        }`}
        onClick={onSelect}
        role="button"
        aria-pressed={isSelected}
      >
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${categoryConfig.bgSubtleClass} ${categoryConfig.textClass}`}
        >
          {template.icon ? (
            <span className="text-2xl">{template.icon}</span>
          ) : (
            categoryConfig.icon
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold truncate text-foreground">
              {template.name}
            </h4>
            {template.scope === 'system' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-info-subtle text-info-text">
                System
              </span>
            )}
          </div>
          <p className="text-sm truncate mt-0.5 text-muted-foreground">
            {template.description}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted-foreground">
              {template.properties.length} properties
            </span>
            {template.rating && (
              <span className="flex items-center gap-1 text-xs text-warning-text">
                <Star size={12} fill="currentColor" />
                {template.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="p-2 rounded-lg transition-colors bg-accent text-muted-foreground hover:bg-accent/80"
            title="Preview"
            aria-label="Preview template"
          >
            <Eye size={18} />
          </button>
          <ChevronRight size={18} className="text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={`rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg bg-card border-2 ${
        isSelected ? 'border-primary ring-4 ring-primary/20' : 'border-border'
      }`}
      onClick={onSelect}
      role="button"
      aria-pressed={isSelected}
    >
      <div className={`p-4 flex items-center justify-between ${categoryConfig.bgSubtleClass}`}>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${categoryConfig.bgClass} text-primary-foreground`}
        >
          {template.icon ? (
            <span className="text-2xl">{template.icon}</span>
          ) : (
            categoryConfig.icon
          )}
        </div>
        {template.scope === 'system' && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-info-subtle text-info-text">
            System
          </span>
        )}
      </div>

      <div className="p-4">
        <h4 className="font-semibold text-foreground">
          {template.name}
        </h4>
        <p className="text-sm mt-1 line-clamp-2 text-muted-foreground">
          {template.description}
        </p>

        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {template.properties.length} properties
          </span>
          <div className="flex items-center gap-2">
            {template.rating && (
              <span className="flex items-center gap-1 text-xs text-warning-text">
                <Star size={12} fill="currentColor" />
                {template.rating.toFixed(1)}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              className="p-1.5 rounded transition-colors bg-accent text-muted-foreground hover:bg-accent/80"
              title="Preview"
              aria-label="Preview template"
            >
              <Eye size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Variable Input Component
const VariableInput: React.FC<{
  variable: TemplateVariable;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ variable, value, onChange }) => {
  const inputClass = "bg-muted border border-border text-foreground";

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-foreground">
        {variable.label}
        {variable.required && (
          <span className="text-destructive"> *</span>
        )}
      </label>
      {variable.description && (
        <p className="text-xs text-muted-foreground">
          {variable.description}
        </p>
      )}

      {variable.type === 'boolean' ? (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-muted-foreground">
            Enable
          </span>
        </label>
      ) : variable.options ? (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 text-sm rounded-lg ${inputClass}`}
        >
          <option value="">Select...</option>
          {variable.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={variable.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(e) =>
            onChange(
              variable.type === 'number'
                ? parseFloat(e.target.value) || 0
                : e.target.value
            )
          }
          placeholder={`Enter ${variable.label.toLowerCase()}`}
          className={`w-full px-3 py-2 text-sm rounded-lg ${inputClass}`}
        />
      )}
    </div>
  );
};

export const TemplateBrowser: React.FC<TemplateBrowserProps> = ({
  templates,
  onApplyTemplate,
  onPreviewTemplate,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<TemplateFilterOptions>({});
  const [selectedTemplate, setSelectedTemplate] = useState<SchemaTemplate | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, unknown>>({});
  const [isApplying, setIsApplying] = useState(false);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (filters.category && template.category !== filters.category) return false;
      if (filters.scope && template.scope !== filters.scope) return false;
      if (filters.tags && filters.tags.length > 0) {
        if (!filters.tags.some((tag) => template.tags.includes(tag))) return false;
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !template.name.toLowerCase().includes(search) &&
          !template.description.toLowerCase().includes(search) &&
          !template.tags.some((tag) => tag.toLowerCase().includes(search))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [templates, filters]);

  const handleApplyTemplate = useCallback(async () => {
    if (!selectedTemplate) return;

    setIsApplying(true);
    try {
      await onApplyTemplate(selectedTemplate, variableValues);
      onClose?.();
    } finally {
      setIsApplying(false);
    }
  }, [selectedTemplate, variableValues, onApplyTemplate, onClose]);

  const handleSelectTemplate = useCallback((template: SchemaTemplate) => {
    setSelectedTemplate(template);
    // Initialize variable values with defaults
    if (template.variables) {
      const defaults: Record<string, unknown> = {};
      template.variables.forEach((v) => {
        defaults[v.name] = v.defaultValue;
      });
      setVariableValues(defaults);
    }
  }, []);

  return (
    <div className="flex flex-col h-full max-h-[90vh] rounded-xl overflow-hidden bg-card border border-border">
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
            <Layers size={24} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Template Gallery
            </h2>
            <p className="text-sm text-muted-foreground">
              {filteredTemplates.length} templates available
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b border-border">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-muted border border-border text-foreground"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              showFilters ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Filter size={16} />
            Filters
          </button>

          <div className="flex items-center rounded-lg p-1 bg-muted">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-card text-primary' : 'text-muted-foreground'
              }`}
              aria-pressed={viewMode === 'grid'}
              aria-label="Grid view"
            >
              <Grid3X3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list' ? 'bg-card text-primary' : 'text-muted-foreground'
              }`}
              aria-pressed={viewMode === 'list'}
              aria-label="List view"
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="px-6 py-4 flex-shrink-0 border-b border-border bg-muted">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium mb-2 text-muted-foreground">
                Category
              </label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() =>
                      setFilters({
                        ...filters,
                        category: filters.category === key ? undefined : (key as TemplateCategory),
                      })
                    }
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors border ${
                      filters.category === key
                        ? `${config.bgSubtleClass} ${config.textClass} ${config.borderClass}`
                        : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    {config.icon}
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-2 text-muted-foreground">
                Scope
              </label>
              <div className="flex gap-1">
                {Object.entries(SCOPE_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() =>
                      setFilters({
                        ...filters,
                        scope: filters.scope === key ? undefined : (key as TemplateScope),
                      })
                    }
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      filters.scope === key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Layers size={48} className="text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">
                No templates found
              </p>
              <button
                onClick={() => setFilters({})}
                className="mt-2 text-sm text-primary"
              >
                Clear filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplate?.id === template.id}
                  onSelect={() => handleSelectTemplate(template)}
                  onPreview={() => onPreviewTemplate?.(template)}
                  viewMode="grid"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplate?.id === template.id}
                  onSelect={() => handleSelectTemplate(template)}
                  onPreview={() => onPreviewTemplate?.(template)}
                  viewMode="list"
                />
              ))}
            </div>
          )}
        </div>

        {selectedTemplate && (
          <div className="w-80 border-l border-border overflow-y-auto flex-shrink-0 bg-muted">
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {selectedTemplate.name}
                </h3>
                <p className="text-sm mt-1 text-muted-foreground">
                  {selectedTemplate.description}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground">
                  Included Properties ({selectedTemplate.properties.length})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedTemplate.properties.map((prop, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      {prop.name}
                      <span className="text-xs text-muted-foreground">
                        ({prop.type})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 text-foreground">
                    Customize
                  </h4>
                  <div className="space-y-3">
                    {selectedTemplate.variables.map((variable) => (
                      <VariableInput
                        key={variable.name}
                        variable={variable}
                        value={variableValues[variable.name]}
                        onChange={(value) =>
                          setVariableValues({ ...variableValues, [variable.name]: value })
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleApplyTemplate}
                disabled={isApplying}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 bg-primary text-primary-foreground"
              >
                {isApplying ? (
                  <>Creating...</>
                ) : (
                  <>
                    <Plus size={18} />
                    Create from Template
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateBrowser;
