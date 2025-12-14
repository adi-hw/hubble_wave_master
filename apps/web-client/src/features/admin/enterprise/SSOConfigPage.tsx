import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Settings,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  Edit,
  ToggleLeft,
  ToggleRight,
  Key,
  Users,
  FileText,
} from 'lucide-react';

type SSOProtocol = 'saml' | 'oidc' | 'ldap';

interface SSOConfig {
  id: string;
  name: string;
  protocol: SSOProtocol;
  enabled: boolean;
  domain: string;
  lastSyncAt?: string;
  userCount: number;
  settings: Record<string, unknown>;
}

const mockConfigs: SSOConfig[] = [
  {
    id: '1',
    name: 'Corporate SAML',
    protocol: 'saml',
    enabled: true,
    domain: 'company.com',
    lastSyncAt: '2024-01-15T10:30:00Z',
    userCount: 1250,
    settings: {
      entityId: 'https://idp.company.com/saml',
      ssoUrl: 'https://idp.company.com/saml/sso',
      certificate: '-----BEGIN CERTIFICATE-----\n...',
    },
  },
  {
    id: '2',
    name: 'Azure AD OIDC',
    protocol: 'oidc',
    enabled: true,
    domain: 'contoso.onmicrosoft.com',
    lastSyncAt: '2024-01-15T09:00:00Z',
    userCount: 450,
    settings: {
      issuer: 'https://login.microsoftonline.com/tenant-id',
      clientId: 'app-client-id',
    },
  },
  {
    id: '3',
    name: 'Corporate LDAP',
    protocol: 'ldap',
    enabled: false,
    domain: 'ad.company.local',
    userCount: 0,
    settings: {
      host: 'ldap.company.local',
      port: 389,
      baseDn: 'dc=company,dc=local',
    },
  },
];

const protocolLabels: Record<SSOProtocol, string> = {
  saml: 'SAML 2.0',
  oidc: 'OpenID Connect',
  ldap: 'LDAP/AD',
};

const protocolColors: Record<SSOProtocol, string> = {
  saml: 'bg-purple-100 text-purple-700',
  oidc: 'bg-blue-100 text-blue-700',
  ldap: 'bg-amber-100 text-amber-700',
};

export const SSOConfigPage: React.FC = () => {
  const [configs, setConfigs] = useState(mockConfigs);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [, setShowAddModal] = useState(false);
  const [, setSelectedConfig] = useState<SSOConfig | null>(null);

  const handleToggleEnabled = (id: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const spMetadataUrl = `${window.location.origin}/api/auth/saml/metadata`;
  const acsUrl = `${window.location.origin}/api/auth/saml/acs`;
  const oidcCallbackUrl = `${window.location.origin}/api/auth/oidc/callback`;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Single Sign-On (SSO)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure enterprise identity providers for secure authentication
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Provider
        </button>
      </div>

      {/* Service Provider Info */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 mb-6">
        <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Service Provider Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                SAML Metadata URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded border border-indigo-200 dark:border-indigo-700 truncate">
                  {spMetadataUrl}
                </code>
                <button
                  onClick={() => handleCopy(spMetadataUrl, 'metadata')}
                  className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded"
                >
                  {copiedField === 'metadata' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-indigo-600" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                SAML ACS URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded border border-indigo-200 dark:border-indigo-700 truncate">
                  {acsUrl}
                </code>
                <button
                  onClick={() => handleCopy(acsUrl, 'acs')}
                  className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded"
                >
                  {copiedField === 'acs' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-indigo-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                OIDC Callback URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded border border-indigo-200 dark:border-indigo-700 truncate">
                  {oidcCallbackUrl}
                </code>
                <button
                  onClick={() => handleCopy(oidcCallbackUrl, 'oidc')}
                  className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded"
                >
                  {copiedField === 'oidc' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-indigo-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Providers List */}
      <div className="space-y-4">
        {configs.map((config) => (
          <div
            key={config.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {config.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${protocolColors[config.protocol]}`}
                    >
                      {protocolLabels[config.protocol]}
                    </span>
                    {config.enabled ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <span className="w-2 h-2 bg-slate-400 rounded-full" />
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Domain: {config.domain}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {config.userCount.toLocaleString()} users
                    </span>
                    {config.lastSyncAt && (
                      <span>
                        Last sync:{' '}
                        {new Date(config.lastSyncAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleEnabled(config.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    config.enabled
                      ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title={config.enabled ? 'Disable' : 'Enable'}
                >
                  {config.enabled ? (
                    <ToggleRight className="h-5 w-5" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => setSelectedConfig(config)}
                  className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                  title="Configure"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <button
                  className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                  title="Edit"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg">
                <Key className="h-4 w-4" />
                Test Connection
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg">
                <Users className="h-4 w-4" />
                Sync Users
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg">
                <ExternalLink className="h-4 w-4" />
                View Logs
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {configs.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No SSO Providers Configured
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Configure enterprise identity providers to enable single sign-on for
            your organization.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add First Provider
          </button>
        </div>
      )}

      {/* Warning Banner */}
      {configs.some((c) => !c.enabled) && (
        <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Disabled Providers
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Some identity providers are currently disabled. Users from these
              domains will not be able to sign in using SSO.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
