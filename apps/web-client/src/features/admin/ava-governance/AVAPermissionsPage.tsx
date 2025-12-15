import React, { useState, useEffect } from 'react';
import {
  Shield,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Bot,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  RefreshCw,
  Navigation,
  Zap,
} from 'lucide-react';
import aiApi from '../../../services/aiApi';

type AVAActionType = 'create' | 'update' | 'delete' | 'execute' | 'navigate';

interface AVAPermissionConfig {
  id: string;
  collectionCode?: string;
  actionType: AVAActionType;
  isEnabled: boolean;
  requiresConfirmation: boolean;
  allowedRoles: string[];
  excludedRoles: string[];
  maxRecordsPerHour?: number;
  maxRecordsPerDay?: number;
  restrictedFields: string[];
  readOnlyCollections: string[];
  requiresApproval: boolean;
  approverRoles: string[];
  alwaysAudit: boolean;
  notifyAdmin: boolean;
  description?: string;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

interface AVAGlobalSettings {
  id: string;
  avaEnabled: boolean;
  defaultRequiresConfirmation: boolean;
  allowCreateActions: boolean;
  allowUpdateActions: boolean;
  allowDeleteActions: boolean;
  allowExecuteActions: boolean;
  globalRateLimitPerHour: number;
  userRateLimitPerHour: number;
  auditRetentionDays: number;
  auditAllQueries: boolean;
  readOnlyMode: boolean;
  systemReadOnlyCollections: string[];
  adminNotificationEmail?: string;
  notifyOnFailure: boolean;
  notifyOnRevert: boolean;
}

const actionTypeLabels: Record<AVAActionType, string> = {
  navigate: 'Navigate',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  execute: 'Execute',
};

const actionTypeIcons: Record<AVAActionType, React.ElementType> = {
  navigate: Navigation,
  create: Plus,
  update: Edit,
  delete: Trash2,
  execute: Zap,
};

export const AVAPermissionsPage: React.FC = () => {
  const [globalSettings, setGlobalSettings] = useState<AVAGlobalSettings | null>(null);
  const [permissions, setPermissions] = useState<AVAPermissionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPermission, setEditingPermission] = useState<AVAPermissionConfig | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'permissions'>('global');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, permissionsRes] = await Promise.all([
        aiApi.get<{ settings: AVAGlobalSettings }>('/ava/admin/settings'),
        aiApi.get<{ permissions: AVAPermissionConfig[] }>('/ava/admin/permissions'),
      ]);

      setGlobalSettings(settingsRes.data.settings);
      setPermissions(permissionsRes.data.permissions || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGlobalSettings = async () => {
    if (!globalSettings) return;

    setSaving(true);
    try {
      const response = await aiApi.put<{ settings: AVAGlobalSettings }>('/ava/admin/settings', globalSettings);
      setGlobalSettings(response.data.settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermission = async (permission: AVAPermissionConfig) => {
    setSaving(true);
    try {
      const isNew = !permission.id || isCreatingNew;
      if (isNew) {
        await aiApi.post('/ava/admin/permissions', permission);
      } else {
        await aiApi.put(`/ava/admin/permissions/${permission.id}`, permission);
      }
      fetchData();
      setEditingPermission(null);
      setIsCreatingNew(false);
    } catch (error) {
      console.error('Failed to save permission:', error);
      alert('Failed to save permission');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePermission = async (id: string) => {
    if (!confirm('Are you sure you want to delete this permission configuration?')) {
      return;
    }

    try {
      await aiApi.delete(`/ava/admin/permissions/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete permission:', error);
      alert('Failed to delete permission');
    }
  };

  const createNewPermission = (): AVAPermissionConfig => ({
    id: '',
    actionType: 'create',
    isEnabled: true,
    requiresConfirmation: true,
    allowedRoles: [],
    excludedRoles: [],
    restrictedFields: [],
    readOnlyCollections: [],
    requiresApproval: false,
    approverRoles: [],
    alwaysAudit: true,
    notifyAdmin: false,
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              AVA Permissions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Control what AVA can do in your tenant
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('global')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'global'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
          }`}
        >
          <Settings className="h-4 w-4 inline-block mr-2" />
          Global Settings
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'permissions'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
          }`}
        >
          <Shield className="h-4 w-4 inline-block mr-2" />
          Permission Rules
        </button>
      </div>

      {/* Global Settings Tab */}
      {activeTab === 'global' && globalSettings && (
        <div className="space-y-6">
          {/* Master Switch */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Bot className="h-6 w-6 text-indigo-600" />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">AVA Status</h3>
                  <p className="text-sm text-slate-500">Master switch for AVA functionality</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalSettings.avaEnabled}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, avaEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-300">
                  {globalSettings.avaEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            {globalSettings.readOnlyMode && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  AVA is in read-only mode. No modifications will be performed.
                </span>
              </div>
            )}
          </div>

          {/* Action Type Toggles */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-medium text-slate-900 dark:text-white mb-4">Allowed Action Types</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['Create', 'Update', 'Delete', 'Execute'].map((action) => {
                const key = `allow${action}Actions` as keyof AVAGlobalSettings;
                const isEnabled = globalSettings[key] as boolean;
                return (
                  <div
                    key={action}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isEnabled
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-750'
                    }`}
                    onClick={() => setGlobalSettings({ ...globalSettings, [key]: !isEnabled })}
                  >
                    <div className="flex items-center justify-between mb-2">
                      {React.createElement(actionTypeIcons[action.toLowerCase() as AVAActionType], {
                        className: `h-5 w-5 ${isEnabled ? 'text-green-600' : 'text-slate-400'}`,
                      })}
                      {isEnabled ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <p className={`font-medium ${isEnabled ? 'text-green-700 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {action}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rate Limits */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-medium text-slate-900 dark:text-white mb-4">Rate Limits</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Global Rate Limit (per hour)
                </label>
                <input
                  type="number"
                  value={globalSettings.globalRateLimitPerHour}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, globalRateLimitPerHour: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  User Rate Limit (per hour)
                </label>
                <input
                  type="number"
                  value={globalSettings.userRateLimitPerHour}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, userRateLimitPerHour: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Audit & Notifications */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-medium text-slate-900 dark:text-white mb-4">Audit & Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Default Requires Confirmation</p>
                  <p className="text-sm text-slate-500">Require user confirmation before executing actions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={globalSettings.defaultRequiresConfirmation}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, defaultRequiresConfirmation: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Notify on Failure</p>
                  <p className="text-sm text-slate-500">Send notifications when AVA actions fail</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={globalSettings.notifyOnFailure}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, notifyOnFailure: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Notify on Revert</p>
                  <p className="text-sm text-slate-500">Send notifications when actions are reverted</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={globalSettings.notifyOnRevert}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, notifyOnRevert: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Audit Retention (days)
                </label>
                <input
                  type="number"
                  value={globalSettings.auditRetentionDays}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, auditRetentionDays: parseInt(e.target.value) || 90 })}
                  className="w-full max-w-xs px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Read-Only Collections */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">System Read-Only Collections</h3>
            <p className="text-sm text-slate-500 mb-4">Collections that AVA cannot modify</p>
            <div className="flex flex-wrap gap-2">
              {globalSettings.systemReadOnlyCollections.map((collection) => (
                <span
                  key={collection}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-sm flex items-center gap-2"
                >
                  <Lock className="h-3 w-3" />
                  {collection}
                </span>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveGlobalSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Permission Rules Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          {/* Add New Button */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingPermission(createNewPermission());
                setIsCreatingNew(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Permission Rule
            </button>
          </div>

          {/* Permission List */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Action Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Collection</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Confirmation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {permissions.map((permission) => {
                  const Icon = actionTypeIcons[permission.actionType];
                  return (
                    <tr key={permission.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="font-medium text-slate-900 dark:text-white">
                            {actionTypeLabels[permission.actionType]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        {permission.collectionCode || <span className="text-slate-400 italic">Global</span>}
                      </td>
                      <td className="px-6 py-4">
                        {permission.isEnabled ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Unlock className="h-4 w-4" />
                            Enabled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <Lock className="h-4 w-4" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        {permission.requiresConfirmation ? 'Required' : 'Not Required'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {permission.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingPermission(permission);
                              setIsCreatingNew(false);
                            }}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePermission(permission.id)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {permissions.length === 0 && (
              <div className="p-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No Permission Rules
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Add permission rules to control what AVA can do.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Permission Modal */}
      {editingPermission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isCreatingNew ? 'Create Permission Rule' : 'Edit Permission Rule'}
              </h2>
              <button
                onClick={() => { setEditingPermission(null); setIsCreatingNew(false); }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Action Type *
                  </label>
                  <select
                    value={editingPermission.actionType}
                    onChange={(e) => setEditingPermission({ ...editingPermission, actionType: e.target.value as AVAActionType })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  >
                    {Object.entries(actionTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Collection (optional)
                  </label>
                  <input
                    type="text"
                    value={editingPermission.collectionCode || ''}
                    onChange={(e) => setEditingPermission({ ...editingPermission, collectionCode: e.target.value || undefined })}
                    placeholder="Leave empty for global"
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Enabled</p>
                  <p className="text-sm text-slate-500">Allow this action type</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPermission.isEnabled}
                    onChange={(e) => setEditingPermission({ ...editingPermission, isEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Requires Confirmation</p>
                  <p className="text-sm text-slate-500">User must confirm before execution</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPermission.requiresConfirmation}
                    onChange={(e) => setEditingPermission({ ...editingPermission, requiresConfirmation: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Allowed Roles (comma-separated)
                </label>
                <input
                  type="text"
                  value={editingPermission.allowedRoles.join(', ')}
                  onChange={(e) => setEditingPermission({
                    ...editingPermission,
                    allowedRoles: e.target.value.split(',').map(r => r.trim()).filter(Boolean),
                  })}
                  placeholder="Leave empty for all roles"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Excluded Roles (comma-separated)
                </label>
                <input
                  type="text"
                  value={editingPermission.excludedRoles.join(', ')}
                  onChange={(e) => setEditingPermission({
                    ...editingPermission,
                    excludedRoles: e.target.value.split(',').map(r => r.trim()).filter(Boolean),
                  })}
                  placeholder="Roles that cannot use this action"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={editingPermission.description || ''}
                  onChange={(e) => setEditingPermission({ ...editingPermission, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => { setEditingPermission(null); setIsCreatingNew(false); }}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePermission(editingPermission)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
