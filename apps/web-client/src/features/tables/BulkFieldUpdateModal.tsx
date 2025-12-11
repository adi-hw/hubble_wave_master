import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  AlertTriangle,
  Search,
  Filter,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  Link2,
  List,
  FileText,
  Settings,
  Eye,
  Lock,
  AlertCircle,
  Fingerprint,
  Layers,
} from 'lucide-react';
import { createApiClient } from '../../services/api';
import type { AuthorizedFieldMeta } from './types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const metadataApi = createApiClient(METADATA_API_URL);

interface BulkFieldUpdateModalProps {
  open: boolean;
  tableCode: string;
  fields: AuthorizedFieldMeta[];
  onClose: () => void;
  onUpdated?: () => void;
}

// Define which properties can be bulk updated
interface BulkUpdateProperty {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  type: 'boolean' | 'string' | 'select';
  options?: { value: string; label: string }[];
  applicableTypes?: string[]; // If undefined, applies to all types
  incompatibleTypes?: string[]; // Types where this property doesn't make sense
}

const bulkUpdateProperties: BulkUpdateProperty[] = [
  // Display properties
  {
    key: 'showInLists',
    label: 'Show in Lists',
    description: 'Display this field in list/table views',
    icon: <Eye className="h-4 w-4" />,
    type: 'boolean',
  },
  {
    key: 'showInForms',
    label: 'Show in Forms',
    description: 'Display this field in create/edit forms',
    icon: <FileText className="h-4 w-4" />,
    type: 'boolean',
  },
  {
    key: 'isInternal',
    label: 'Internal Field',
    description: 'Hide from tenant users, admin only',
    icon: <Lock className="h-4 w-4" />,
    type: 'boolean',
  },
  // Validation properties
  {
    key: 'required',
    label: 'Required',
    description: 'Field must have a value',
    icon: <AlertCircle className="h-4 w-4" />,
    type: 'boolean',
  },
  {
    key: 'isUnique',
    label: 'Unique',
    description: 'Values must be unique across all records',
    icon: <Fingerprint className="h-4 w-4" />,
    type: 'boolean',
    incompatibleTypes: ['boolean', 'json', 'rich_text', 'multi_choice', 'multi_reference', 'tags'],
  },
  // Text-specific properties
  {
    key: 'config.maxLength',
    label: 'Max Length',
    description: 'Maximum character length',
    icon: <Type className="h-4 w-4" />,
    type: 'string',
    applicableTypes: ['string', 'text', 'email', 'phone', 'url'],
  },
  {
    key: 'config.minLength',
    label: 'Min Length',
    description: 'Minimum character length',
    icon: <Type className="h-4 w-4" />,
    type: 'string',
    applicableTypes: ['string', 'text', 'email', 'phone', 'url'],
  },
  // Numeric-specific properties
  {
    key: 'config.minValue',
    label: 'Min Value',
    description: 'Minimum numeric value',
    icon: <Hash className="h-4 w-4" />,
    type: 'string',
    applicableTypes: ['integer', 'long', 'decimal', 'number', 'currency', 'percent'],
  },
  {
    key: 'config.maxValue',
    label: 'Max Value',
    description: 'Maximum numeric value',
    icon: <Hash className="h-4 w-4" />,
    type: 'string',
    applicableTypes: ['integer', 'long', 'decimal', 'number', 'currency', 'percent'],
  },
  // Default value
  {
    key: 'defaultValue',
    label: 'Default Value',
    description: 'Value used when no value is provided',
    icon: <Settings className="h-4 w-4" />,
    type: 'string',
    incompatibleTypes: ['reference', 'multi_reference', 'json', 'file', 'image', 'audio', 'video'],
  },
  // UI properties
  {
    key: 'config.placeholder',
    label: 'Placeholder',
    description: 'Placeholder text in input fields',
    icon: <Type className="h-4 w-4" />,
    type: 'string',
    incompatibleTypes: ['boolean', 'reference', 'multi_reference', 'file', 'image', 'audio', 'video'],
  },
  {
    key: 'config.helpText',
    label: 'Help Text',
    description: 'Help text shown below the field',
    icon: <AlertCircle className="h-4 w-4" />,
    type: 'string',
  },
];

