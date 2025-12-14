import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Database,
  Layers,
  Settings2,
  Eye,
  History,
  Shield,
  Palette,
  Tag,
  FolderOpen,
  RefreshCw,
  LayoutList,
} from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';

interface CollectionFormData {
  code: string;
  label: string;
  labelPlural: string;
  description: string;
  icon: string;
  color: string;
  storageTable: string;
  category: string;
  isExtensible: boolean;
  isAudited: boolean;
  isVersioned: boolean;
  tags: string[];
}

interface Collection extends CollectionFormData {
  id: string;
  isSystem: boolean;
  moduleId?: string;
  displayPropertyId?: string;
  identifierPropertyId?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const defaultForm: CollectionFormData = {
  code: '',
  label: '',
  labelPlural: '',
  description: '',
  icon: 'Layers',
  color: '#4f46e5',
  storageTable: '',
  category: '',
  isExtensible: true,
  isAudited: true,
  isVersioned: false,
  tags: [],
};

const iconOptions = [
  'Layers', 'Database', 'Users', 'FileText', 'Settings', 'Package',
  'ShoppingCart', 'Briefcase', 'Building', 'Calendar', 'Clock',
  'Mail', 'Phone', 'Globe', 'Map', 'Box', 'Truck', 'Tool', 'Wrench',
  'Shield', 'Lock', 'Key', 'Star', 'Heart', 'Bookmark', 'Flag',
];

const colorOptions = [
  '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
];

export const CollectionEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CollectionFormData>(defaultForm);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch collection if editing
  useEffect(() => {
    if (!isNew && id) {
      fetchCollection(id);
    }
    fetchCategories();
  }, [id, isNew]);

  const fetchCollection = async (collectionId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data: Collection = await response.json();
        setCollection(data);
        setForm({
          code: data.code,
          label: data.label,
          labelPlural: data.labelPlural || '',
          description: data.description || '',
          icon: data.icon || 'Layers',
          color: data.color || '#4f46e5',
          storageTable: data.storageTable,
          category: data.category || '',
          isExtensible: data.isExtensible,
          isAudited: data.isAudited,
          isVersioned: data.isVersioned,
          tags: data.tags || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch collection:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/collections/categories', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleChange = (field: keyof CollectionFormData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));

    // Auto-generate storage table and plural from code/label
    if (field === 'code' && !collection) {
      const code = value as string;
      setForm(prev => ({
        ...prev,
        code,
        storageTable: `u_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      }));
    }
    if (field === 'label' && !form.labelPlural) {
      const label = value as string;
      setForm(prev => ({
        ...prev,
        label,
        labelPlural: `${label}s`,
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

    if (!form.storageTable.trim()) {
      newErrors.storageTable = 'Storage table is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const url = isNew ? '/api/collections' : `/api/collections/${id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      if (response.ok) {
        const saved = await response.json();
        if (isNew) {
          navigate(`/studio/collections/${saved.id}`);
        } else {
          setCollection(saved);
        }
      } else {
        const error = await response.json();
        if (error.message) {
          setErrors({ _form: error.message });
        }
      }
    } catch (error) {
      console.error('Failed to save collection:', error);
      setErrors({ _form: 'Failed to save collection' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

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
          onClick={() => navigate('/studio/collections')}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {isNew ? 'New Collection' : `Edit ${collection?.label}`}
          </h1>
          {!isNew && collection && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Last updated {new Date(collection.updatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isNew && collection && !collection.publishedAt && (
            <Button
              variant="secondary"
              leftIcon={<Eye className="h-4 w-4" />}
              onClick={async () => {
                const response = await fetch(`/api/collections/${id}/publish`, {
                  method: 'POST',
                  credentials: 'include',
                });
                if (response.ok) fetchCollection(id!);
              }}
            >
              Publish
            </Button>
          )}
          <Button
            variant="primary"
            leftIcon={<Save className="h-4 w-4" />}
            onClick={handleSave}
            loading={saving}
            disabled={collection?.isSystem}
          >
            {isNew ? 'Create Collection' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {errors._form && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{errors._form}</p>
        </div>
      )}

      {collection?.isSystem && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            This is a system collection. Some properties cannot be modified.
          </p>
        </div>
      )}

      {/* Form Sections */}
      <div className="space-y-8">
        {/* Basic Information */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Database className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Basic Information</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Define the collection identity</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => handleChange('code', e.target.value)}
              error={errors.code}
              placeholder="e.g., incident"
              hint="Unique identifier (lowercase, no spaces)"
              disabled={!!collection}
            />
            <Input
              label="Storage Table"
              value={form.storageTable}
              onChange={(e) => handleChange('storageTable', e.target.value)}
              error={errors.storageTable}
              placeholder="e.g., u_incident"
              hint="Database table name"
              disabled={!!collection}
            />
            <Input
              label="Label"
              value={form.label}
              onChange={(e) => handleChange('label', e.target.value)}
              error={errors.label}
              placeholder="e.g., Incident"
            />
            <Input
              label="Label (Plural)"
              value={form.labelPlural}
              onChange={(e) => handleChange('labelPlural', e.target.value)}
              placeholder="e.g., Incidents"
            />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe what this collection is used for..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Palette className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Customize the visual representation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                Icon
              </label>
              <div className="flex flex-wrap gap-2">
                {iconOptions.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => handleChange('icon', icon)}
                    className={`p-2 rounded-lg border transition-colors ${
                      form.icon === icon
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Layers className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleChange('color', color)}
                    className={`h-10 w-10 rounded-lg border-2 transition-transform ${
                      form.color === color
                        ? 'border-slate-900 dark:border-white scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Organization */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Organization</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Categorize and tag the collection</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                Category
              </label>
              <div className="flex gap-2">
                <select
                  value={form.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select or create category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <Input
                  value={form.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  placeholder="Or type new..."
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add tag..."
                  className="flex-1"
                />
                <Button variant="secondary" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Behavior */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Behavior</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Configure collection behavior</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={form.isExtensible}
                onChange={(e) => handleChange('isExtensible', e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <Layers className="h-4 w-4" />
                  Extensible
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Allow tenant admins to add custom properties
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={form.isAudited}
                onChange={(e) => handleChange('isAudited', e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <Shield className="h-4 w-4" />
                  Audited
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Track all changes in audit log
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={form.isVersioned}
                onChange={(e) => handleChange('isVersioned', e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <History className="h-4 w-4" />
                  Versioned
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Keep version history of records
                </p>
              </div>
            </label>
          </div>
        </section>

        {/* Properties Summary (only for existing collections) */}
        {!isNew && collection && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Properties</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Manage collection properties</p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/studio/collections/${id}/properties`)}
              >
                Manage Properties
              </Button>
            </div>
          </section>
        )}

        {/* Views Summary (only for existing collections) */}
        {!isNew && collection && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <LayoutList className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Views</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Configure list, board, calendar, and form views</p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/studio/collections/${id}/views`)}
              >
                Manage Views
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default CollectionEditorPage;
