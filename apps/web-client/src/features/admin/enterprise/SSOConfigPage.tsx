import React, { useState, useEffect, useCallback } from 'react';
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
  Loader2,
  X,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import identityApi from '../../../services/identityApi';

type SSOProtocol = 'saml' | 'oidc';

interface SSOConfig {
  id: string;
  name: string;
  provider: SSOProtocol;
  enabled: boolean;

  // SAML fields
  entityId?: string;
  ssoUrl?: string;
  sloUrl?: string;
  certificate?: string;

  // OIDC fields
  clientId?: string;
  hasClientSecret?: boolean;
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  jwksUrl?: string;
  scopes?: string;

  // JIT provisioning
  jitEnabled?: boolean;
  jitDefaultRoles?: string[];
  jitGroupMapping?: Record<string, string>;
  jitUpdateProfile?: boolean;

  // Attribute mapping
  attributeMapping?: Record<string, string>;

  // UI
  buttonText?: string;
  buttonIconUrl?: string;
  displayOrder?: number;

  // Domains
  allowedDomains?: string[];
  logoutRedirectUrl?: string;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

interface SSOProvider {
  type: string;
  name: string;
  description: string;
  icon: string;
  presets?: Array<{ name: string; label: string }>;
}

interface TestResult {
  success: boolean;
  provider: string;
  message: string;
  errors?: string[];
}

const protocolLabels: Record<SSOProtocol, string> = {
  saml: 'SAML 2.0',
  oidc: 'OpenID Connect',
};

const protocolColors: Record<SSOProtocol, string> = {
  saml: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  oidc: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

export const SSOConfigPage: React.FC = () => {
  const [configs, setConfigs] = useState<SSOConfig[]>([]);
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SSOConfig | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await identityApi.get<{ data: SSOConfig[]; total: number }>('/admin/auth/sso');
      setConfigs(response.data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SSO configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      const response = await identityApi.get<{ data: SSOProvider[] }>('/admin/auth/sso/providers');
      setProviders(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchProviders();
  }, [fetchConfigs, fetchProviders]);

  const handleToggleEnabled = async (config: SSOConfig) => {
    try {
      setActionLoading(config.id);
      const endpoint = config.enabled
        ? `/admin/auth/sso/${config.id}/disable`
        : `/admin/auth/sso/${config.id}/enable`;
      await identityApi.post(endpoint);
      setConfigs((prev) =>
        prev.map((c) => (c.id === config.id ? { ...c, enabled: !c.enabled } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle configuration');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SSO configuration?')) {
      return;
    }
    try {
      setActionLoading(id);
      await identityApi.delete(`/admin/auth/sso/${id}`);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete configuration');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestConnection = async (config: SSOConfig) => {
    try {
      setTestingId(config.id);
      setTestResult(null);
      const response = await identityApi.post<{ data: TestResult }>(`/admin/auth/sso/${config.id}/test`);
      setTestResult(response.data.data);
    } catch (err) {
      setTestResult({
        success: false,
        provider: config.provider,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const spMetadataUrl = `${window.location.origin}/api/auth/saml/metadata`;
  const acsUrl = `${window.location.origin}/api/auth/saml/acs`;
  const oidcCallbackUrl = `${window.location.origin}/api/auth/oidc/callback`;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--bg-primary, #6366f1)' }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
            Single Sign-On (SSO)
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted, #52525b)' }}>
            Configure enterprise identity providers for secure authentication
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfigs}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--text-secondary, #a1a1aa)', border: '1px solid var(--border-default, #2a2a3c)' }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
            style={{ backgroundColor: 'var(--bg-primary, #6366f1)' }}
          >
            <Plus className="h-4 w-4" />
            Add Provider
          </button>
        </div>
      </div>

      {/* Error Banner */}
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

      {/* Test Result Banner */}
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
            {testResult.errors && testResult.errors.length > 0 && (
              <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                {testResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => setTestResult(null)}
            className={testResult.success ? 'text-green-600' : 'text-red-600'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Service Provider Info */}
      <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', border: '1px solid var(--border-default, #2a2a3c)' }}>
        <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary, #fafafa)' }}>
          <FileText className="h-5 w-5" style={{ color: 'var(--bg-primary, #6366f1)' }} />
          Service Provider Configuration
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted, #52525b)' }}>
          Use these URLs when configuring your identity provider to connect with this application.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted, #52525b)' }}>
                SAML Metadata URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code
                  className="flex-1 text-sm px-3 py-2 rounded truncate font-mono"
                  style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)', color: 'var(--text-primary, #fafafa)' }}
                >
                  {spMetadataUrl}
                </code>
                <button
                  onClick={() => handleCopy(spMetadataUrl, 'metadata')}
                  className="p-2 rounded hover:opacity-80"
                  style={{ color: 'var(--bg-primary, #6366f1)' }}
                >
                  {copiedField === 'metadata' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted, #52525b)' }}>
                SAML ACS URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code
                  className="flex-1 text-sm px-3 py-2 rounded truncate font-mono"
                  style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)', color: 'var(--text-primary, #fafafa)' }}
                >
                  {acsUrl}
                </code>
                <button
                  onClick={() => handleCopy(acsUrl, 'acs')}
                  className="p-2 rounded hover:opacity-80"
                  style={{ color: 'var(--bg-primary, #6366f1)' }}
                >
                  {copiedField === 'acs' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted, #52525b)' }}>
                OIDC Callback URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code
                  className="flex-1 text-sm px-3 py-2 rounded truncate font-mono"
                  style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)', color: 'var(--text-primary, #fafafa)' }}
                >
                  {oidcCallbackUrl}
                </code>
                <button
                  onClick={() => handleCopy(oidcCallbackUrl, 'oidc')}
                  className="p-2 rounded hover:opacity-80"
                  style={{ color: 'var(--bg-primary, #6366f1)' }}
                >
                  {copiedField === 'oidc' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
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
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--bg-surface-secondary, #1c1c26)' }}
                >
                  <Shield className="h-6 w-6" style={{ color: 'var(--text-secondary, #a1a1aa)' }} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
                      {config.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${protocolColors[config.provider]}`}
                    >
                      {protocolLabels[config.provider]}
                    </span>
                    {config.enabled ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--text-muted, #52525b)' }} />
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-sm mt-1 space-y-1" style={{ color: 'var(--text-muted, #52525b)' }}>
                    {config.provider === 'saml' && config.entityId && (
                      <p>Entity ID: {config.entityId}</p>
                    )}
                    {config.provider === 'oidc' && config.clientId && (
                      <p>Client ID: {config.clientId}</p>
                    )}
                    {config.allowedDomains && config.allowedDomains.length > 0 && (
                      <p>Domains: {config.allowedDomains.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: 'var(--text-muted, #52525b)' }}>
                    {config.jitEnabled && (
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        JIT Provisioning
                      </span>
                    )}
                    {config.createdAt && (
                      <span>
                        Created: {new Date(config.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleEnabled(config)}
                  disabled={actionLoading === config.id}
                  className={`p-2 rounded-lg transition-colors ${config.enabled ? 'text-green-600' : ''}`}
                  style={!config.enabled ? { color: 'var(--text-muted, #52525b)' } : undefined}
                  title={config.enabled ? 'Disable' : 'Enable'}
                >
                  {actionLoading === config.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : config.enabled ? (
                    <ToggleRight className="h-5 w-5" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => setSelectedConfig(config)}
                  className="p-2 rounded-lg hover:opacity-80"
                  style={{ color: 'var(--text-muted, #52525b)' }}
                  title="Configure"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setSelectedConfig(config)}
                  className="p-2 rounded-lg hover:opacity-80"
                  style={{ color: 'var(--text-muted, #52525b)' }}
                  title="Edit"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  disabled={actionLoading === config.id}
                  className="p-2 text-red-500 rounded-lg hover:opacity-80"
                  title="Delete"
                >
                  {actionLoading === config.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Trash2 className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-default, #2a2a3c)' }}>
              <button
                onClick={() => handleTestConnection(config)}
                disabled={testingId === config.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 hover:opacity-80"
                style={{ color: 'var(--bg-primary, #6366f1)' }}
              >
                {testingId === config.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                Test Connection
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:opacity-80"
                style={{ color: 'var(--bg-primary, #6366f1)' }}
              >
                <ExternalLink className="h-4 w-4" />
                View Docs
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {configs.length === 0 && !loading && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}
        >
          <Shield className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted, #52525b)' }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary, #fafafa)' }}>
            No SSO Providers Configured
          </h3>
          <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--text-muted, #52525b)' }}>
            Configure enterprise identity providers to enable single sign-on for
            your organization.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
            style={{ backgroundColor: 'var(--bg-primary, #6366f1)' }}
          >
            <Plus className="h-4 w-4" />
            Add First Provider
          </button>
        </div>
      )}

      {/* Warning Banner */}
      {configs.some((c) => !c.enabled) && configs.length > 0 && (
        <div
          className="mt-6 rounded-xl p-4 flex items-start gap-3"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-600">
              Disabled Providers
            </p>
            <p className="text-sm text-amber-600 mt-1 opacity-80">
              Some identity providers are currently disabled. Users from these
              domains will not be able to sign in using SSO.
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || selectedConfig) && (
        <SSOConfigModal
          config={selectedConfig}
          providers={providers}
          onClose={() => {
            setShowAddModal(false);
            setSelectedConfig(null);
          }}
          onSave={async (data) => {
            try {
              if (selectedConfig) {
                await identityApi.put(`/admin/auth/sso/${selectedConfig.id}`, data);
              } else {
                await identityApi.post('/admin/auth/sso', data);
              }
              fetchConfigs();
              setShowAddModal(false);
              setSelectedConfig(null);
            } catch (err) {
              throw err;
            }
          }}
        />
      )}
    </div>
  );
};

// Modal Component for Add/Edit SSO Config
interface SSOConfigModalProps {
  config: SSOConfig | null;
  providers: SSOProvider[];
  onClose: () => void;
  onSave: (data: Partial<SSOConfig>) => Promise<void>;
}

const SSOConfigModal: React.FC<SSOConfigModalProps> = ({
  config,
  // providers, // Unused
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<SSOConfig>>({
    name: config?.name || '',
    provider: config?.provider || 'saml',
    enabled: config?.enabled ?? false,

    // SAML
    entityId: config?.entityId || '',
    ssoUrl: config?.ssoUrl || '',
    sloUrl: config?.sloUrl || '',
    certificate: config?.certificate === '*** Certificate Configured ***' ? '' : config?.certificate || '',

    // OIDC
    clientId: config?.clientId || '',
    authorizationUrl: config?.authorizationUrl || '',
    tokenUrl: config?.tokenUrl || '',
    userinfoUrl: config?.userinfoUrl || '',
    jwksUrl: config?.jwksUrl || '',
    scopes: config?.scopes || 'openid profile email',

    // JIT
    jitEnabled: config?.jitEnabled ?? false,
    jitDefaultRoles: config?.jitDefaultRoles || [],
    jitUpdateProfile: config?.jitUpdateProfile ?? true,

    // Domains
    allowedDomains: config?.allowedDomains || [],
    logoutRedirectUrl: config?.logoutRedirectUrl || '',

    // UI
    buttonText: config?.buttonText || '',
  });
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainsInput, setDomainsInput] = useState((config?.allowedDomains || []).join(', '));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const data = {
        ...formData,
        allowedDomains: domainsInput.split(',').map((d) => d.trim()).filter(Boolean),
        ...(clientSecret ? { clientSecret } : {}),
      };

      await onSave(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'var(--bg-overlay, rgba(0, 0, 0, 0.75))' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface, #16161d)',
          border: '1px solid var(--border-default, #2a2a3c)',
          boxShadow: 'var(--shadow-2xl)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-default, #2a2a3c)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
            {config ? 'Edit SSO Provider' : 'Add SSO Provider'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:opacity-80"
            style={{ color: 'var(--text-muted, #52525b)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 rounded-lg p-3 text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)' }}>
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  placeholder="Corporate SSO"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Provider Type *
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value as SSOProtocol })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                  disabled={!!config}
                >
                  <option value="saml">SAML 2.0</option>
                  <option value="oidc">OpenID Connect</option>
                </select>
              </div>
            </div>

            {/* SAML Fields */}
            {formData.provider === 'saml' && (
              <div className="space-y-4">
                <h3 className="font-medium" style={{ color: 'var(--text-primary, #fafafa)' }}>SAML Configuration</h3>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                    Entity ID (Issuer)
                  </label>
                  <input
                    type="text"
                    value={formData.entityId}
                    onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                    placeholder="https://idp.example.com/saml"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                    SSO URL *
                  </label>
                  <input
                    type="url"
                    value={formData.ssoUrl}
                    onChange={(e) => setFormData({ ...formData, ssoUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                    placeholder="https://idp.example.com/saml/sso"
                    required={formData.provider === 'saml'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                    SLO URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.sloUrl}
                    onChange={(e) => setFormData({ ...formData, sloUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                    placeholder="https://idp.example.com/saml/slo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                    IdP Certificate (X.509)
                  </label>
                  <textarea
                    value={formData.certificate}
                    onChange={(e) => setFormData({ ...formData, certificate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg font-mono text-xs"
                    style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                    rows={4}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  />
                  {config?.certificate === '*** Certificate Configured ***' && !formData.certificate && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>Certificate is configured. Leave empty to keep existing.</p>
                  )}
                </div>
              </div>
            )}

            {/* OIDC Fields */}
            {formData.provider === 'oidc' && (
              <div className="space-y-4">
                <h3 className="font-medium" style={{ color: 'var(--text-primary, #fafafa)' }}>OIDC Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                      Client ID *
                    </label>
                    <input
                      type="text"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                      required={formData.provider === 'oidc'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                      Client Secret {config?.hasClientSecret ? '(configured)' : ''}
                    </label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                      placeholder={config?.hasClientSecret ? '••••••••' : 'Enter client secret'}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                    Authorization URL *
                  </label>
                  <input
                    type="url"
                    value={formData.authorizationUrl}
                    onChange={(e) => setFormData({ ...formData, authorizationUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                    placeholder="https://login.example.com/oauth2/authorize"
                    required={formData.provider === 'oidc'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                      Token URL
                    </label>
                    <input
                      type="url"
                      value={formData.tokenUrl}
                      onChange={(e) => setFormData({ ...formData, tokenUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                      placeholder="https://login.example.com/oauth2/token"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                      UserInfo URL
                    </label>
                    <input
                      type="url"
                      value={formData.userinfoUrl}
                      onChange={(e) => setFormData({ ...formData, userinfoUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                      placeholder="https://login.example.com/oauth2/userinfo"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                    Scopes
                  </label>
                  <input
                    type="text"
                    value={formData.scopes}
                    onChange={(e) => setFormData({ ...formData, scopes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                    placeholder="openid profile email"
                  />
                </div>
              </div>
            )}

            {/* JIT Provisioning */}
            <div className="space-y-4">
              <h3 className="font-medium" style={{ color: 'var(--text-primary, #fafafa)' }}>Just-In-Time (JIT) Provisioning</h3>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="jitEnabled"
                  checked={formData.jitEnabled}
                  onChange={(e) => setFormData({ ...formData, jitEnabled: e.target.checked })}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--bg-primary, #6366f1)' }}
                />
                <label htmlFor="jitEnabled" className="text-sm" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                  Automatically create user accounts on first login
                </label>
              </div>
              {formData.jitEnabled && (
                <div className="flex items-center gap-3 ml-7">
                  <input
                    type="checkbox"
                    id="jitUpdateProfile"
                    checked={formData.jitUpdateProfile}
                    onChange={(e) => setFormData({ ...formData, jitUpdateProfile: e.target.checked })}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--bg-primary, #6366f1)' }}
                  />
                  <label htmlFor="jitUpdateProfile" className="text-sm" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                    Update user profile on each login
                  </label>
                </div>
              )}
            </div>

            {/* Allowed Domains */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                Allowed Domains (comma-separated)
              </label>
              <input
                type="text"
                value={domainsInput}
                onChange={(e) => setDomainsInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg"
                style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                placeholder="example.com, company.org"
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>
                Only users with email addresses from these domains can use this SSO provider
              </p>
            </div>

            {/* Button Customization */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                Login Button Text
              </label>
              <input
                type="text"
                value={formData.buttonText}
                onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                className="w-full px-3 py-2 rounded-lg"
                style={{ border: '1px solid var(--border-default, #2a2a3c)', backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-primary, #fafafa)' }}
                placeholder="Sign in with Corporate SSO"
              />
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--bg-primary, #6366f1)' }}
              />
              <label htmlFor="enabled" className="text-sm" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                Enable this SSO provider
              </label>
            </div>
          </div>
        </form>

        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border-default, #2a2a3c)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg hover:opacity-80"
            style={{ color: 'var(--text-secondary, #a1a1aa)', border: '1px solid var(--border-default, #2a2a3c)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--bg-primary, #6366f1)' }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {config ? 'Update' : 'Create'} Provider
          </button>
        </div>
      </div>
    </div>
  );
};
