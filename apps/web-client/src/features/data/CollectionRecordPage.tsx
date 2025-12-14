import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  Clock,
  History,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../lib/api';

interface CollectionDefinition {
  id: string;
  code: string;
  label: string;
  labelPlural: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface PropertyDefinition {
  id: string;
  code: string;
  label: string;
  propertyType: string;
  isRequired: boolean;
  isReadOnly: boolean;
  hint?: string;
  defaultValue?: unknown;
  choiceList?: { value: string; label: string; color?: string }[];
  referenceConfig?: {
    targetCollection: string;
    displayProperty: string;
  };
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  fieldGroup?: string;
  sortOrder: number;
}

interface FormLayoutSection {
  id: string;
  label: string;
  columns: number;
  fields: string[];
  collapsed?: boolean;
}

export function CollectionRecordPage() {
  const { collectionCode, recordId } = useParams<{ collectionCode: string; recordId: string }>();
  const navigate = useNavigate();
  const isNew = recordId === 'new';

  const [collection, setCollection] = useState<CollectionDefinition | null>(null);
  const [properties, setProperties] = useState<PropertyDefinition[]>([]);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(isNew);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Load data
  useEffect(() => {
    if (collectionCode) {
      loadData();
    }
  }, [collectionCode, recordId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const schemaRes = await api.get<{ collection: CollectionDefinition; properties: PropertyDefinition[] }>(`/data/collections/${collectionCode}/schema`);
      setCollection(schemaRes.collection);
      setProperties(schemaRes.properties);

      if (!isNew && recordId) {
        const recordRes = await api.get<{ record: Record<string, unknown> }>(`/data/collections/${collectionCode}/data/${recordId}`);
        setRecord(recordRes.record);
      } else {
        // Initialize with defaults
        const defaults: Record<string, unknown> = {};
        schemaRes.properties.forEach((prop: PropertyDefinition) => {
          if (prop.defaultValue !== undefined) {
            defaults[prop.code] = prop.defaultValue;
          }
        });
        setRecord(defaults);
        setChanges(defaults);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load record';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (Object.keys(changes).length === 0 && !isNew) {
      setEditing(false);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isNew) {
        const res = await api.post<{ record: { id: string } }>(`/data/collections/${collectionCode}/data`, changes);
        navigate(`/data/${collectionCode}/${res.record.id}`, { replace: true });
      } else {
        await api.put(`/data/collections/${collectionCode}/data/${recordId}`, changes);
        setRecord({ ...record, ...changes });
        setChanges({});
        setEditing(false);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete this ${collection?.label?.toLowerCase()}?`)) return;

    try {
      await api.delete(`/data/collections/${collectionCode}/data/${recordId}`);
      navigate(`/data/${collectionCode}`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  }

  const handleFieldChange = useCallback((code: string, value: unknown) => {
    setChanges((prev) => ({ ...prev, [code]: value }));
  }, []);

  const currentValue = useCallback(
    (code: string) => {
      if (code in changes) return changes[code];
      return record?.[code];
    },
    [changes, record]
  );

  // Group properties by fieldGroup
  const sections = useMemo<FormLayoutSection[]>(() => {
    const groups = new Map<string, PropertyDefinition[]>();
    const noGroup: PropertyDefinition[] = [];

    properties.forEach((prop) => {
      if (prop.fieldGroup) {
        if (!groups.has(prop.fieldGroup)) {
          groups.set(prop.fieldGroup, []);
        }
        groups.get(prop.fieldGroup)!.push(prop);
      } else {
        noGroup.push(prop);
      }
    });

    const result: FormLayoutSection[] = [];

    // Main section with ungrouped fields
    if (noGroup.length > 0) {
      result.push({
        id: 'main',
        label: 'Details',
        columns: 2,
        fields: noGroup.map((p) => p.code),
      });
    }

    // Grouped sections
    groups.forEach((props, groupName) => {
      result.push({
        id: groupName,
        label: groupName,
        columns: 2,
        fields: props.map((p) => p.code),
      });
    });

    return result;
  }, [properties]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error && !record && !isNew) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/data/${collectionCode}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isNew ? `New ${collection?.label}` : getDisplayTitle()}
            </h1>
            {!isNew && record && 'id' in record && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ID: {String(record['id']).slice(0, 8)}...
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setChanges({});
                  setEditing(false);
                  if (isNew) navigate(`/data/${collectionCode}`);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {sections.map((section) => {
            const isCollapsed = collapsedSections.has(section.id);
            const sectionProps = section.fields
              .map((code) => properties.find((p) => p.code === code))
              .filter(Boolean) as PropertyDefinition[];

            return (
              <div
                key={section.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                    <h2 className="font-medium text-gray-900 dark:text-white">{section.label}</h2>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-4">
                    <div className={`grid grid-cols-${section.columns} gap-4`}>
                      {sectionProps.map((prop) => (
                        <FieldRenderer
                          key={prop.code}
                          property={prop}
                          value={currentValue(prop.code)}
                          editing={editing}
                          onChange={(value) => handleFieldChange(prop.code, value)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Audit Info */}
          {!isNew && record && (
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 px-2">
              {record['created_at'] ? (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Created {new Date(String(record['created_at'])).toLocaleString()}</span>
                </div>
              ) : null}
              {record['updated_at'] ? (
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  <span>Updated {new Date(String(record['updated_at'])).toLocaleString()}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function getDisplayTitle(): string {
    if (!record) return collection?.label || 'Record';

    // Try common display fields
    const displayFields = ['name', 'title', 'label', 'number', 'subject'];
    for (const field of displayFields) {
      if (record[field]) return String(record[field]);
    }

    // Try first text property
    const textProp = properties.find((p) => p.propertyType === 'text' || p.propertyType === 'string');
    if (textProp && record[textProp.code]) {
      return String(record[textProp.code]);
    }

    return `${collection?.label} ${String(record.id).slice(0, 8)}`;
  }
}

interface FieldRendererProps {
  property: PropertyDefinition;
  value: unknown;
  editing: boolean;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ property, value, editing, onChange }: FieldRendererProps) {
  const isReadOnly = !editing || property.isReadOnly;

  const inputClasses =
    'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-900';

  const renderField = () => {
    switch (property.propertyType) {
      case 'boolean':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={isReadOnly}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {value ? 'Yes' : 'No'}
            </span>
          </label>
        );

      case 'choice':
        if (isReadOnly) {
          const choice = property.choiceList?.find((c) => c.value === value);
          return (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              {choice ? (
                <span
                  className="px-2 py-0.5 text-sm rounded"
                  style={{
                    backgroundColor: choice.color ? `${choice.color}20` : undefined,
                    color: choice.color,
                  }}
                >
                  {choice.label}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
          );
        }
        return (
          <select
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            className={inputClasses}
          >
            <option value="">Select...</option>
            {property.choiceList?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              {value ? new Date(String(value)).toLocaleDateString() : <span className="text-gray-400">—</span>}
            </div>
          );
        }
        return (
          <input
            type="date"
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            className={inputClasses}
          />
        );

      case 'datetime':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              {value ? new Date(String(value)).toLocaleString() : <span className="text-gray-400">—</span>}
            </div>
          );
        }
        return (
          <input
            type="datetime-local"
            value={value ? String(value).slice(0, 16) : ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            className={inputClasses}
          />
        );

      case 'number':
      case 'integer':
      case 'decimal':
      case 'currency':
      case 'percent':
        if (isReadOnly) {
          let formatted = value;
          if (property.propertyType === 'currency' && value != null) {
            formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
          } else if (property.propertyType === 'percent' && value != null) {
            formatted = `${Number(value).toFixed(1)}%`;
          }
          return (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              {formatted != null ? String(formatted) : <span className="text-gray-400">—</span>}
            </div>
          );
        }
        return (
          <input
            type="number"
            value={value != null ? Number(value) : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            disabled={isReadOnly}
            step={property.propertyType === 'integer' ? '1' : 'any'}
            className={inputClasses}
          />
        );

      case 'text':
      case 'richtext':
      case 'html':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg min-h-[80px] whitespace-pre-wrap">
              {value ? String(value) : <span className="text-gray-400">—</span>}
            </div>
          );
        }
        return (
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            rows={4}
            className={inputClasses}
          />
        );

      case 'email':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              {value ? (
                <a href={`mailto:${value}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  {String(value)}
                </a>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
          );
        }
        return (
          <input
            type="email"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            className={inputClasses}
          />
        );

      case 'url':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              {value ? (
                <a
                  href={String(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  {String(value)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
          );
        }
        return (
          <input
            type="url"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            className={inputClasses}
          />
        );

      default:
        // String and other types
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              {value != null ? String(value) : <span className="text-gray-400">—</span>}
            </div>
          );
        }
        return (
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            maxLength={property.validationRules?.maxLength}
            className={inputClasses}
          />
        );
    }
  };

  return (
    <div className={property.propertyType === 'text' || property.propertyType === 'richtext' ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {property.label}
        {property.isRequired && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderField()}
      {property.hint && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{property.hint}</p>
      )}
    </div>
  );
}
