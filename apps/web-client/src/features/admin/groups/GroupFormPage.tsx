import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Building,
  Layers,
  Users,
  MapPin,
  Zap,
  Settings,
  Loader2,
} from 'lucide-react';
import identityApi from '../../../services/identityApi';

type GroupType = 'organization' | 'department' | 'team' | 'location' | 'dynamic' | 'standard';

interface Group {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: GroupType;
  parentId?: string | null;
  icon?: string;
  color?: string;
  isActive: boolean;
}

interface GroupFormData {
  code: string;
  name: string;
  description: string;
  type: GroupType;
  parentId: string;
  icon: string;
  color: string;
}

const groupTypeOptions: Array<{ value: GroupType; label: string; icon: React.FC<{ className?: string }>; description: string }> = [
  { value: 'organization', label: 'Organization', icon: Building, description: 'Top-level organizational unit' },
  { value: 'department', label: 'Department', icon: Layers, description: 'Functional department or division' },
  { value: 'team', label: 'Team', icon: Users, description: 'Working team or project group' },
  { value: 'location', label: 'Location', icon: MapPin, description: 'Geographic location or site' },
  { value: 'dynamic', label: 'Dynamic', icon: Zap, description: 'Rule-based automatic membership' },
  { value: 'standard', label: 'Standard', icon: Settings, description: 'General purpose group' },
];

export const GroupFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id) && id !== 'new';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState<GroupFormData>({
    code: '',
    name: '',
    description: '',
    type: 'standard',
    parentId: '',
    icon: '',
    color: '',
  });

  const fetchGroups = useCallback(async () => {
    try {
      const response = await identityApi.get<{ data: Group[] }>('/admin/groups');
      const filteredGroups = isEditing
        ? response.data.data.filter((g) => g.id !== id && g.isActive)
        : response.data.data.filter((g) => g.isActive);
      setGroups(filteredGroups);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  }, [id, isEditing]);

  const fetchGroup = useCallback(async () => {
    if (!isEditing) return;

    setLoading(true);
    try {
      const response = await identityApi.get<{ data: Group }>(`/admin/groups/${id}`);
      const group = response.data.data;
      setFormData({
        code: group.code,
        name: group.name,
        description: group.description || '',
        type: group.type,
        parentId: group.parentId || '',
        icon: group.icon || '',
        color: group.color || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  }, [id, isEditing]);

  useEffect(() => {
    fetchGroups();
    fetchGroup();
  }, [fetchGroups, fetchGroup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload = {
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        parentId: formData.parentId || null,
        icon: formData.icon || undefined,
        color: formData.color || undefined,
      };

      if (isEditing) {
        await identityApi.put(`/admin/groups/${id}`, payload);
      } else {
        await identityApi.post('/admin/groups', payload);
      }

      navigate('/studio/groups');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof GroupFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === 'name' && !formData.code) {
      const code = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, code }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/studio/groups')}
          className="p-2 rounded-lg transition-colors bg-transparent hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isEditing ? 'Edit Group' : 'Create Group'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditing ? 'Update group details' : 'Create a new group for organizing users'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg border bg-destructive/10 border-destructive">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border p-6 bg-card border-border">
          <h2 className="font-medium mb-4 text-foreground">
            Basic Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Engineering Team"
                required
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 border-border bg-card text-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Code <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder="e.g., engineering-team"
                required
                disabled={isEditing}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono disabled:opacity-50 border-border bg-card text-foreground"
              />
              <p className="text-xs mt-1 text-muted-foreground">
                Unique identifier. Cannot be changed after creation.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Brief description of the group..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none border-border bg-card text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-6 bg-card border-border">
          <h2 className="font-medium mb-4 text-foreground">
            Group Type
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {groupTypeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = formData.type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('type', option.value)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <div className="font-medium text-foreground">
                        {option.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border p-6 bg-card border-border">
          <h2 className="font-medium mb-4 text-foreground">
            Hierarchy
          </h2>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Parent Group
            </label>
            <select
              value={formData.parentId}
              onChange={(e) => handleChange('parentId', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 border-border bg-card text-foreground"
            >
              <option value="">No parent (root group)</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.code})
                </option>
              ))}
            </select>
            <p className="text-xs mt-1 text-muted-foreground">
              Groups inherit roles from their parent groups.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/studio/groups')}
            className="btn-secondary px-4 py-2 text-sm rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? 'Update Group' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GroupFormPage;
