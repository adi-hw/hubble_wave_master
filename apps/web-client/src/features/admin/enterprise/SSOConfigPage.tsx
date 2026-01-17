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
  oidc: 'bg-info-subtle text-info-text',
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Single Sign-On (SSO)
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            Configure enterprise identity providers for secure authentication
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfigs}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-muted-foreground border border-border hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-4 py-2 rounded-lg"
          >
            <Plus className="h-4 w-4" />
            Add Provider
          </button>
        </div>
      </div>

      {/* Error Banner */}
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

      {/* Test Result Banner */}
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
            {testResult.errors && testResult.errors.length > 0 && (
              <ul className="mt-2 text-sm text-danger-text list-disc list-inside">
                {testResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => setTestResult(null)}
            className={testResult.success ? 'text-success-text' : 'text-danger-text'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Service Provider Info */}
      <div className="rounded-xl p-6 mb-6 bg-muted border border-border">
        <h3 className="font-semibold mb-4 flex items-center gap-2 text-foreground">
          <FileText className="h-5 w-5 text-primary" />
          Service Provider Configuration
        </h3>
        <p className="text-sm mb-4 text-muted-foreground">
          Use these URLs when configuring your identity provider to connect with this application.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                SAML Metadata URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code
                  className="flex-1 text-sm px-3 py-2 rounded truncate font-mono bg-card border border-border text-foreground"
                >
                  {spMetadataUrl}
                </code>
                <button
                  onClick={() => handleCopy(spMetadataUrl, 'metadata')}
                  className="p-2 rounded text-primary hover:bg-muted"
                >
                  {copiedField === 'metadata' ? (
                    <Check className="h-4 w-4 text-success-text" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                SAML ACS URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code
                  className="flex-1 text-sm px-3 py-2 rounded truncate font-mono bg-card border border-border text-foreground"
                >
                  {acsUrl}
                </code>
                <button
                  onClick={() => handleCopy(acsUrl, 'acs')}
                  className="p-2 rounded text-primary hover:bg-muted"
                >
                  {copiedField === 'acs' ? (
                    <Check className="h-4 w-4 text-success-text" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                OIDC Callback URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code
                  className="flex-1 text-sm px-3 py-2 rounded truncate font-mono bg-card border border-border text-foreground"
                >
                  {oidcCallbackUrl}
                </code>
                <button
                  onClick={() => handleCopy(oidcCallbackUrl, 'oidc')}
                  className="p-2 rounded text-primary hover:bg-muted"
                >
                  {copiedField === 'oidc' ? (
                    <Check className="h-4 w-4 text-success-text" />
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
            className="rounded-xl p-6 bg-card border border-border"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center bg-muted"
                >
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">
                      {config.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${protocolColors[config.provider]}`}
                    >
                      {protocolLabels[config.provider]}
                    </span>
                    {config.enabled ? (
                      <span className="flex items-center gap-1 text-xs text-success-text">
                        <span className="w-2 h-2 bg-success rounded-full" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-sm mt-1 space-y-1 text-muted-foreground">
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
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
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
                  className={`p-2 rounded-lg transition-colors ${config.enabled ? 'text-success-text' : 'text-muted-foreground'} hover:bg-muted`}
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
                  className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
                  title="Configure"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setSelectedConfig(config)}
                  className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
                  title="Edit"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  disabled={actionLoading === config.id}
                  className="p-2 text-danger-text rounded-lg hover:bg-muted"
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
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <button
                onClick={() => handleTestConnection(config)}
                disabled={testingId === config.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 text-primary hover:bg-muted"
              >
                {testingId === config.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                Test Connection
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-primary hover:bg-muted"
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
          className="rounded-xl p-12 text-center bg-card border border-border"
        >
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2 text-foreground">
            No SSO Providers Configured
          </h3>
          <p className="mb-6 max-w-md mx-auto text-muted-foreground">
            Configure enterprise identity providers to enable single sign-on for
            your organization.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-primary-foreground rounded-lg bg-primary hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add First Provider
          </button>
        </div>
      )}

      {/* Warning Banner */}
      {configs.some((c) => !c.enabled) && configs.length > 0 && (
        <div
          className="mt-6 rounded-xl p-4 flex items-start gap-3 bg-warning-subtle border border-warning-border"
        >
          <AlertTriangle className="h-5 w-5 text-warning-text flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-warning-text">
              Disabled Providers
            </p>
            <p className="text-sm text-warning-text mt-1 opacity-80">
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

interface SSOConfigModalProps {
  config: SSOConfig | null;
  providers: SSOProvider[];
  onClose: () => void;
  onSave: (data: Partial<SSOConfig>) => Promise<void>;
}

const SSOConfigModal: React.FC<SSOConfigModalProps> = ({
  config,
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
        className="absolute inset-0 bg-overlay/75"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden bg-card border border-border"
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-border"
        >
          <h2 className="text-lg font-semibold text-foreground">
            {config ? 'Edit SSO Provider' : 'Add SSO Provider'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 rounded-lg p-3 text-sm bg-danger-subtle text-danger-text">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                  placeholder="Corporate SSO"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Provider Type *
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value as SSOProtocol })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
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
                <h3 className="font-medium text-foreground">SAML Configuration</h3>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">
                    Entity ID (Issuer)
                  </label>
                  <input
                    type="text"
                    value={formData.entityId}
                    onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                    placeholder="https://idp.example.com/saml"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">
                    SSO URL *
                  </label>
                  <input
                    type="url"
                    value={formData.ssoUrl}
                    onChange={(e) => setFormData({ ...formData, ssoUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                    placeholder="https://idp.example.com/saml/sso"
                    required={formData.provider === 'saml'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">
                    SLO URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.sloUrl}
                    onChange={(e) => setFormData({ ...formData, sloUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                    placeholder="https://idp.example.com/saml/slo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">
                    IdP Certificate (X.509)
                  </label>
                  <textarea
                    value={formData.certificate}
                    onChange={(e) => setFormData({ ...formData, certificate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg font-mono text-xs border border-border bg-muted text-foreground"
                    rows={4}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  />
                  {config?.certificate === '*** Certificate Configured ***' && !formData.certificate && (
                    <p className="mt-1 text-xs text-muted-foreground">Certificate is configured. Leave empty to keep existing.</p>
                  )}
                </div>
              </div>
            )}

            {/* OIDC Fields */}
            {formData.provider === 'oidc' && (
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">OIDC Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      Client ID *
                    </label>
                    <input
                      type="text"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                      required={formData.provider === 'oidc'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      Client Secret {config?.hasClientSecret ? '(configured)' : ''}
                    </label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                      placeholder={config?.hasClientSecret ? '••••••••' : 'Enter client secret'}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">
                    Authorization URL *
                  </label>
                  <input
                    type="url"
                    value={formData.authorizationUrl}
                    onChange={(e) => setFormData({ ...formData, authorizationUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                    placeholder="https://login.example.com/oauth2/authorize"
                    required={formData.provider === 'oidc'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      Token URL
                    </label>
                    <input
                      type="url"
                      value={formData.tokenUrl}
                      onChange={(e) => setFormData({ ...formData, tokenUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                      placeholder="https://login.example.com/oauth2/token"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      UserInfo URL
                    </label>
                    <input
                      type="url"
                      value={formData.userinfoUrl}
                      onChange={(e) => setFormData({ ...formData, userinfoUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                      placeholder="https://login.example.com/oauth2/userinfo"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">
                    Scopes
                  </label>
                  <input
                    type="text"
                    value={formData.scopes}
                    onChange={(e) => setFormData({ ...formData, scopes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                    placeholder="openid profile email"
                  />
                </div>
              </div>
            )}

            {/* JIT Provisioning */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Just-In-Time (JIT) Provisioning</h3>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="jitEnabled"
                  checked={formData.jitEnabled}
                  onChange={(e) => setFormData({ ...formData, jitEnabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary"
                />
                <label htmlFor="jitEnabled" className="text-sm text-muted-foreground">
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
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <label htmlFor="jitUpdateProfile" className="text-sm text-muted-foreground">
                    Update user profile on each login
                  </label>
                </div>
              )}
            </div>

            {/* Allowed Domains */}
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Allowed Domains (comma-separated)
              </label>
              <input
                type="text"
                value={domainsInput}
                onChange={(e) => setDomainsInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
                placeholder="example.com, company.org"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Only users with email addresses from these domains can use this SSO provider
              </p>
            </div>

            {/* Button Customization */}
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Login Button Text
              </label>
              <input
                type="text"
                value={formData.buttonText}
                onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground"
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
                className="w-4 h-4 rounded accent-primary"
              />
              <label htmlFor="enabled" className="text-sm text-muted-foreground">
                Enable this SSO provider
              </label>
            </div>
          </div>
        </form>

        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border"
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-muted-foreground border border-border hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-primary-foreground rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {config ? 'Update' : 'Create'} Provider
          </button>
        </div>
      </div>
    </div>
  );
};
