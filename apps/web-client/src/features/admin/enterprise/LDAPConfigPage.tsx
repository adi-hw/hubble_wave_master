import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Shield,
  Loader2,
  X,
  RefreshCw,
  CheckCircle,
  XCircle,
  Key,
  Users,
  Settings,
  Save,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';
import identityApi from '../../../services/identityApi';

interface LDAPConfig {
  id?: string;
  name: string;
  enabled: boolean;
  host: string;
  bindDn: string;
  bindPassword?: string;
  userBaseDn: string;
  userFilter: string;
  mapUsernameAttr: string;
  mapEmailAttr: string;
  mapDisplayNameAttr: string;
  timeoutMs: number;
  createdAt?: string;
  updatedAt?: string;
}

interface TestResult {
  success: boolean;
  message: string;
}

const DEFAULT_CONFIG: LDAPConfig = {
  name: 'Corporate LDAP',
  enabled: false,
  host: '',
  bindDn: '',
  bindPassword: '',
  userBaseDn: '',
  userFilter: '(uid={username})',
  mapUsernameAttr: 'uid',
  mapEmailAttr: 'mail',
  mapDisplayNameAttr: 'cn',
  timeoutMs: 5000,
};

export const LDAPConfigPage: React.FC = () => {
  const [config, setConfig] = useState<LDAPConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<LDAPConfig | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await identityApi.get<LDAPConfig | null>('/admin/auth/ldap');
      if (response.data) {
        // Don't include password in display - it will be null from server
        const configData = {
          ...DEFAULT_CONFIG,
          ...response.data,
          bindPassword: '', // Password not returned from server
        };
        setConfig(configData);
        setOriginalConfig(configData);
      } else {
        setConfig(DEFAULT_CONFIG);
        setOriginalConfig(null);
      }
    } catch (err) {
      // If 404 or no config, use defaults
      setConfig(DEFAULT_CONFIG);
      setOriginalConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (originalConfig) {
      const changed =
        config.name !== originalConfig.name ||
        config.enabled !== originalConfig.enabled ||
        config.host !== originalConfig.host ||
        config.bindDn !== originalConfig.bindDn ||
        config.bindPassword !== '' ||
        config.userBaseDn !== originalConfig.userBaseDn ||
        config.userFilter !== originalConfig.userFilter ||
        config.mapUsernameAttr !== originalConfig.mapUsernameAttr ||
        config.mapEmailAttr !== originalConfig.mapEmailAttr ||
        config.mapDisplayNameAttr !== originalConfig.mapDisplayNameAttr ||
        config.timeoutMs !== originalConfig.timeoutMs;
      setHasChanges(changed);
    } else {
      setHasChanges(config.host !== '' || config.bindDn !== '' || config.userBaseDn !== '');
    }
  }, [config, originalConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Only include password if it's been changed
      const saveData = { ...config };
      if (!saveData.bindPassword) {
        delete saveData.bindPassword;
      }

      await identityApi.post('/admin/auth/ldap', saveData);
      setSuccess('LDAP configuration saved successfully');
      setHasChanges(false);
      // Refresh to get the saved config
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setError(null);

      // Test with current form data (including password if provided)
      const testData = { ...config };
      if (!testData.bindPassword && originalConfig) {
        // If no new password provided, server will use stored one
      }

      const response = await identityApi.post<TestResult>('/admin/auth/ldap/test', testData);
      setTestResult(response.data);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const updateConfig = (updates: Partial<LDAPConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--bg-primary, #6366f1)' }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
            LDAP / Active Directory
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted, #52525b)' }}>
            Configure LDAP or Active Directory integration for user authentication
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfig}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--text-secondary, #a1a1aa)', border: '1px solid var(--border-default, #2a2a3c)' }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: 'var(--bg-primary, #6366f1)' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {error && (
        <div className="mb-6 rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-600">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-green-600">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {testResult && (
        <div
          className="mb-6 rounded-xl p-4 flex items-start gap-3"
          style={{ backgroundColor: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
        >
          {testResult.success ? (
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`font-medium ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.message}
            </p>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className={testResult.success ? 'text-green-600' : 'text-red-600'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Configuration Card */}
      <div className="rounded-xl" style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}>
        {/* Enable Toggle */}
        <div className="p-6" style={{ borderBottom: '1px solid var(--border-default, #2a2a3c)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}
              >
                <Server className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
                  {config.name || 'LDAP Configuration'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-muted, #52525b)' }}>
                  {config.enabled ? 'Active - Users can authenticate via LDAP' : 'Disabled - LDAP authentication is off'}
                </p>
              </div>
            </div>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`p-2 rounded-lg transition-colors ${config.enabled ? 'text-green-600' : ''}`}
              style={!config.enabled ? { color: 'var(--text-muted, #52525b)' } : undefined}
            >
              {config.enabled ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8" />
              )}
            </button>
          </div>
        </div>

        {/* Connection Settings */}
        <div className="p-6 space-y-6">
          <div>
            <h4 className="flex items-center gap-2 font-medium mb-4" style={{ color: 'var(--text-primary, #fafafa)' }}>
              <Shield className="h-5 w-5" style={{ color: 'var(--bg-primary, #6366f1)' }} />
              Connection Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Configuration Name
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => updateConfig({ name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder="Corporate LDAP"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Server URL *
                </label>
                <input
                  type="text"
                  value={config.host}
                  onChange={(e) => updateConfig({ host: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder="ldap://ldap.example.com:389 or ldaps://ldap.example.com:636"
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>
                  Use ldaps:// for secure connections (recommended)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Bind DN *
                </label>
                <input
                  type="text"
                  value={config.bindDn}
                  onChange={(e) => updateConfig({ bindDn: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder="cn=admin,dc=example,dc=com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Bind Password {originalConfig?.id && '(leave empty to keep existing)'}
                </label>
                <input
                  type="password"
                  value={config.bindPassword}
                  onChange={(e) => updateConfig({ bindPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder={originalConfig?.id ? '••••••••' : 'Enter bind password'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Connection Timeout (ms)
                </label>
                <input
                  type="number"
                  value={config.timeoutMs}
                  onChange={(e) => updateConfig({ timeoutMs: parseInt(e.target.value) || 5000 })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  min={1000}
                  max={60000}
                />
              </div>
            </div>
          </div>

          {/* User Search Settings */}
          <div>
            <h4 className="flex items-center gap-2 font-medium mb-4" style={{ color: 'var(--text-primary, #fafafa)' }}>
              <Users className="h-5 w-5" style={{ color: 'var(--bg-primary, #6366f1)' }} />
              User Search Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  User Base DN *
                </label>
                <input
                  type="text"
                  value={config.userBaseDn}
                  onChange={(e) => updateConfig({ userBaseDn: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder="ou=users,dc=example,dc=com"
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>
                  The base DN to search for users
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  User Filter
                </label>
                <input
                  type="text"
                  value={config.userFilter}
                  onChange={(e) => updateConfig({ userFilter: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder="(uid={username})"
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>
                  Use {'{username}'} as placeholder for the login username. For AD use: (sAMAccountName={'{username}'})
                </p>
              </div>
            </div>
          </div>

          {/* Attribute Mapping */}
          <div>
            <h4 className="flex items-center gap-2 font-medium mb-4" style={{ color: 'var(--text-primary, #fafafa)' }}>
              <Settings className="h-5 w-5" style={{ color: 'var(--bg-primary, #6366f1)' }} />
              Attribute Mapping
            </h4>
            <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', border: '1px solid var(--border-default, #2a2a3c)' }}>
              <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--bg-primary, #6366f1)' }} />
                <p>
                  Map LDAP attributes to user profile fields. Common LDAP attributes include uid, mail, cn, sn, givenName.
                  For Active Directory use sAMAccountName, mail, displayName.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Username Attribute
                </label>
                <input
                  type="text"
                  value={config.mapUsernameAttr}
                  onChange={(e) => updateConfig({ mapUsernameAttr: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder="uid"
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>AD: sAMAccountName</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Email Attribute
                </label>
                <input
                  type="text"
                  value={config.mapEmailAttr}
                  onChange={(e) => updateConfig({ mapEmailAttr: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder="mail"
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>AD: mail</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Display Name Attribute
                </label>
                <input
                  type="text"
                  value={config.mapDisplayNameAttr}
                  onChange={(e) => updateConfig({ mapDisplayNameAttr: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder="cn"
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>AD: displayName</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-default, #2a2a3c)' }}>
          <button
            onClick={handleTestConnection}
            disabled={testing || !config.host}
            className="flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-80"
            style={{ color: 'var(--bg-primary, #6366f1)' }}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Key className="h-4 w-4" />
            )}
            Test Connection
          </button>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-sm text-amber-600">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: 'var(--bg-primary, #6366f1)' }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-6 rounded-xl p-6" style={{ backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', border: '1px solid var(--border-default, #2a2a3c)' }}>
        <h4 className="font-medium mb-4" style={{ color: 'var(--text-primary, #fafafa)' }}>
          Quick Setup Guide
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
          <div>
            <h5 className="font-medium mb-2" style={{ color: 'var(--text-primary, #fafafa)' }}>OpenLDAP Example</h5>
            <ul className="space-y-1 list-disc list-inside">
              <li>Server: ldap://ldap.example.com:389</li>
              <li>Bind DN: cn=admin,dc=example,dc=com</li>
              <li>User Base DN: ou=users,dc=example,dc=com</li>
              <li>User Filter: (uid={'{username}'})</li>
              <li>Username Attr: uid</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium mb-2" style={{ color: 'var(--text-primary, #fafafa)' }}>Active Directory Example</h5>
            <ul className="space-y-1 list-disc list-inside">
              <li>Server: ldaps://ad.company.com:636</li>
              <li>Bind DN: cn=svc-app,ou=service,dc=company,dc=com</li>
              <li>User Base DN: ou=employees,dc=company,dc=com</li>
              <li>User Filter: (sAMAccountName={'{username}'})</li>
              <li>Username Attr: sAMAccountName</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
