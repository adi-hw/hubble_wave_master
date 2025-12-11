import React, { useState } from 'react';
import {
  Settings2,
  Type,
  Eye,
  Trash2,
  ChevronDown,
  ChevronRight,
  Columns2,
  Columns3,
  Square,
  Layers,
  ToggleLeft,
} from 'lucide-react';
import { ModelField } from '../../../services/platform.service';
import {
  DesignerItem,
  DesignerSection,
  DesignerTab,
  DesignerState,
  DesignerField,
  VisibilityCondition,
} from './types';
import { ConditionBuilder } from './ConditionBuilder';

interface PropertiesPanelProps {
  selectedItem: DesignerItem | null;
  selectedSection: DesignerSection | null;
  selectedTab: DesignerTab | null;
  selectedItemType: DesignerState['selectedItemType'];
  fields: ModelField[];
  onUpdateItem: (id: string, updates: Partial<DesignerItem>) => void;
  onUpdateSection: (id: string, updates: Partial<DesignerSection>) => void;
  onUpdateTab: (id: string, updates: Partial<DesignerTab>) => void;
  onRemoveItem: (id: string) => void;
  onRemoveSection: (id: string) => void;
  onRemoveTab: (id: string) => void;
}

// Collapsible section for properties
const PropertySection: React.FC<{
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {icon}
          {title}
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
};

// Input component for properties
const PropertyInput: React.FC<{
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  helpText?: string;
  type?: 'text' | 'textarea';
}> = ({ label, value, onChange, placeholder, helpText, type = 'text' }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    {type === 'textarea' ? (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none resize-none"
        rows={3}
      />
    ) : (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none"
      />
    )}
    {helpText && <p className="text-[10px] text-slate-400 mt-1">{helpText}</p>}
  </div>
);