// Field type icons and colors (matching FieldsTab)
const fieldTypeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  string: { icon: <Type className="h-3.5 w-3.5" />, color: 'var(--hw-primary)' },
  text: { icon: <FileText className="h-3.5 w-3.5" />, color: 'var(--hw-primary)' },
  rich_text: { icon: <FileText className="h-3.5 w-3.5" />, color: 'var(--hw-primary)' },
  integer: { icon: <Hash className="h-3.5 w-3.5" />, color: '#8b5cf6' },
  long: { icon: <Hash className="h-3.5 w-3.5" />, color: '#8b5cf6' },
  decimal: { icon: <Hash className="h-3.5 w-3.5" />, color: '#8b5cf6' },
  number: { icon: <Hash className="h-3.5 w-3.5" />, color: '#8b5cf6' },
  currency: { icon: <Hash className="h-3.5 w-3.5" />, color: '#8b5cf6' },
  percent: { icon: <Hash className="h-3.5 w-3.5" />, color: '#8b5cf6' },
  boolean: { icon: <ToggleLeft className="h-3.5 w-3.5" />, color: '#f59e0b' },
  date: { icon: <Calendar className="h-3.5 w-3.5" />, color: '#10b981' },
  datetime: { icon: <Calendar className="h-3.5 w-3.5" />, color: '#10b981' },
  time: { icon: <Calendar className="h-3.5 w-3.5" />, color: '#10b981' },
  choice: { icon: <List className="h-3.5 w-3.5" />, color: '#06b6d4' },
  multi_choice: { icon: <List className="h-3.5 w-3.5" />, color: '#06b6d4' },
  reference: { icon: <Link2 className="h-3.5 w-3.5" />, color: '#ec4899' },
  multi_reference: { icon: <Link2 className="h-3.5 w-3.5" />, color: '#ec4899' },
};

const getFieldTypeConfig = (type: string) => {
  return fieldTypeConfig[type.toLowerCase()] || { icon: <Type className="h-3.5 w-3.5" />, color: 'var(--hw-text-muted)' };
};

// Group fields by type for easier selection
const groupFieldsByType = (fields: AuthorizedFieldMeta[]) => {
  const groups: Record<string, AuthorizedFieldMeta[]> = {};
  fields.forEach((field) => {
    const type = field.type.toLowerCase();
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(field);
  });
  return groups;
};

