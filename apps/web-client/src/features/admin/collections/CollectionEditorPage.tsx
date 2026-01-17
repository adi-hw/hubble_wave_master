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
  Zap,
  Code2,
  ExternalLink,
  List,
} from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import metadataApi from '../../../services/metadataApi';

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

// API response uses different field names than the form
interface CollectionApiResponse {
  id: string;
  code: string;
  name: string;  // API returns 'name', we display as 'label'
  pluralName?: string;  // API returns 'pluralName', we use 'labelPlural'
  description?: string;
  icon?: string;
  color?: string;
  tableName: string;  // API returns 'tableName', we use 'storageTable'
  category?: string;
  isSystem: boolean;
  isExtensible: boolean;
  isAudited: boolean;
  enableVersioning: boolean;  // API returns 'enableVersioning', we use 'isVersioned'
  applicationId?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
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
  const [publishing, setPublishing] = useState(false);
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
      const response = await metadataApi.get<CollectionApiResponse>(`/collections/${collectionId}`);
      const apiData = response.data;

      // Map API response to our internal Collection format
      const mappedCollection: Collection = {
        id: apiData.id,
        code: apiData.code,
        label: apiData.name,  // API 'name' → 'label'
        labelPlural: apiData.pluralName || '',  // API 'pluralName' → 'labelPlural'
        description: apiData.description || '',
        icon: apiData.icon || 'Layers',
        color: apiData.color || '#4f46e5',
        storageTable: apiData.tableName,  // API 'tableName' → 'storageTable'
        category: apiData.category || '',
        isExtensible: apiData.isExtensible,
        isAudited: apiData.isAudited,
        isVersioned: apiData.enableVersioning,  // API 'enableVersioning' → 'isVersioned'
        tags: (apiData.metadata?.tags as string[]) || [],
        isSystem: apiData.isSystem,
        moduleId: apiData.applicationId,
        publishedAt: apiData.publishedAt,
        createdAt: apiData.createdAt,
        updatedAt: apiData.updatedAt,
      };