// Toggle component
const PropertyToggle: React.FC<{
  label: string;
  checked: boolean | undefined;
  onChange: (checked: boolean) => void;
  helpText?: string;
}> = ({ label, checked, onChange, helpText }) => (
  <div className="flex items-start justify-between">
    <div className="flex-1">
      <span className="text-sm text-slate-700">{label}</span>
      {helpText && <p className="text-[10px] text-slate-400 mt-0.5">{helpText}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-primary-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

// Select component
const PropertySelect: React.FC<{
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  options: { value: string | number; label: string }[];
  helpText?: string;
}> = ({ label, value, onChange, options, helpText }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none bg-white"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {helpText && <p className="text-[10px] text-slate-400 mt-1">{helpText}</p>}
  </div>
);

// Column selector
const ColumnSelector: React.FC<{
  value: 1 | 2 | 3 | 4;
  onChange: (value: 1 | 2 | 3 | 4) => void;
}> = ({ value, onChange }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-2">Columns</label>
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
      {([1, 2, 3, 4] as const).map((cols) => (
        <button
          key={cols}
          onClick={() => onChange(cols)}
          className={`flex-1 h-8 flex items-center justify-center rounded-md transition-colors ${
            value === cols
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {cols === 1 && <Square className="h-4 w-4" />}
          {cols === 2 && <Columns2 className="h-4 w-4" />}
          {cols === 3 && <Columns3 className="h-4 w-4" />}
          {cols === 4 && <span className="text-sm font-medium">4</span>}
        </button>
      ))}
    </div>
  </div>
);

// Span selector for fields
const SpanSelector: React.FC<{
  value: 1 | 2 | 3 | 4 | undefined;
  maxColumns: number;
  onChange: (value: 1 | 2 | 3 | 4) => void;
}> = ({ value, maxColumns, onChange }) => {
  const spans = [1, 2, 3, 4].filter((s) => s <= maxColumns) as (1 | 2 | 3 | 4)[];

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">Width (Column Span)</label>
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
        {spans.map((span) => (
          <button
            key={span}
            onClick={() => onChange(span)}
            className={`flex-1 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
              (value || 1) === span
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {span}
          </button>
        ))}
      </div>
    </div>
  );
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedItem,
  selectedSection,
  selectedTab,
  selectedItemType,
  fields,
  onUpdateItem,
  onUpdateSection,
  onUpdateTab,
  onRemoveItem,
  onRemoveSection,
  onRemoveTab,
}) => {
  // No selection
  if (!selectedItem && !selectedSection && !selectedTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Settings2 className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-700 mb-1">No Selection</h3>
        <p className="text-xs text-slate-500">
          Select a field, section, or tab to view its properties
        </p>
      </div>
    );
  }

  // Tab properties
  if (selectedTab && selectedItemType === 'tab') {
    return (
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-medium text-slate-700">Tab</span>
            </div>
            <button
              onClick={() => onRemoveTab(selectedTab.id)}
              className="p-1.5 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
              title="Delete tab"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <PropertySection
          title="General"
          icon={<Settings2 className="h-4 w-4 text-slate-400" />}
        >
          <PropertyInput
            label="Label"
            value={selectedTab.label}
            onChange={(value) => onUpdateTab(selectedTab.id, { label: value })}
            placeholder="Tab name"
          />
          <PropertySelect
            label="Icon"
            value={selectedTab.icon || 'layers'}
            onChange={(value) => onUpdateTab(selectedTab.id, { icon: value })}
            options={[
              { value: 'layers', label: 'Layers' },
              { value: 'file-text', label: 'Document' },
              { value: 'settings', label: 'Settings' },
              { value: 'users', label: 'Users' },
              { value: 'history', label: 'History' },
              { value: 'link-2', label: 'References' },
              { value: 'paperclip', label: 'Attachments' },
            ]}
          />
        </PropertySection>

        <PropertySection
          title="Visibility"
          icon={<Eye className="h-4 w-4 text-slate-400" />}
          defaultOpen={false}
        >
          <ConditionBuilder
            fields={fields}
            condition={selectedTab.visibilityCondition}
            onChange={(condition) =>
              onUpdateTab(selectedTab.id, { visibilityCondition: condition })
            }
            title="Show Tab When"
            mode="visibility"
          />
        </PropertySection>
      </div>
    );
  }

  // Section properties
  if (selectedSection && selectedItemType === 'section') {
    return (
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-medium text-slate-700">Section</span>
            </div>
            <button
              onClick={() => onRemoveSection(selectedSection.id)}
              className="p-1.5 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
              title="Delete section"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <PropertySection
          title="General"
          icon={<Settings2 className="h-4 w-4 text-slate-400" />}
        >
          <PropertyInput
            label="Label"
            value={selectedSection.label}
            onChange={(value) => onUpdateSection(selectedSection.id, { label: value || undefined })}
            placeholder="Section label (optional)"
          />
          <PropertyInput
            label="Description"
            value={selectedSection.description}
            onChange={(value) => onUpdateSection(selectedSection.id, { description: value || undefined })}
            placeholder="Section description"
            type="textarea"
          />
        </PropertySection>

        <PropertySection
          title="Layout"
          icon={<Columns2 className="h-4 w-4 text-slate-400" />}
        >
          <ColumnSelector
            value={selectedSection.columns}
            onChange={(value) => onUpdateSection(selectedSection.id, { columns: value })}
          />
        </PropertySection>

        <PropertySection
          title="Behavior"
          icon={<ToggleLeft className="h-4 w-4 text-slate-400" />}
        >
          <PropertyToggle
            label="Collapsible"
            checked={selectedSection.collapsible}
            onChange={(checked) => onUpdateSection(selectedSection.id, { collapsible: checked })}
            helpText="Allow users to collapse this section"
          />
          {selectedSection.collapsible && (
            <PropertyToggle
              label="Default Collapsed"
              checked={selectedSection.defaultCollapsed}
              onChange={(checked) => onUpdateSection(selectedSection.id, { defaultCollapsed: checked })}
              helpText="Start collapsed when form loads"
            />
          )}
        </PropertySection>

        <PropertySection
          title="Visibility"
          icon={<Eye className="h-4 w-4 text-slate-400" />}
          defaultOpen={false}
        >
          <ConditionBuilder
            fields={fields}
            condition={selectedSection.visibilityCondition}
            onChange={(condition) =>
              onUpdateSection(selectedSection.id, { visibilityCondition: condition })
            }
            title="Show Section When"
            mode="visibility"
          />
        </PropertySection>
      </div>
    );
  }

  // Field item properties
  if (selectedItem && selectedItem.type === 'field') {
    const field = fields.find((f) => f.code === selectedItem.fieldCode);

    return (
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-medium text-slate-700">Field</span>
            </div>
            <button
              onClick={() => onRemoveItem(selectedItem.id)}
              className="p-1.5 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
              title="Remove field"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">{selectedItem.fieldCode}</p>
        </div>

        <PropertySection
          title="Display"
          icon={<Type className="h-4 w-4 text-slate-400" />}
        >
          <PropertyInput
            label="Label Override"
            value={selectedItem.labelOverride}
            onChange={(value) =>
              onUpdateItem(selectedItem.id, { labelOverride: value || undefined } as Partial<DesignerItem>)
            }
            placeholder={field?.label || 'Default label'}
            helpText="Leave empty to use the default field label"
          />
          <PropertyInput
            label="Placeholder"
            value={selectedItem.placeholder}
            onChange={(value) =>
              onUpdateItem(selectedItem.id, { placeholder: value || undefined } as Partial<DesignerItem>)
            }
            placeholder="Enter placeholder text..."
          />
          <PropertyInput
            label="Help Text"
            value={selectedItem.helpText}
            onChange={(value) =>
              onUpdateItem(selectedItem.id, { helpText: value || undefined } as Partial<DesignerItem>)
            }
            placeholder="Help text shown below field"
            type="textarea"
          />
        </PropertySection>

        <PropertySection
          title="Layout"
          icon={<Columns2 className="h-4 w-4 text-slate-400" />}
        >
          <SpanSelector
            value={selectedItem.span}
            maxColumns={4} // This should come from the parent section
            onChange={(value) =>
              onUpdateItem(selectedItem.id, { span: value } as Partial<DesignerItem>)
            }
          />
        </PropertySection>

        <PropertySection
          title="Behavior"
          icon={<ToggleLeft className="h-4 w-4 text-slate-400" />}
        >
          <PropertyToggle
            label="Read Only"
            checked={selectedItem.readOnly}
            onChange={(checked) =>
              onUpdateItem(selectedItem.id, { readOnly: checked } as Partial<DesignerItem>)
            }
            helpText="Prevent users from editing this field"
          />
        </PropertySection>

        <PropertySection
          title="Visibility"
          icon={<Eye className="h-4 w-4 text-slate-400" />}
          defaultOpen={false}
        >
          <ConditionBuilder
            fields={fields}
            condition={(selectedItem as DesignerField).visibilityCondition}
            onChange={(condition: VisibilityCondition | undefined) =>
              onUpdateItem(selectedItem.id, { visibilityCondition: condition } as Partial<DesignerItem>)
            }
            title="Show Field When"
            mode="visibility"
          />
        </PropertySection>

        {/* Field Info */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[10px] font-medium uppercase text-slate-400 mb-1">Field Info</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Type:</span>
              <span className="text-slate-700 font-medium">{field?.type || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Required:</span>
              <span className="text-slate-700 font-medium">
                {field?.config?.validators?.required ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generic item properties
  if (selectedItem) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-medium text-slate-700 capitalize">
                {selectedItem.type.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={() => onRemoveItem(selectedItem.id)}
              className="p-1.5 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
              title="Remove item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-500">
            Properties for {selectedItem.type} items will be displayed here.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default PropertiesPanel;
