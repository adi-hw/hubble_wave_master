import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Type,
  Settings2,
  Eye,
  List,
  Link2,
  RefreshCw,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';

interface PropertyType {
  code: string;
  label: string;
  description?: string;
  icon?: string;
  category: string;
  supportsChoices: boolean;
  supportsReference: boolean;
  supportsComputed: boolean;
  supportsEncryption: boolean;
}

interface ChoiceOption {
  value: string;
  label: string;
  color?: string;
  sortOrder?: number;
  isDefault?: boolean;
}

interface Collection {
  id: string;
  code: string;
  label: string;
}

interface PropertyFormData {
  code: string;
  label: string;
  description: string;
  propertyType: string;
  storageColumn: string;
  isRequired: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  isSearchable: boolean;
  isFilterable: boolean;
  isSortable: boolean;
  isReadonly: boolean;
  isComputed: boolean;
  isEncrypted: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
  computedFormula: string;
  validationRegex: string;
  validationMessage: string;
  hintText: string;
  placeholder: string;
  referenceCollectionId: string;
  referenceDisplayProperty: string;
  choiceList: ChoiceOption[];
  choiceType: string;
  groupName: string;
  uiWidth: string;
}

const defaultForm: PropertyFormData = {
  code: '',
  label: '',
  description: '',
  propertyType: 'string',
  storageColumn: '',
  isRequired: false,
  isUnique: false,
  isIndexed: false,
  isSearchable: true,
  isFilterable: true,
  isSortable: true,
  isReadonly: false,
  isComputed: false,
  isEncrypted: false,
  defaultValue: '',
  computedFormula: '',
  validationRegex: '',
  validationMessage: '',
  hintText: '',
  placeholder: '',
  referenceCollectionId: '',
  referenceDisplayProperty: '',
  choiceList: [],
  choiceType: 'static',
  groupName: '',
  uiWidth: 'full',
};

const uiWidthOptions = [
  { value: 'quarter', label: '25%' },
  { value: 'third', label: '33%' },
  { value: 'half', label: '50%' },
  { value: 'two_thirds', label: '67%' },
  { value: 'three_quarters', label: '75%' },
  { value: 'full', label: '100%' },
];

const colorOptions = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#64748b',
];

