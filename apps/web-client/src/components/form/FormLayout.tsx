import React, { useMemo, useState } from 'react';
import { ModelField, ModelLayout } from '../../services/platform.service';
import { resolveFieldRenderer } from './FieldRegistry';
import {
  FileText,
  Settings,
  History,
  Users,
  Package,
  Folder,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface FormLayoutProps {
  fields: ModelField[];
  layout: ModelLayout | null;
  values: Record<string, any>;
  errors: Record<string, string>;
  onChange: (field: ModelField, value: any) => void;
}

type TabConfig = {
  id: string;
  label: string;
  icon?: string;
  sections: SectionConfig[];
};

type SectionConfig = {
  id: string;
  label?: string;
  fields: string[];
  columns?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

// Tab icon mapping
const getTabIcon = (iconName?: string) => {
  switch (iconName?.toLowerCase()) {
    case 'details':
    case 'general':
    case 'info':
      return FileText;
    case 'settings':
    case 'config':
      return Settings;
    case 'history':
    case 'audit':
      return History;
    case 'users':
    case 'people':
    case 'team':
      return Users;
    case 'assets':
    case 'items':
      return Package;
    case 'files':
    case 'documents':
      return Folder;
    default:
      return Layers;
  }
};

const columnsClass = (cols: number) => {
  const size = Math.min(4, Math.max(1, cols || 1));
  if (size === 1) return 'grid-cols-1';
  if (size === 2) return 'grid-cols-1 md:grid-cols-2';
  if (size === 3) return 'grid-cols-1 md:grid-cols-3';
  return 'grid-cols-1 md:grid-cols-4';
};

// Collapsible section component
const CollapsibleSection: React.FC<{
  section: SectionConfig;
  fields: ModelField[];
  values: Record<string, any>;
  errors: Record<string, string>;
  onChange: (field: ModelField, value: any) => void;
}> = ({ section, fields, values, errors, onChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(section.defaultCollapsed ?? false);

  const sectionFields = section.fields
    .map((code) => fields.find((f) => f.code === code))
    .filter(Boolean) as ModelField[];

  if (sectionFields.length === 0) return null;

  // Count errors in this section
  const errorCount = sectionFields.filter((f) => errors[f.code]).length;

  return (
    <div
      className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
      }}
    >
      {section.label && (
        <button
          type="button"
          onClick={() => section.collapsible && setIsCollapsed(!isCollapsed)}
          className={`w-full px-4 py-3 flex items-center justify-between group ${
            section.collapsible ? 'cursor-pointer' : 'cursor-default'
          }`}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--bg-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{section.label}</h3>
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              {sectionFields.length} field{sectionFields.length !== 1 ? 's' : ''}
            </span>
            {errorCount > 0 && (
              <span className="badge badge-danger">
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {section.collapsible && (
            <div style={{ color: 'var(--text-muted)' }}>
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          )}
        </button>
      )}
      {!isCollapsed && (
        <div className="p-5">
          <div className={`grid gap-x-6 gap-y-5 ${columnsClass(section.columns || 2)}`}>
            {sectionFields.map((field) => {
              const Renderer = resolveFieldRenderer(field.type);
              return (
                <div key={field.code} className="form-field-wrapper">
                  <Renderer
                    field={field}
                    value={values[field.code]}
                    onChange={(val) => onChange(field, val)}
                    error={errors[field.code]}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const FormLayout: React.FC<FormLayoutProps> = ({
  fields,
  layout,
  values,
  errors,
  onChange,
}) => {
  const [activeTabId, setActiveTabId] = useState<string>('');

  // Parse layout into tabs
  const tabs = useMemo<TabConfig[]>(() => {
    if (layout?.layout?.tabs?.length) {
      return layout.layout.tabs.map((tab: any, tabIdx: number) => ({
        id: tab.id || `tab-${tabIdx}`,
        label: tab.label || `Tab ${tabIdx + 1}`,
        icon: tab.icon,
        sections: (tab.sections || []).map((section: any, secIdx: number) => ({
          id: section.id || `section-${tabIdx}-${secIdx}`,
          label: section.label,
          fields: section.fields || [],
          columns: section.columns || 2,
          collapsible: section.collapsible ?? false,
          defaultCollapsed: section.defaultCollapsed ?? false,
        })),
      }));
    }
    // Default: single tab with all fields
    return [
      {
        id: 'default',
        label: 'Details',
        icon: 'details',
        sections: [
          {
            id: 'default-section',
            label: undefined,
            fields: fields.map((f) => f.code),
            columns: 2,
            collapsible: false,
            defaultCollapsed: false,
          },
        ],
      },
    ];
  }, [fields, layout]);

  // Set initial active tab
  useMemo(() => {
    if (tabs.length > 0 && !activeTabId) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  if (!fields.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            <FileText className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No fields configured for this form.</p>
        </div>
      </div>
    );
  }

  // Count total errors per tab
  const getTabErrorCount = (tab: TabConfig) => {
    const tabFieldCodes = new Set(tab.sections.flatMap((s) => s.fields));
    return fields.filter((f) => tabFieldCodes.has(f.code) && errors[f.code]).length;
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Tab Bar - Only show if multiple tabs */}
      {tabs.length > 1 && (
        <div
          className="px-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <div className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const TabIcon = getTabIcon(tab.icon);
              const isActive = tab.id === activeTabId;
              const errorCount = getTabErrorCount(tab);

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className="tab group flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap"
                  style={{
                    borderBottom: isActive ? '2px solid var(--bg-primary)' : '2px solid transparent',
                    color: isActive ? 'var(--text-brand)' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'var(--bg-primary-subtle)' : 'transparent',
                  }}
                >
                  <TabIcon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {errorCount > 0 && (
                    <span className="badge badge-danger">
                      {errorCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="space-y-5 max-w-5xl mx-auto">
          {activeTab?.sections.map((section) => (
            <CollapsibleSection
              key={section.id}
              section={section}
              fields={fields}
              values={values}
              errors={errors}
              onChange={onChange}
            />
          ))}
        </div>
      </div>

      {/* Form helper styles */}
      <style>{`
        .form-field-wrapper {
          transition: all 0.15s ease;
        }
        .form-field-wrapper:focus-within {
          transform: translateY(-1px);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};
