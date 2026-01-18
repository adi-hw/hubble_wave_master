import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  Clock,
  History,
  ExternalLink,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { PermissionGate } from '../../auth/PermissionGate';
import { viewApi, ResolvedView } from '../../services/viewApi';
import {
  buildDefaultDesignerLayout,
  SimpleFormLayout,
  toSimpleFormLayout,
} from '../../components/form/designer/layout-utils';
import type { DesignerLayout } from '../../components/form/designer/types';
import type { ModelProperty } from '../../services/platform.service';

interface CollectionDefinition {
  id: string;
  code: string;
  name: string;
  namePlural?: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface PropertyDefinition {
  id: string;
  code: string;
  name: string;
  dataType?: string;
  propertyType?: { code: string; name: string };
  isRequired: boolean;
  isUnique?: boolean;
  isReadonly?: boolean;
  description?: string;
  defaultValue?: unknown;
  config?: {
    dataType?: string;
    choices?: { value: string; label: string; color?: string }[];
    [key: string]: unknown;
  };
  referenceCollectionId?: string;
  referenceCollectionCode?: string;
  referenceDisplayProperty?: string;
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  fieldGroup?: string;
  position?: number;
}

interface FormLayoutSection {
  id: string;
  label?: string;
  columns: number;
  fields: string[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

interface FormPolicyCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than';
  value?: string;
}

interface FormPolicyAction {
  type: 'show' | 'hide' | 'require' | 'read_only';
  targets: string[];
}

interface FormPolicy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: FormPolicyCondition[];
  actions: FormPolicyAction[];
}

interface FieldPolicyState {
  hidden?: boolean;
  required?: boolean;
  readOnly?: boolean;
}

const resolveLayoutFromResolvedView = (view?: ResolvedView | null) => {
  if (!view || !view.layout || typeof view.layout !== 'object') {
    return null;
  }

  const layoutPayload = view.layout as Record<string, unknown>;
  const savedDesigner = (layoutPayload.designer as DesignerLayout | undefined)
    || (layoutPayload.formLayout as DesignerLayout | undefined);
  if (savedDesigner?.version === 2) {
    return { layout: toSimpleFormLayout(savedDesigner), designer: savedDesigner };
  }

  const savedLayout =
    (layoutPayload.layout as SimpleFormLayout | undefined)
    || (layoutPayload.formLayout as SimpleFormLayout | undefined)
    || (layoutPayload as unknown as SimpleFormLayout);
  if (savedLayout?.tabs?.length) {
    return { layout: savedLayout, designer: null };
  }

  return null;
};

export function CollectionRecordPage() {
  const { collectionCode, recordId } = useParams<{ collectionCode: string; recordId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = recordId === 'new';
  const isEditMode = new URLSearchParams(location.search).get('edit') === 'true';

  const [collection, setCollection] = useState<CollectionDefinition | null>(null);
  const [properties, setProperties] = useState<PropertyDefinition[]>([]);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(isNew || isEditMode);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [formLayout, setFormLayout] = useState<SimpleFormLayout | null>(null);
  const [resolvedView, setResolvedView] = useState<ResolvedView | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>('');

  // Load data
  useEffect(() => {
    if (collectionCode) {
      loadData();
    }
  }, [collectionCode, recordId]);

  useEffect(() => {
    if (!isNew && isEditMode) {
      setEditing(true);
    }
  }, [isEditMode, isNew]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Uses /data/collections to route to svc-data via Vite proxy
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

  const loadFormLayout = useCallback(async (code: string) => {
    if (!code) {
      setFormLayout(null);
      setResolvedView(null);
      return;
    }

    try {
      const resolved = await viewApi.resolve({ kind: 'form', collection: code, route: location.pathname });
      setResolvedView(resolved);
      const resolvedLayout = resolveLayoutFromResolvedView(resolved);
      if (resolvedLayout?.layout) {
        setFormLayout(resolvedLayout.layout);
        return;
      }
      setFormLayout(null);
    } catch (err) {
      console.warn('Failed to resolve form layout:', err);
      setFormLayout(null);
      setResolvedView(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!collection?.code) return;
    loadFormLayout(collection.code);
  }, [collection?.code, loadFormLayout]);

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
        navigate(`/${collectionCode}/${res.record.id}`, { replace: true });
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
    if (!confirm(`Delete this ${collection?.name?.toLowerCase()}?`)) return;

    try {
      await api.delete(`/data/collections/${collectionCode}/data/${recordId}`);
      navigate(`/${collectionCode}.list`);
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

  const activePolicies = useMemo<FormPolicy[]>(() => {
    const layout = resolvedView?.layout as Record<string, unknown> | undefined;
    const stored = layout?.policies ?? layout?.formPolicies;
    return Array.isArray(stored) ? (stored as FormPolicy[]) : [];
  }, [resolvedView]);

  const fieldPolicyState = useMemo<Record<string, FieldPolicyState>>(() => {
    const state: Record<string, FieldPolicyState> = {};
    const permissionMap = resolvedView?.fieldPermissions || {};

    Object.entries(permissionMap).forEach(([code, permission]) => {
      if (!permission) return;
      state[code] = {
        hidden: permission.canRead === false,
        readOnly: permission.canWrite === false,
      };
    });

    const isEmptyValue = (value: unknown) => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'string') return value.trim().length === 0;
      return false;
    };

    const toNumber = (value: unknown) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
      }
      return null;
    };

    const matchesCondition = (condition: FormPolicyCondition) => {
      const fieldValue = currentValue(condition.field);
      switch (condition.operator) {
        case 'equals':
          return String(fieldValue ?? '') === String(condition.value ?? '');
        case 'not_equals':
          return String(fieldValue ?? '') !== String(condition.value ?? '');
        case 'is_empty':
          return isEmptyValue(fieldValue);
        case 'is_not_empty':
          return !isEmptyValue(fieldValue);
        case 'greater_than': {
          const left = toNumber(fieldValue);
          const right = toNumber(condition.value);
          return left !== null && right !== null && left > right;
        }
        case 'less_than': {
          const left = toNumber(fieldValue);
          const right = toNumber(condition.value);
          return left !== null && right !== null && left < right;
        }
        default:
          return false;
      }
    };

    activePolicies
      .filter((policy) => policy.enabled)
      .forEach((policy) => {
        if (policy.conditions.length === 0) return;
        const matches = policy.conditions.every(matchesCondition);
        if (!matches) return;

        policy.actions.forEach((action) => {
          action.targets.forEach((target) => {
            if (!target) return;
            const current = state[target] || {};
            const denyRead = current.hidden === true;
            const denyWrite = current.readOnly === true;
            if (action.type === 'hide') {
              state[target] = { ...current, hidden: true };
            } else if (action.type === 'show') {
              if (!denyRead) {
                state[target] = { ...current, hidden: false };
              }
            } else if (action.type === 'require') {
              state[target] = { ...current, required: true };
            } else if (action.type === 'read_only') {
              state[target] = { ...current, readOnly: true };
            }
            if (denyWrite) {
              state[target] = { ...state[target], readOnly: true };
            }
          });
        });
      });

    return state;
  }, [activePolicies, currentValue, resolvedView?.fieldPermissions]);

  const designerFields = useMemo<ModelProperty[]>(() => {
    return properties.map((prop) => ({
      code: prop.code,
      label: prop.name || prop.code,
      type: prop.dataType || (prop.config?.dataType as string) || 'string',
      backendType: prop.dataType || (prop.config?.dataType as string) || 'string',
      uiWidget: (prop.config?.widget as string) || '',
      storagePath: `column:${collection?.code || collectionCode}.${prop.code}`,
      nullable: !prop.isRequired,
      isUnique: Boolean(prop.isUnique),
      defaultValue: prop.defaultValue as string | undefined,
      config: prop.config || {},
      validators: prop.validationRules || {},
    }));
  }, [collection?.code, collectionCode, properties]);

  const generatedLayout = useMemo(() => {
    if (designerFields.length === 0) {
      return null;
    }
    return toSimpleFormLayout(buildDefaultDesignerLayout(designerFields));
  }, [designerFields]);

  // Group properties by fieldGroup
  const layoutTabs = useMemo(
    () => (formLayout ?? generatedLayout)?.tabs ?? [],
    [formLayout, generatedLayout]
  );

  useEffect(() => {
    if (layoutTabs.length === 0) {
      setActiveTabId('');
      return;
    }

    setActiveTabId((prev) =>
      layoutTabs.some((tab) => tab.id === prev) ? prev : layoutTabs[0].id
    );
  }, [layoutTabs]);

  const sections = useMemo<FormLayoutSection[]>(() => {
    if (layoutTabs.length > 0) {
      const activeTab = layoutTabs.find((tab) => tab.id === activeTabId) ?? layoutTabs[0];
      return (activeTab?.sections || []).map((section, index) => ({
        id: section.id || `section-${index}`,
        label: section.label || (activeTab.sections.length === 1 ? 'Details' : `Section ${index + 1}`),
        columns: Math.min(4, Math.max(1, section.columns || 2)),
        fields: Array.isArray(section.fields) ? section.fields : [],
        collapsible: section.collapsible ?? true,
        defaultCollapsed: section.defaultCollapsed ?? false,
      }));
    }

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
  }, [layoutTabs, activeTabId, properties]);

  useEffect(() => {
    if (sections.length === 0) return;
    setCollapsedSections((prev) => {
      if (prev.size > 0) return prev;
      const initial = new Set(
        sections.filter((section) => section.defaultCollapsed).map((section) => section.id)
      );
      return initial;
    });
  }, [sections]);

  const toggleSection = (sectionId: string, collapsible = true) => {
    if (!collapsible) return;
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

  const canConfigureForm = Boolean(collection?.id && !collection.id.startsWith('virtual:'));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !record && !isNew) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/${collectionCode}.list`)}
            className="p-2 rounded-lg transition-colors hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {isNew ? `New ${collection?.name}` : getDisplayTitle()}
            </h1>
            {!isNew && record && 'id' in record && (
              <p className="text-sm text-muted-foreground">
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
                  if (isNew) navigate(`/${collectionCode}.list`);
                }}
                className="px-4 py-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors bg-primary text-primary-foreground"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <PermissionGate roles="admin">
                {collection && canConfigureForm && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/studio/collections/${collection.id}/form-layout?return=${encodeURIComponent(
                          `${location.pathname}${location.search}`
                        )}`
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border border-border bg-card text-foreground hover:bg-muted"
                  >
                    <Settings className="w-4 h-4" />
                    Configure Form
                  </button>
                )}
              </PermissionGate>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-primary text-primary-foreground"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg transition-colors text-destructive hover:bg-destructive/10"
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
        <div className="mx-6 mt-4 p-4 rounded-lg bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {layoutTabs.length > 1 && (
            <div className="flex items-center gap-1 border-b border-border pb-1">
              {layoutTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab.id === activeTabId
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {sections.map((section) => {
            const isCollapsible = section.collapsible ?? true;
            const isCollapsed = isCollapsible && collapsedSections.has(section.id);
            const sectionProps = section.fields
              .map((code) => properties.find((p) => p.code === code))
              .filter(Boolean) as PropertyDefinition[];
            const visibleProps = sectionProps.filter(
              (prop) => !fieldPolicyState[prop.code]?.hidden
            );

            if (visibleProps.length === 0) {
              return null;
            }

            return (
              <div
                key={section.id}
                className="border rounded-xl overflow-hidden bg-card border-border"
              >
                <div
                  className={`flex items-center justify-between px-4 py-3 bg-muted ${
                    isCollapsible ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  onClick={() => toggleSection(section.id, isCollapsible)}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsible && (
                      isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )
                    )}
                    <h2 className="font-medium text-foreground">
                      {section.label || 'Details'}
                    </h2>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-4">
                    <div className={`grid gap-4 ${getColumnsClass(section.columns)}`}>
                      {visibleProps.map((prop) => {
                        const policyState = fieldPolicyState[prop.code];
                        const effectiveProperty: PropertyDefinition = {
                          ...prop,
                          isRequired: policyState?.required ? true : prop.isRequired,
                          isReadonly: prop.isReadonly || policyState?.readOnly,
                        };

                        return (
                          <FieldRenderer
                            key={prop.code}
                            property={effectiveProperty}
                            value={currentValue(prop.code)}
                            editing={editing}
                            onChange={(value) => handleFieldChange(prop.code, value)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Audit Info */}
          {!isNew && record && (
            <div className="flex items-center gap-6 text-sm px-2 text-muted-foreground">
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
    </>
  );

  function getColumnsClass(columns: number) {
    const size = Math.min(4, Math.max(1, columns || 1));
    if (size === 1) return 'grid-cols-1';
    if (size === 2) return 'grid-cols-1 md:grid-cols-2';
    if (size === 3) return 'grid-cols-1 md:grid-cols-3';
    return 'grid-cols-1 md:grid-cols-4';
  }

  function getDisplayTitle(): string {
    if (!record) return collection?.name || 'Record';

    // Try common display fields
    const displayFields = ['name', 'title', 'label', 'number', 'subject'];
    for (const field of displayFields) {
      if (record[field]) return String(record[field]);
    }

    // Try first text property
    const textProp = properties.find((p) => getPropertyType(p) === 'text' || getPropertyType(p) === 'string');
    if (textProp && record[textProp.code]) {
      return String(record[textProp.code]);
    }

    return `${collection?.name} ${String(record.id).slice(0, 8)}`;
  }

  // Helper to get the property type string from various sources
  function getPropertyType(prop: PropertyDefinition): string {
    return prop.dataType || prop.propertyType?.code || prop.config?.dataType as string || 'string';
  }
}

interface FieldRendererProps {
  property: PropertyDefinition;
  value: unknown;
  editing: boolean;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ property, value, editing, onChange }: FieldRendererProps) {
  const isReadOnly = !editing || property.isReadonly;

  const inputClassName = "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 bg-card border-border text-foreground";

  // Get the property type from various possible sources
  const propType = property.dataType || property.propertyType?.code || property.config?.dataType as string || 'string';

  // Get choice list from config
  const choiceList = property.config?.choices;

  const renderField = () => {
    switch (propType) {
      case 'boolean':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={isReadOnly}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm text-muted-foreground">
              {value ? 'Yes' : 'No'}
            </span>
          </label>
        );

      case 'choice':
        if (isReadOnly) {
          const choice = choiceList?.find((c) => c.value === value);
          return (
            <div className="px-3 py-2 rounded-lg bg-muted">
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
                <span className="text-muted-foreground">N/A</span>
              )}
            </div>
          );
        }
        return (
          <select
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            className={inputClassName}
          >
            <option value="">Select...</option>
            {choiceList?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 rounded-lg bg-muted">
              {value ? new Date(String(value)).toLocaleDateString() : <span className="text-muted-foreground">N/A</span>}
            </div>
          );
        }
        return (
          <input
            type="date"
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            className={inputClassName}
          />
        );

      case 'datetime':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 rounded-lg bg-muted">
              {value ? new Date(String(value)).toLocaleString() : <span className="text-muted-foreground">N/A</span>}
            </div>
          );
        }
        return (
          <input
            type="datetime-local"
            value={value ? String(value).slice(0, 16) : ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            className={inputClassName}
          />
        );

      case 'number':
      case 'integer':
      case 'decimal':
      case 'currency':
      case 'percent':
        if (isReadOnly) {
          let formatted = value;
          if (propType === 'currency' && value != null) {
            formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
          } else if (propType === 'percent' && value != null) {
            formatted = `${Number(value).toFixed(1)}%`;
          }
          return (
            <div className="px-3 py-2 rounded-lg bg-muted">
              {formatted != null ? String(formatted) : <span className="text-muted-foreground">N/A</span>}
            </div>
          );
        }
        return (
          <input
            type="number"
            value={value != null ? Number(value) : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            disabled={isReadOnly}
            step={propType === 'integer' ? '1' : 'any'}
            className={inputClassName}
          />
        );

      case 'text':
      case 'richtext':
      case 'html':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 rounded-lg min-h-[80px] whitespace-pre-wrap bg-muted">
              {value ? String(value) : <span className="text-muted-foreground">N/A</span>}
            </div>
          );
        }
        return (
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isReadOnly}
            rows={4}
            className={inputClassName}
          />
        );

      case 'email':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 rounded-lg bg-muted">
              {value ? (
                <a href={`mailto:${value}`} className="hover:underline text-primary">
                  {String(value)}
                </a>
              ) : (
                <span className="text-muted-foreground">N/A</span>
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
            className={inputClassName}
          />
        );

      case 'url':
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 rounded-lg bg-muted">
              {value ? (
                <a
                  href={String(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-primary"
                >
                  {String(value)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">N/A</span>
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
            className={inputClassName}
          />
        );

      default:
        // String and other types
        if (isReadOnly) {
          return (
            <div className="px-3 py-2 rounded-lg bg-muted">
              {value != null ? String(value) : <span className="text-muted-foreground">N/A</span>}
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
            className={inputClassName}
          />
        );
    }
  };

  return (
    <div className={propType === 'text' || propType === 'richtext' ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium mb-1 text-muted-foreground">
        {property.name}
        {property.isRequired && <span className="ml-1 text-destructive">*</span>}
      </label>
      {renderField()}
      {property.description && (
        <p className="mt-1 text-xs text-muted-foreground">{property.description}</p>
      )}
    </div>
  );
}