export const BulkFieldUpdateModal: React.FC<BulkFieldUpdateModalProps> = ({
  open,
  tableCode,
  fields,
  onClose,
  onUpdated,
}) => {
  // Step state: 1 = select fields, 2 = select property, 3 = set value, 4 = confirm
  const [step, setStep] = useState(1);

  // Field selection state
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showTypeGroups] = useState(true);

  // Property selection state
  const [selectedProperty, setSelectedProperty] = useState<BulkUpdateProperty | null>(null);

  // Value state
  const [newValue, setNewValue] = useState<string | boolean>('');

  // Update state
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateResults, setUpdateResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedFields(new Set());
      setSearchQuery('');
      setFilterType('all');
      setSelectedProperty(null);
      setNewValue('');
      setError(null);
      setUpdateResults(null);
      setIsUpdating(false);
    }
  }, [open]);

  // Filter out system fields that shouldn't be bulk updated
  const editableFields = useMemo(() => {
    return fields.filter((f) => !f.isSystem && f.canWrite);
  }, [fields]);

  // Get unique field types for filter
  const fieldTypes = useMemo(() => {
    const types = new Set(editableFields.map((f) => f.type.toLowerCase()));
    return Array.from(types).sort();
  }, [editableFields]);

  // Group fields by type
  const groupedFields = useMemo(() => groupFieldsByType(editableFields), [editableFields]);

  // Filter fields based on search and type filter
  const filteredFields = useMemo(() => {
    let result = editableFields;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.label.toLowerCase().includes(q) ||
          f.code.toLowerCase().includes(q)
      );
    }

    if (filterType !== 'all') {
      result = result.filter((f) => f.type.toLowerCase() === filterType);
    }

    return result;
  }, [editableFields, searchQuery, filterType]);

  // Get applicable properties based on selected fields
  const applicableProperties = useMemo(() => {
    if (selectedFields.size === 0) return bulkUpdateProperties;

    const selectedFieldTypes = new Set(
      Array.from(selectedFields)
        .map((code) => fields.find((f) => f.code === code)?.type.toLowerCase())
        .filter(Boolean)
    );

    return bulkUpdateProperties.filter((prop) => {
      // Check if property is applicable to all selected types
      if (prop.applicableTypes) {
        return Array.from(selectedFieldTypes).every((type) =>
          prop.applicableTypes!.includes(type!)
        );
      }

      // Check if property is incompatible with any selected types
      if (prop.incompatibleTypes) {
        return !Array.from(selectedFieldTypes).some((type) =>
          prop.incompatibleTypes!.includes(type!)
        );
      }

      return true;
    });
  }, [selectedFields, fields]);

  // Toggle field selection
  const toggleField = (code: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedFields(newSelected);
  };

  // Select all visible fields
  const selectAllVisible = () => {
    const newSelected = new Set(selectedFields);
    filteredFields.forEach((f) => newSelected.add(f.code));
    setSelectedFields(newSelected);
  };

  // Select all of a specific type
  const selectAllOfType = (type: string) => {
    const newSelected = new Set(selectedFields);
    groupedFields[type]?.forEach((f) => newSelected.add(f.code));
    setSelectedFields(newSelected);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedFields(new Set());
  };

  // Handle bulk update
  const handleBulkUpdate = async () => {
    if (!selectedProperty || selectedFields.size === 0) return;

    setIsUpdating(true);
    setError(null);
    setUpdateResults(null);

    try {
      // Build the update payload
      const fieldCodes = Array.from(selectedFields);

      // Determine the value to send based on property type
      let valueToSend: any = newValue;
      if (selectedProperty.type === 'boolean') {
        valueToSend = newValue === true || newValue === 'true';
      } else if (selectedProperty.key.includes('config.')) {
        // For numeric config values, parse them
        if (['config.minLength', 'config.maxLength', 'config.minValue', 'config.maxValue'].includes(selectedProperty.key)) {
          valueToSend = newValue === '' ? null : parseFloat(String(newValue));
        }
      }

      // Call the bulk update API
      const response = await metadataApi.patch(`/studio/tables/${tableCode}/fields/bulk`, {
        fieldCodes,
        property: selectedProperty.key,
        value: valueToSend,
      });

      const results = response.data;
      setUpdateResults({
        success: results.updated || fieldCodes.length,
        failed: results.failed || 0,
        errors: results.errors || [],
      });

      // Move to confirmation step
      setStep(4);

      // Trigger refresh
      onUpdated?.();
    } catch (err: unknown) {
      const message = (err as any)?.response?.data?.message || 'Failed to update fields. Please try again.';
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Validate value based on property and selected field types
  const validateValue = (): string | null => {
    if (!selectedProperty) return 'Please select a property to update';

    if (selectedProperty.type === 'string' && selectedProperty.key === 'defaultValue') {
      // Validate default value based on field types
      const selectedFieldTypes = Array.from(selectedFields)
        .map((code) => fields.find((f) => f.code === code)?.type.toLowerCase())
        .filter(Boolean);

      // Check if trying to set a non-boolean default for boolean fields
      if (selectedFieldTypes.includes('boolean') && newValue !== '' && newValue !== 'true' && newValue !== 'false') {
        return 'Boolean fields only accept "true" or "false" as default values';
      }

      // Check numeric values for numeric fields
      const numericTypes = ['integer', 'long', 'decimal', 'number', 'currency', 'percent'];
      const hasNumericFields = selectedFieldTypes.some((t) => numericTypes.includes(t!));
      if (hasNumericFields && newValue !== '' && isNaN(Number(newValue))) {
        return 'Numeric fields require a valid number as default value';
      }
    }

    // Validate min/max length and value
    if (['config.minLength', 'config.maxLength'].includes(selectedProperty.key)) {
      if (newValue !== '' && (isNaN(Number(newValue)) || Number(newValue) < 0)) {
        return 'Length must be a non-negative number';
      }
    }

    if (['config.minValue', 'config.maxValue'].includes(selectedProperty.key)) {
      if (newValue !== '' && isNaN(Number(newValue))) {
        return 'Value must be a valid number';
      }
    }

    return null;
  };

  if (!open) return null;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--hw-border-subtle)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
                Select Fields to Update
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                Choose which fields you want to update. You can filter by type or search by name.
              </p>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0" style={{ borderColor: 'var(--hw-border-subtle)', backgroundColor: 'var(--hw-bg-subtle)' }}>
              <div className="flex-1 max-w-xs">
                <Input
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  showSearch
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg border-0"
                  style={{ backgroundColor: 'var(--hw-bg)', color: 'var(--hw-text)' }}
                >
                  <option value="all">All types</option>
                  {fieldTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)} ({groupedFields[type]?.length || 0})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="secondary" size="sm" onClick={selectAllVisible}>
                  Select All
                </Button>
                <Button variant="secondary" size="sm" onClick={deselectAll} disabled={selectedFields.size === 0}>
                  Clear
                </Button>
              </div>
            </div>

            {/* Selection Summary */}
            <div className="px-6 py-2 border-b flex items-center gap-2 flex-shrink-0" style={{ borderColor: 'var(--hw-border-subtle)' }}>
              <Badge variant={selectedFields.size > 0 ? 'primary' : 'neutral'} size="md">
                {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
              </Badge>
              {selectedFields.size > 0 && (
                <span className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                  of {editableFields.length} editable fields
                </span>
              )}
            </div>

            {/* Field List */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {showTypeGroups && filterType === 'all' ? (
                // Grouped view
                <div className="space-y-6">
                  {Object.entries(groupedFields).map(([type, typeFields]) => {
                    const typeConfig = getFieldTypeConfig(type);
                    const selectedInGroup = typeFields.filter((f) => selectedFields.has(f.code)).length;

                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="p-1.5 rounded"
                              style={{ backgroundColor: `${typeConfig.color}15` }}
                            >
                              <div style={{ color: typeConfig.color }}>{typeConfig.icon}</div>
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </span>
                            <Badge variant="neutral" size="sm">
                              {selectedInGroup}/{typeFields.length}
                            </Badge>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => selectAllOfType(type)}
                          >
                            Select All
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {typeFields.map((field) => (
                            <FieldCheckbox
                              key={field.code}
                              field={field}
                              selected={selectedFields.has(field.code)}
                              onToggle={() => toggleField(field.code)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Flat view (when filtered or toggled)
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredFields.map((field) => (
                    <FieldCheckbox
                      key={field.code}
                      field={field}
                      selected={selectedFields.has(field.code)}
                      onToggle={() => toggleField(field.code)}
                    />
                  ))}
                </div>
              )}

              {filteredFields.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Search className="h-12 w-12 mb-4" style={{ color: 'var(--hw-text-muted)' }} />
                  <p className="text-lg font-medium" style={{ color: 'var(--hw-text)' }}>
                    No fields found
                  </p>
                  <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                    Try adjusting your search or filter
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--hw-border-subtle)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
                Select Property to Update
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                Choose which property you want to change for the {selectedFields.size} selected field{selectedFields.size !== 1 ? 's' : ''}.
              </p>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {applicableProperties.map((prop) => (
                  <button
                    key={prop.key}
                    type="button"
                    onClick={() => {
                      setSelectedProperty(prop);
                      setNewValue(prop.type === 'boolean' ? false : '');
                    }}
                    className={`
                      flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                      ${selectedProperty?.key === prop.key
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50/50'
                      }
                    `}
                    style={{
                      backgroundColor: selectedProperty?.key === prop.key ? 'rgba(59, 130, 246, 0.05)' : 'var(--hw-bg-subtle)',
                    }}
                  >
                    <div
                      className="p-3 rounded-lg"
                      style={{
                        backgroundColor: selectedProperty?.key === prop.key ? 'rgba(59, 130, 246, 0.1)' : 'var(--hw-bg)',
                      }}
                    >
                      <div style={{ color: selectedProperty?.key === prop.key ? '#3b82f6' : 'var(--hw-text-muted)' }}>
                        {prop.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                          {prop.label}
                        </span>
                        {prop.type === 'boolean' && (
                          <Badge variant="neutral" size="sm">Toggle</Badge>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
                        {prop.description}
                      </p>
                    </div>
                    {selectedProperty?.key === prop.key && (
                      <Check className="h-5 w-5 flex-shrink-0" style={{ color: '#3b82f6' }} />
                    )}
                  </button>
                ))}
              </div>

              {applicableProperties.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertTriangle className="h-12 w-12 mb-4" style={{ color: '#f59e0b' }} />
                  <p className="text-lg font-medium" style={{ color: 'var(--hw-text)' }}>
                    No compatible properties
                  </p>
                  <p className="text-sm text-center max-w-md" style={{ color: 'var(--hw-text-muted)' }}>
                    The selected fields have different types that don't share any bulk-updatable properties.
                    Try selecting fields of the same type.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--hw-border-subtle)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
                Set New Value
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                Enter the new value for <strong>{selectedProperty?.label}</strong> on {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''}.
              </p>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6">
              <div className="max-w-xl mx-auto">
                {/* Property info card */}
                <Card variant="default" padding="lg" className="mb-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="p-3 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                    >
                      <div style={{ color: '#3b82f6' }}>{selectedProperty?.icon}</div>
                    </div>
                    <div>
                      <h4 className="font-medium" style={{ color: 'var(--hw-text)' }}>
                        {selectedProperty?.label}
                      </h4>
                      <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                        {selectedProperty?.description}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Value input */}
                <div className="space-y-4">
                  {selectedProperty?.type === 'boolean' ? (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                        New Value
                      </label>
                      <div className="flex gap-4">
                        <label
                          className={`
                            flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                            ${newValue === true ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300'}
                          `}
                        >
                          <input
                            type="radio"
                            name="boolValue"
                            checked={newValue === true}
                            onChange={() => setNewValue(true)}
                            className="sr-only"
                          />
                          <Check className="h-5 w-5" style={{ color: newValue === true ? '#22c55e' : 'var(--hw-text-muted)' }} />
                          <span className="font-medium" style={{ color: newValue === true ? '#22c55e' : 'var(--hw-text)' }}>
                            Yes / True
                          </span>
                        </label>
                        <label
                          className={`
                            flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                            ${newValue === false ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}
                          `}
                        >
                          <input
                            type="radio"
                            name="boolValue"
                            checked={newValue === false}
                            onChange={() => setNewValue(false)}
                            className="sr-only"
                          />
                          <X className="h-5 w-5" style={{ color: newValue === false ? '#ef4444' : 'var(--hw-text-muted)' }} />
                          <span className="font-medium" style={{ color: newValue === false ? '#ef4444' : 'var(--hw-text)' }}>
                            No / False
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Input
                        label="New Value"
                        type={['config.minLength', 'config.maxLength', 'config.minValue', 'config.maxValue'].includes(selectedProperty?.key || '') ? 'number' : 'text'}
                        value={String(newValue)}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder={selectedProperty?.key === 'defaultValue' ? 'Enter default value or leave empty to clear' : 'Enter new value...'}
                        hint={
                          selectedProperty?.key === 'defaultValue'
                            ? 'Supports PostgreSQL expressions like now(), uuid_generate_v4(), etc.'
                            : undefined
                        }
                      />
                    </div>
                  )}

                  {/* Validation warning */}
                  {validateValue() && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">{validateValue()}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Affected fields preview */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                      Fields to be updated
                    </span>
                    <Badge variant="primary" size="sm">{selectedFields.size}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-auto p-3 rounded-lg" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
                    {Array.from(selectedFields).map((code) => {
                      const field = fields.find((f) => f.code === code);
                      if (!field) return null;
                      const typeConfig = getFieldTypeConfig(field.type);
                      return (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: `${typeConfig.color}15`, color: typeConfig.color }}
                        >
                          {typeConfig.icon}
                          {field.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--hw-border-subtle)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
                Update Complete
              </h3>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6">
              <div className="max-w-md mx-auto text-center">
                {updateResults && updateResults.failed === 0 ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <h4 className="text-xl font-semibold mb-2" style={{ color: 'var(--hw-text)' }}>
                      Successfully Updated
                    </h4>
                    <p className="text-sm mb-6" style={{ color: 'var(--hw-text-muted)' }}>
                      {updateResults.success} field{updateResults.success !== 1 ? 's were' : ' was'} updated successfully.
                    </p>
                  </>
                ) : updateResults ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="h-8 w-8 text-amber-600" />
                    </div>
                    <h4 className="text-xl font-semibold mb-2" style={{ color: 'var(--hw-text)' }}>
                      Partial Update
                    </h4>
                    <p className="text-sm mb-4" style={{ color: 'var(--hw-text-muted)' }}>
                      {updateResults.success} field{updateResults.success !== 1 ? 's' : ''} updated, {updateResults.failed} failed.
                    </p>
                    {updateResults.errors.length > 0 && (
                      <div className="text-left p-4 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                        <ul className="text-sm text-red-700 space-y-1">
                          {updateResults.errors.map((err, i) => (
                            <li key={i}>• {err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : null}

                <Button variant="primary" size="lg" onClick={onClose} className="mt-6">
                  Done
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative flex flex-col w-full h-full max-w-5xl max-h-[85vh] m-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--hw-bg)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--hw-border-subtle)' }}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
              <Layers className="h-5 w-5" style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                Bulk Update Field Configuration
              </h2>
              <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                {tableCode} • Update multiple fields at once
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--hw-text-muted)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--hw-border-subtle)', backgroundColor: 'var(--hw-bg-subtle)' }}>
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { num: 1, label: 'Select Fields' },
              { num: 2, label: 'Choose Property' },
              { num: 3, label: 'Set Value' },
              { num: 4, label: 'Complete' },
            ].map((s, i) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                      ${step >= s.num ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'}
                    `}
                  >
                    {step > s.num ? <Check className="h-4 w-4" /> : s.num}
                  </div>
                  <span
                    className="text-sm font-medium hidden sm:block"
                    style={{ color: step >= s.num ? 'var(--hw-text)' : 'var(--hw-text-muted)' }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < 3 && (
                  <div
                    className="flex-1 h-0.5 mx-4"
                    style={{ backgroundColor: step > s.num ? '#8b5cf6' : 'var(--hw-border-subtle)' }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 pt-4 flex-shrink-0">
            <div className="p-4 rounded-xl border border-red-200 bg-red-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderStep()}
        </div>

        {/* Footer */}
        {step < 4 && (
          <div
            className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0"
            style={{ borderColor: 'var(--hw-border-subtle)', backgroundColor: 'var(--hw-bg-subtle)' }}
          >
            <div>
              {step > 1 && (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>
                  ← Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              {step === 1 && (
                <Button
                  variant="primary"
                  onClick={() => setStep(2)}
                  disabled={selectedFields.size === 0}
                >
                  Continue ({selectedFields.size} selected)
                </Button>
              )}
              {step === 2 && (
                <Button
                  variant="primary"
                  onClick={() => setStep(3)}
                  disabled={!selectedProperty}
                >
                  Continue
                </Button>
              )}
              {step === 3 && (
                <Button
                  variant="primary"
                  onClick={handleBulkUpdate}
                  disabled={isUpdating || !!validateValue()}
                  loading={isUpdating}
                >
                  {isUpdating ? 'Updating...' : `Update ${selectedFields.size} Field${selectedFields.size !== 1 ? 's' : ''}`}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Field checkbox component
const FieldCheckbox: React.FC<{
  field: AuthorizedFieldMeta;
  selected: boolean;
  onToggle: () => void;
}> = ({ field, selected, onToggle }) => {
  const typeConfig = getFieldTypeConfig(field.type);

  return (
    <label
      className={`
        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
        ${selected
          ? 'border-purple-500 bg-purple-50/50 shadow-sm'
          : 'border-transparent hover:border-slate-200 hover:bg-slate-50/50'
        }
      `}
      style={{ backgroundColor: selected ? 'rgba(139, 92, 246, 0.05)' : 'var(--hw-bg)' }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="sr-only"
      />
      <div
        className={`
          w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
          ${selected ? 'bg-purple-600 border-purple-600' : 'border-slate-300 bg-white'}
        `}
      >
        {selected && <Check className="h-3.5 w-3.5 text-white" />}
      </div>
      <div
        className="p-1.5 rounded"
        style={{ backgroundColor: `${typeConfig.color}15` }}
      >
        <div style={{ color: typeConfig.color }}>{typeConfig.icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--hw-text)' }}>
          {field.label}
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--hw-text-muted)' }}>
          {field.code}
        </div>
      </div>
    </label>
  );
};

export default BulkFieldUpdateModal;