export const PropertyEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: collectionId, propertyId } = useParams<{ id: string; propertyId: string }>();
  const isNew = propertyId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PropertyFormData>(defaultForm);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newChoice, setNewChoice] = useState({ value: '', label: '', color: '#64748b' });

  useEffect(() => {
    fetchPropertyTypes();
    fetchCollections();
    if (collectionId) {
      fetchCollection();
    }
    if (!isNew && propertyId) {
      fetchProperty();
    }
  }, [collectionId, propertyId, isNew]);

  const fetchPropertyTypes = async () => {
    try {
      const response = await fetch('/api/collections/property-types', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPropertyTypes(data);
      }
    } catch (error) {
      console.error('Failed to fetch property types:', error);
    }
  };

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/collections?includeSystem=true', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    }
  };

  const fetchCollection = async () => {
    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
      }
    } catch (error) {
      console.error('Failed to fetch collection:', error);
    }
  };

  const fetchProperty = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setForm({
          code: data.code,
          label: data.label,
          description: data.description || '',
          propertyType: data.propertyType,
          storageColumn: data.storageColumn,
          isRequired: data.isRequired,
          isUnique: data.isUnique,
          isIndexed: data.isIndexed,
          isSearchable: data.isSearchable,
          isFilterable: data.isFilterable,
          isSortable: data.isSortable,
          isReadonly: data.isReadonly,
          isComputed: data.isComputed,
          isEncrypted: data.isEncrypted,
          maxLength: data.maxLength,
          minValue: data.minValue,
          maxValue: data.maxValue,
          defaultValue: data.defaultValue ? JSON.stringify(data.defaultValue) : '',
          computedFormula: data.computedFormula || '',
          validationRegex: data.validationRegex || '',
          validationMessage: data.validationMessage || '',
          hintText: data.hintText || '',
          placeholder: data.placeholder || '',
          referenceCollectionId: data.referenceCollectionId || '',
          referenceDisplayProperty: data.referenceDisplayProperty || '',
          choiceList: data.choiceList || [],
          choiceType: data.choiceType || 'static',
          groupName: data.groupName || '',
          uiWidth: data.uiWidth || 'full',
        });
      }
    } catch (error) {
      console.error('Failed to fetch property:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof PropertyFormData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));

    // Auto-generate storage column from code
    if (field === 'code' && isNew) {
      const code = value as string;
      setForm(prev => ({
        ...prev,
        code,
        storageColumn: code.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.code.trim()) {
      newErrors.code = 'Code is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(form.code)) {
      newErrors.code = 'Code must start with a letter and contain only lowercase letters, numbers, and underscores';
    }

    if (!form.label.trim()) {
      newErrors.label = 'Label is required';
    }

    if (!form.storageColumn.trim()) {
      newErrors.storageColumn = 'Storage column is required';
    }

    const selectedType = propertyTypes.find(t => t.code === form.propertyType);
    if (selectedType?.supportsReference && !form.referenceCollectionId) {
      newErrors.referenceCollectionId = 'Reference collection is required for this type';
    }

    if (form.isComputed && !form.computedFormula) {
      newErrors.computedFormula = 'Formula is required for computed properties';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const url = isNew ? '/api/properties' : `/api/properties/${propertyId}`;
      const method = isNew ? 'POST' : 'PUT';

      const payload = {
        ...form,
        collectionId,
        defaultValue: form.defaultValue ? JSON.parse(form.defaultValue) : undefined,
        maxLength: form.maxLength || undefined,
        minValue: form.minValue || undefined,
        maxValue: form.maxValue || undefined,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        navigate(`/studio/collections/${collectionId}/properties`);
      } else {
        const error = await response.json();
        if (error.message) {
          setErrors({ _form: error.message });
        }
      }
    } catch (error) {
      console.error('Failed to save property:', error);
      setErrors({ _form: 'Failed to save property' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddChoice = () => {
    if (!newChoice.value.trim() || !newChoice.label.trim()) return;

    setForm(prev => ({
      ...prev,
      choiceList: [
        ...prev.choiceList,
        { ...newChoice, sortOrder: prev.choiceList.length * 10 },
      ],
    }));
    setNewChoice({ value: '', label: '', color: '#64748b' });
  };

  const handleRemoveChoice = (value: string) => {
    setForm(prev => ({
      ...prev,
      choiceList: prev.choiceList.filter(c => c.value !== value),
    }));
  };

  const selectedType = propertyTypes.find(t => t.code === form.propertyType);

  // Group property types by category
  const typesByCategory = propertyTypes.reduce((acc, type) => {
    if (!acc[type.category]) acc[type.category] = [];
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, PropertyType[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/studio/collections/${collectionId}/properties`)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {isNew ? 'New Property' : `Edit ${form.label}`}
          </h1>
          {collection && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {collection.label}
            </p>
          )}
        </div>
        <Button
          variant="primary"
          leftIcon={<Save className="h-4 w-4" />}
          onClick={handleSave}
          loading={saving}
        >
          {isNew ? 'Create Property' : 'Save Changes'}
        </Button>
      </div>

      {errors._form && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{errors._form}</p>
        </div>
      )}

      {/* Form Sections */}
      <div className="space-y-8">
        {/* Basic Information */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Type className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Basic Information</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Define the property identity</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => handleChange('code', e.target.value)}
              error={errors.code}
              placeholder="e.g., short_description"
              hint="Unique identifier (lowercase)"
              disabled={!isNew}
            />
            <Input
              label="Storage Column"
              value={form.storageColumn}
              onChange={(e) => handleChange('storageColumn', e.target.value)}
              error={errors.storageColumn}
              placeholder="e.g., short_description"
              disabled={!isNew}
            />
            <Input
              label="Label"
              value={form.label}
              onChange={(e) => handleChange('label', e.target.value)}
              error={errors.label}
              placeholder="e.g., Short Description"
            />
            <Input
              label="Group"
              value={form.groupName}
              onChange={(e) => handleChange('groupName', e.target.value)}
              placeholder="e.g., General"
              hint="Group properties in forms"
            />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe what this property stores..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          </div>
        </section>

        {/* Property Type */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Property Type</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Select the data type</p>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(typesByCategory).map(([category, types]) => (
              <div key={category}>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {types.map((type) => (
                    <button
                      key={type.code}
                      type="button"
                      onClick={() => handleChange('propertyType', type.code)}
                      disabled={!isNew}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                        form.propertyType === type.code
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Reference Configuration */}
        {selectedType?.supportsReference && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reference Configuration</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Configure the reference target</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                  Target Collection
                </label>
                <select
                  value={form.referenceCollectionId}
                  onChange={(e) => handleChange('referenceCollectionId', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select collection...</option>
                  {collections.map((coll) => (
                    <option key={coll.id} value={coll.id}>{coll.label}</option>
                  ))}
                </select>
                {errors.referenceCollectionId && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.referenceCollectionId}</p>
                )}
              </div>
              <Input
                label="Display Property"
                value={form.referenceDisplayProperty}
                onChange={(e) => handleChange('referenceDisplayProperty', e.target.value)}
                placeholder="e.g., name"
                hint="Property to display from referenced record"
              />
            </div>
          </section>
        )}

        {/* Choice Configuration */}
        {selectedType?.supportsChoices && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <List className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Choice Options</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Define available choices</p>
              </div>
            </div>

            {/* Add new choice */}
            <div className="flex items-end gap-3 mb-4">
              <Input
                label="Value"
                value={newChoice.value}
                onChange={(e) => setNewChoice(prev => ({ ...prev, value: e.target.value }))}
                placeholder="e.g., open"
                className="flex-1"
              />
              <Input
                label="Label"
                value={newChoice.label}
                onChange={(e) => setNewChoice(prev => ({ ...prev, label: e.target.value }))}
                placeholder="e.g., Open"
                className="flex-1"
              />
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                  Color
                </label>
                <div className="flex gap-1">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewChoice(prev => ({ ...prev, color }))}
                      className={`h-8 w-8 rounded border-2 transition-transform ${
                        newChoice.color === color
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <Button variant="secondary" onClick={handleAddChoice}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Choice list */}
            {form.choiceList.length > 0 && (
              <div className="space-y-2">
                {form.choiceList.map((choice) => (
                  <div
                    key={choice.value}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                  >
                    <GripVertical className="h-4 w-4 text-slate-400 cursor-grab" />
                    <span
                      className="h-5 w-5 rounded"
                      style={{ backgroundColor: choice.color || '#64748b' }}
                    />
                    <code className="text-sm text-slate-600 dark:text-slate-400">{choice.value}</code>
                    <span className="text-sm text-slate-900 dark:text-slate-100 flex-1">{choice.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChoice(choice.value)}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Display Settings */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Display Settings</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Configure form appearance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                Width
              </label>
              <select
                value={form.uiWidth}
                onChange={(e) => handleChange('uiWidth', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {uiWidthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <Input
              label="Placeholder"
              value={form.placeholder}
              onChange={(e) => handleChange('placeholder', e.target.value)}
              placeholder="Enter placeholder text..."
            />
            <div className="md:col-span-2">
              <Input
                label="Hint Text"
                value={form.hintText}
                onChange={(e) => handleChange('hintText', e.target.value)}
                placeholder="Help text shown below the field..."
              />
            </div>
          </div>
        </section>

        {/* Behavior Flags */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Behavior</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Configure property behavior</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { field: 'isRequired', label: 'Required', desc: 'Must have a value' },
              { field: 'isUnique', label: 'Unique', desc: 'No duplicates allowed' },
              { field: 'isIndexed', label: 'Indexed', desc: 'Optimize queries' },
              { field: 'isSearchable', label: 'Searchable', desc: 'Include in search' },
              { field: 'isFilterable', label: 'Filterable', desc: 'Show in filters' },
              { field: 'isSortable', label: 'Sortable', desc: 'Allow sorting' },
              { field: 'isReadonly', label: 'Read-only', desc: 'Cannot be edited' },
              { field: 'isEncrypted', label: 'Encrypted', desc: 'Encrypt at rest' },
            ].map(({ field, label, desc }) => (
              <label
                key={field}
                className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={form[field as keyof PropertyFormData] as boolean}
                  onChange={(e) => handleChange(field as keyof PropertyFormData, e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PropertyEditorPage;