      setCollection(mappedCollection);
      setForm({
        code: mappedCollection.code,
        label: mappedCollection.label,
        labelPlural: mappedCollection.labelPlural,
        description: mappedCollection.description,
        icon: mappedCollection.icon,
        color: mappedCollection.color,
        storageTable: mappedCollection.storageTable,
        category: mappedCollection.category,
        isExtensible: mappedCollection.isExtensible,
        isAudited: mappedCollection.isAudited,
        isVersioned: mappedCollection.isVersioned,
        tags: mappedCollection.tags,
      });
    } catch (error) {
      console.error('Failed to fetch collection:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await metadataApi.get<string[]>('/collections/categories');
      setCategories(response.data);
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
      // Map form data to API format
      const apiPayload = {
        code: form.code,
        label: form.label,  // API expects 'label', service maps to 'name'
        labelPlural: form.labelPlural,  // API expects 'labelPlural', service maps to 'pluralName'
        description: form.description,
        icon: form.icon,
        color: form.color,
        storageTable: form.storageTable,  // API expects 'storageTable', service maps to 'tableName'
        category: form.category,
        isExtensible: form.isExtensible,
        isAudited: form.isAudited,
        isVersioned: form.isVersioned,  // API expects 'isVersioned', service maps to 'enableVersioning'
        tags: form.tags,
      };

      if (isNew) {
        const response = await metadataApi.post<CollectionApiResponse>('/collections', apiPayload);
        const apiData = response.data;
        navigate(`/studio/collections/${apiData.id}`);
      } else {
        const response = await metadataApi.put<CollectionApiResponse>(`/collections/${id}`, apiPayload);
        const apiData = response.data;
        // Re-map response to internal format
        const mappedCollection: Collection = {
          id: apiData.id,
          code: apiData.code,
          label: apiData.name,
          labelPlural: apiData.pluralName || '',
          description: apiData.description || '',
          icon: apiData.icon || 'Layers',
          color: apiData.color || '#4f46e5',
          storageTable: apiData.tableName,
          category: apiData.category || '',
          isExtensible: apiData.isExtensible,
          isAudited: apiData.isAudited,
          isVersioned: apiData.enableVersioning,
          tags: (apiData.metadata?.tags as string[]) || [],
          isSystem: apiData.isSystem,
          moduleId: apiData.applicationId,
          publishedAt: apiData.publishedAt,
          createdAt: apiData.createdAt,
          updatedAt: apiData.updatedAt,
        };
        setCollection(mappedCollection);
      }
    } catch (error: any) {
      console.error('Failed to save collection:', error);
      const message = error?.response?.data?.message || 'Failed to save collection';
      setErrors({ _form: message });
    } finally {
      setSaving(false);
    }
  };

  const handlePublishAndDeploy = async () => {
    if (!id) return;

    setPublishing(true);
    setErrors((prev) => ({ ...prev, _form: '' }));
    try {
      const response = await metadataApi.post<CollectionApiResponse>(`/collections/${id}/publish`);
      const published = response.data;
      await metadataApi.post('/schema/deploy', { collectionCodes: [published.code] });
      await fetchCollection(id);
    } catch (error: any) {
      console.error('Failed to publish and deploy:', error);
      const message = error?.response?.data?.message || 'Failed to publish and deploy schema';
      setErrors({ _form: message });
    } finally {
      setPublishing(false);
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
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/collections.list')}
          className="p-2 rounded-lg transition-colors bg-transparent hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {isNew ? 'New Collection' : `Edit ${collection?.label}`}
          </h1>
          {!isNew && collection && (
            <p className="text-sm mt-1 text-muted-foreground">
              Last updated {new Date(collection.updatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isNew && collection && !collection.publishedAt && (
            <Button
              variant="secondary"
              leftIcon={<Eye className="h-4 w-4" />}
              onClick={handlePublishAndDeploy}
              loading={publishing}
            >
              Publish & Deploy
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
        <div className="mb-6 p-4 rounded-lg border bg-destructive/10 border-destructive">
          <p className="text-sm text-destructive">{errors._form}</p>
        </div>
      )}

      {collection?.isSystem && (
        <div className="mb-6 p-4 rounded-lg border bg-warning-subtle border-warning-border">
          <p className="text-sm text-warning-text">
            This is a system collection. Some properties cannot be modified.
          </p>
        </div>
      )}

      {/* Form Sections */}
      <div className="space-y-8">
        {/* Basic Information */}
        <section className="rounded-xl border p-6 bg-card border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
              <p className="text-sm text-muted-foreground">Define the collection identity</p>
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
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe what this collection is used for..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none bg-card border-border text-foreground"
              />
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="rounded-xl border p-6 bg-card border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-violet-500/10">
              <Palette className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
              <p className="text-sm text-muted-foreground">Customize the visual representation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
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
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Layers className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleChange('color', color)}
                    className={`h-10 w-10 rounded-lg border-2 transition-transform hover:scale-105 ${
                      form.color === color ? 'scale-110 border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Organization */}
        <section className="rounded-xl border p-6 bg-card border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-warning-subtle">
              <FolderOpen className="h-5 w-5 text-warning-text" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Organization</h2>
              <p className="text-sm text-muted-foreground">Categorize and tag the collection</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Category
              </label>
              <div className="flex gap-2">
                <select
                  value={form.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-card border-border text-foreground"
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
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
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
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm bg-muted text-muted-foreground"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-destructive"
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
        <section className="rounded-xl border p-6 bg-card border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-success-subtle">
              <Settings2 className="h-5 w-5 text-success-text" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Behavior</h2>
              <p className="text-sm text-muted-foreground">Configure collection behavior</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors border-border bg-card hover:bg-muted">
              <input
                type="checkbox"
                checked={form.isExtensible}
                onChange={(e) => handleChange('isExtensible', e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Layers className="h-4 w-4" />
                  Extensible
                </div>
                <p className="text-sm mt-1 text-muted-foreground">
                  Allow admins to add custom properties
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors border-border bg-card hover:bg-muted">
              <input
                type="checkbox"
                checked={form.isAudited}
                onChange={(e) => handleChange('isAudited', e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Shield className="h-4 w-4" />
                  Audited
                </div>
                <p className="text-sm mt-1 text-muted-foreground">
                  Track all changes in audit log
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors border-border bg-card hover:bg-muted">
              <input
                type="checkbox"
                checked={form.isVersioned}
                onChange={(e) => handleChange('isVersioned', e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <History className="h-4 w-4" />
                  Versioned
                </div>
                <p className="text-sm mt-1 text-muted-foreground">
                  Keep version history of records
                </p>
              </div>
            </label>
          </div>
        </section>

        {/* Properties Summary (only for existing collections) */}
        {!isNew && collection && (
          <section className="rounded-xl border p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-info-subtle">
                  <Layers className="h-5 w-5 text-info-text" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Properties</h2>
                  <p className="text-sm text-muted-foreground">Manage collection properties</p>
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
          <section className="rounded-xl border p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-violet-500/10">
                  <LayoutList className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Views</h2>
                  <p className="text-sm text-muted-foreground">Configure list, board, calendar, and form views</p>
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

        {/* Automations (only for existing collections) */}
        {!isNew && collection && (
          <section className="rounded-xl border p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-warning-subtle">
                  <Zap className="h-5 w-5 text-warning-text" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Automations</h2>
                  <p className="text-sm text-muted-foreground">Configure server-side business rules and triggers</p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/studio/collections/${id}/automations`)}
              >
                Manage Automations
              </Button>
            </div>
          </section>
        )}

        {/* UI Scripts (only for existing collections) */}
        {!isNew && collection && (
          <section className="rounded-xl border p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-success-subtle">
                  <Code2 className="h-5 w-5 text-success-text" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">UI Scripts</h2>
                  <p className="text-sm text-muted-foreground">Configure on load, on change, on submit, and on cell edit logic</p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/studio/collections/${id}/scripts`)}
              >
                Manage Scripts
              </Button>
            </div>
          </section>
        )}

        {/* Access Rules (only for existing collections) */}
        {!isNew && collection && (
          <section className="rounded-xl border p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-danger-subtle">
                  <Shield className="h-5 w-5 text-danger-text" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Access Rules</h2>
                  <p className="text-sm text-muted-foreground">Configure row-level and field-level security</p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/studio/collections/${id}/access`)}
              >
                Manage Access
              </Button>
            </div>
          </section>
        )}

        {/* Quick Actions (only for existing collections) */}
        {!isNew && collection && (
          <section className="rounded-xl border p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted">
                  <List className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Records</h2>
                  <p className="text-sm text-muted-foreground">View and manage data in this collection</p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/${collection.code}.list`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Records
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default CollectionEditorPage;
