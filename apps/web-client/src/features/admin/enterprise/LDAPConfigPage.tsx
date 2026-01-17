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
        const configData = {
          ...DEFAULT_CONFIG,
          ...response.data,
          bindPassword: '',
        };
        setConfig(configData);
        setOriginalConfig(configData);
      } else {
        setConfig(DEFAULT_CONFIG);
        setOriginalConfig(null);
      }
    } catch (err) {
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

      const saveData = { ...config };
      if (!saveData.bindPassword) {
        delete saveData.bindPassword;
      }

      await identityApi.post('/admin/auth/ldap', saveData);
      setSuccess('LDAP configuration saved successfully');
      setHasChanges(false);
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

      const testData = { ...config };
      if (!testData.bindPassword && originalConfig) {
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            LDAP / Active Directory
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            Configure LDAP or Active Directory integration for user authentication
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfig}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:opacity-80 text-muted-foreground border border-border"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-primary"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl p-4 flex items-start gap-3 bg-danger-subtle">
          <XCircle className="h-5 w-5 text-danger-text flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-danger-text">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-danger-text hover:text-danger-text">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-xl p-4 flex items-start gap-3 bg-success-subtle">
          <CheckCircle className="h-5 w-5 text-success-text flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-success-text">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-success-text hover:text-success-text">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {testResult && (
        <div
          className={`mb-6 rounded-xl p-4 flex items-start gap-3 ${testResult.success ? 'bg-success-subtle' : 'bg-danger-subtle'}`}
        >
          {testResult.success ? (
            <CheckCircle className="h-5 w-5 text-success-text flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-danger-text flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`font-medium ${testResult.success ? 'text-success-text' : 'text-danger-text'}`}>
              {testResult.message}
            </p>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className={testResult.success ? 'text-success-text' : 'text-danger-text'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-xl bg-card border border-border">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-warning-subtle">
                <Server className="h-6 w-6 text-warning-text" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {config.name || 'LDAP Configuration'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {config.enabled ? 'Active - Users can authenticate via LDAP' : 'Disabled - LDAP authentication is off'}
                </p>
              </div>
            </div>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`p-2 rounded-lg transition-colors ${config.enabled ? 'text-success-text' : 'text-muted-foreground'}`}
            >
              {config.enabled ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8" />
              )}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="flex items-center gap-2 font-medium mb-4 text-foreground">
              <Shield className="h-5 w-5 text-primary" />
              Connection Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Configuration Name
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => updateConfig({ name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  placeholder="Corporate LDAP"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Server URL *
                </label>
                <input
                  type="text"
                  value={config.host}
                  onChange={(e) => updateConfig({ host: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  placeholder="ldap://ldap.example.com:389 or ldaps://ldap.example.com:636"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use ldaps:// for secure connections (recommended)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Bind DN *
                </label>
                <input
                  type="text"
                  value={config.bindDn}
                  onChange={(e) => updateConfig({ bindDn: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  placeholder="cn=admin,dc=example,dc=com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Bind Password {originalConfig?.id && '(leave empty to keep existing)'}
                </label>
                <input
                  type="password"
                  value={config.bindPassword}
                  onChange={(e) => updateConfig({ bindPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  placeholder={originalConfig?.id ? '••••••••' : 'Enter bind password'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Connection Timeout (ms)
                </label>
                <input
                  type="number"
                  value={config.timeoutMs}
                  onChange={(e) => updateConfig({ timeoutMs: parseInt(e.target.value) || 5000 })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  min={1000}
                  max={60000}
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="flex items-center gap-2 font-medium mb-4 text-foreground">
              <Users className="h-5 w-5 text-primary" />
              User Search Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  User Base DN *
                </label>
                <input
                  type="text"
                  value={config.userBaseDn}
                  onChange={(e) => updateConfig({ userBaseDn: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  placeholder="ou=users,dc=example,dc=com"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The base DN to search for users
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  User Filter
                </label>
                <input
                  type="text"
                  value={config.userFilter}
                  onChange={(e) => updateConfig({ userFilter: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm border border-border bg-muted text-foreground"
                  placeholder="(uid={username})"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use {'{username}'} as placeholder for the login username. For AD use: (sAMAccountName={'{username}'})
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="flex items-center gap-2 font-medium mb-4 text-foreground">
              <Settings className="h-5 w-5 text-primary" />
              Attribute Mapping
            </h4>
            <div className="rounded-lg p-4 mb-4 bg-muted border border-border">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <p>
                  Map LDAP attributes to user profile fields. Common LDAP attributes include uid, mail, cn, sn, givenName.
                  For Active Directory use sAMAccountName, mail, displayName.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Username Attribute
                </label>
                <input
                  type="text"
                  value={config.mapUsernameAttr}
                  onChange={(e) => updateConfig({ mapUsernameAttr: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  placeholder="uid"
                />
                <p className="mt-1 text-xs text-muted-foreground">AD: sAMAccountName</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Email Attribute
                </label>
                <input
                  type="text"
                  value={config.mapEmailAttr}
                  onChange={(e) => updateConfig({ mapEmailAttr: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  placeholder="mail"
                />
                <p className="mt-1 text-xs text-muted-foreground">AD: mail</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Display Name Attribute
                </label>
                <input
                  type="text"
                  value={config.mapDisplayNameAttr}
                  onChange={(e) => updateConfig({ mapDisplayNameAttr: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  placeholder="cn"
                />
                <p className="mt-1 text-xs text-muted-foreground">AD: displayName</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between border-t border-border">
          <button
            onClick={handleTestConnection}
            disabled={testing || !config.host}
            className="flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-80 text-primary"
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
              <span className="text-sm text-warning-text">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-primary"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl p-6 bg-muted border border-border">
        <h4 className="font-medium mb-4 text-foreground">
          Quick Setup Guide
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
          <div>
            <h5 className="font-medium mb-2 text-foreground">OpenLDAP Example</h5>
            <ul className="space-y-1 list-disc list-inside">
              <li>Server: ldap://ldap.example.com:389</li>
              <li>Bind DN: cn=admin,dc=example,dc=com</li>
              <li>User Base DN: ou=users,dc=example,dc=com</li>
              <li>User Filter: (uid={'{username}'})</li>
              <li>Username Attr: uid</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium mb-2 text-foreground">Active Directory Example</h5>
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
