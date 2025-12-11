import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  User,
  Tag,
  Layers,
  Edit,
  Trash2,
  Loader2,
  XCircle,
  History,
  Code,
  Save,
} from 'lucide-react';
import {
  useCustomization,
  useCompareWithPlatform,
  useCustomizationVersionHistory,
  useCustomizationMutations,
} from '../hooks';
import type { CustomizationType, ConfigType } from '../types';
import { Button, DiffViewer, Badge } from '../../../components/ui';

const customizationTypeLabels: Record<CustomizationType, string> = {
  override: 'Override',
  extend: 'Extension',
  new: 'Custom',
};

const customizationTypeDescriptions: Record<CustomizationType, string> = {
  override: 'Completely replaces the platform configuration',
  extend: 'Extends the platform configuration with additional properties',
  new: 'A new configuration not based on any platform config',
};

const configTypeLabels: Record<ConfigType, string> = {
  table: 'Table',
  field: 'Field',
  acl: 'ACL',
  workflow: 'Workflow',
  script: 'Script',
  approval: 'Approval',
  notification: 'Notification',
  event: 'Event',
  business_rule: 'Business Rule',
};

export const CustomizationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedConfig, setEditedConfig] = useState<string>('');

  // Fetch customization data
  const { customization, loading, error, refetch } = useCustomization(id || null);
  const { comparison } = useCompareWithPlatform(id || null);
  const {
    versions,
    loading: versionsLoading,
  } = useCustomizationVersionHistory(
    customization?.configType || '',
    customization?.resourceKey || '',
    { enabled: showVersionHistory && !!customization }
  );

  const { updateCustomization, deleteCustomization, updateState, deleteState } =
    useCustomizationMutations();

  const handleEdit = () => {
    if (customization) {
      setEditedConfig(JSON.stringify(customization.customConfig, null, 2));
      setEditMode(true);
    }
  };

  const handleSave = async () => {
    if (!customization) return;

    try {
      const parsedConfig = JSON.parse(editedConfig);
      const result = await updateCustomization(customization.id, {
        customConfig: parsedConfig,
      });
      if (result) {
        setEditMode(false);
        refetch();
      }
    } catch (err) {
      alert('Invalid JSON configuration');
    }
  };

  const handleDelete = async () => {
    if (!customization) return;

    if (
      !confirm(
        `Are you sure you want to delete this customization? This will revert "${customization.resourceKey}" to the platform default.`
      )
    ) {
      return;
    }

    const success = await deleteCustomization(customization.id);
    if (success) {
      navigate('/studio/customizations');
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div
          className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <Loader2
            className="h-8 w-8 mx-auto mb-3 animate-spin"
            style={{ color: 'var(--hw-text-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            Loading customization...
          </p>
        </div>
      </div>
    );
  }

  if (error || !customization) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div
          className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <XCircle
            className="h-8 w-8 mx-auto mb-3"
            style={{ color: 'var(--hw-danger)' }}
          />
          <p className="text-sm" style={{ color: 'var(--hw-text)' }}>
            {error || 'Customization not found'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/studio/customizations')}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customizations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/studio/customizations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                {customization.resourceKey}
              </h1>
              <Badge
                variant={
                  customization.customizationType === 'override'
                    ? 'warning'
                    : customization.customizationType === 'extend'
                    ? 'info'
                    : 'success'
                }
              >
                {customizationTypeLabels[customization.customizationType]}
              </Badge>
              {customization.isActive ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="neutral">Inactive</Badge>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
              {configTypeLabels[customization.configType]} customization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVersionHistory(!showVersionHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            Version History
          </Button>
          {editMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={updateState.loading}
              >
                {updateState.loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={deleteState.loading}
              >
                {deleteState.loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Revert
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Diff Viewer */}
          {!editMode && comparison && (
            <DiffViewer
              oldValue={comparison.platformConfig?.configData}
              newValue={customization.customConfig}
              diff={comparison.diff}
              oldLabel="Platform Config"
              newLabel="Your Customization"
              title="Changes from Platform Default"
              showModeToggle
            />
          )}

          {/* Edit Mode */}
          {editMode && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
            >
              <div
                className="px-4 py-3 border-b flex items-center justify-between"
                style={{
                  borderColor: 'var(--hw-border)',
                  backgroundColor: 'var(--hw-bg-subtle)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                    Edit Configuration (JSON)
                  </span>
                </div>
              </div>
              <textarea
                value={editedConfig}
                onChange={(e) => setEditedConfig(e.target.value)}
                className="w-full p-4 font-mono text-sm focus:outline-none"
                style={{
                  backgroundColor: 'var(--hw-code-bg)',
                  color: 'var(--hw-text)',
                  minHeight: '400px',
                }}
                spellCheck={false}
              />
            </div>
          )}

          {/* Raw Configuration */}
          {!editMode && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
            >
              <div
                className="px-4 py-3 border-b flex items-center justify-between"
                style={{
                  borderColor: 'var(--hw-border)',
                  backgroundColor: 'var(--hw-bg-subtle)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                    Raw Configuration
                  </span>
                </div>
              </div>
              <pre
                className="p-4 text-xs font-mono overflow-auto"
                style={{
                  backgroundColor: 'var(--hw-code-bg)',
                  color: 'var(--hw-text-secondary)',
                  maxHeight: '400px',
                }}
              >
                {JSON.stringify(customization.customConfig, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details Card */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg-subtle)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                Details
              </span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Type
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4" style={{ color: 'var(--hw-text-secondary)' }} />
                  <span style={{ color: 'var(--hw-text)' }}>
                    {customizationTypeLabels[customization.customizationType]}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                  {customizationTypeDescriptions[customization.customizationType]}
                </p>
              </div>

              <div>
                <div
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Config Type
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4" style={{ color: 'var(--hw-text-secondary)' }} />
                  <span style={{ color: 'var(--hw-text)' }}>
                    {configTypeLabels[customization.configType]}
                  </span>
                </div>
              </div>

              {customization.basePlatformVersion && (
                <div>
                  <div
                    className="text-xs uppercase tracking-wider mb-1"
                    style={{ color: 'var(--hw-text-muted)' }}
                  >
                    Base Platform Version
                  </div>
                  <span style={{ color: 'var(--hw-text)' }}>
                    {customization.basePlatformVersion}
                  </span>
                </div>
              )}

              <div>
                <div
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Version
                </div>
                <span style={{ color: 'var(--hw-text)' }}>v{customization.version}</span>
              </div>

              <div>
                <div
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Created
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: 'var(--hw-text-secondary)' }} />
                  <span style={{ color: 'var(--hw-text)' }}>
                    {new Date(customization.createdAt).toLocaleString()}
                  </span>
                </div>
                {customization.createdBy && (
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4" style={{ color: 'var(--hw-text-secondary)' }} />
                    <span className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                      {customization.createdBy}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <div
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Last Updated
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: 'var(--hw-text-secondary)' }} />
                  <span style={{ color: 'var(--hw-text)' }}>
                    {new Date(customization.updatedAt).toLocaleString()}
                  </span>
                </div>
                {customization.updatedBy && (
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4" style={{ color: 'var(--hw-text-secondary)' }} />
                    <span className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                      {customization.updatedBy}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Version History */}
          {showVersionHistory && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
            >
              <div
                className="px-4 py-3 border-b"
                style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg-subtle)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                  Version History
                </span>
              </div>
              <div className="max-h-80 overflow-auto">
                {versionsLoading ? (
                  <div className="p-4 text-center">
                    <Loader2
                      className="h-5 w-5 mx-auto animate-spin"
                      style={{ color: 'var(--hw-text-muted)' }}
                    />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="p-4 text-center text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                    No version history available
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--hw-border)' }}>
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className={`p-3 ${
                          version.id === customization.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="text-sm font-medium"
                            style={{ color: 'var(--hw-text)' }}
                          >
                            v{version.version}
                            {version.id === customization.id && (
                              <span
                                className="ml-2 text-xs"
                                style={{ color: 'var(--hw-primary)' }}
                              >
                                (current)
                              </span>
                            )}
                          </span>
                          {version.isActive ? (
                            <Badge variant="success" size="sm">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div
                          className="text-xs mt-1"
                          style={{ color: 'var(--hw-text-muted)' }}
                        >
                          {new Date(version.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomizationDetailPage;
