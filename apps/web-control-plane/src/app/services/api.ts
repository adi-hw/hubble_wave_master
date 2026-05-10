import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_CONTROL_PLANE_API_URL || 'http://localhost:3100/api';

// Cookies are sent with every request because the control-plane backend
// authenticates admin sessions over a same-origin path. Validate the
// configured base URL at module init so a misconfigured deploy can never
// leak admin cookies to a non-control-plane host.
function assertControlPlaneOrigin(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, window.location.origin);
  } catch {
    throw new Error(
      `[control-plane] VITE_CONTROL_PLANE_API_URL is not a valid URL: ${rawUrl}`,
    );
  }

  const host = parsed.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost');
  const isControlPlaneHost =
    host === 'control.hubblewave.com' ||
    host.startsWith('control.') ||
    host.endsWith('.control.hubblewave.com');

  if (!isLocal && !isControlPlaneHost) {
    throw new Error(
      `[control-plane] Refusing to send credentialed requests to '${host}'. ` +
        `withCredentials requires an origin matching control.<domain>. ` +
        `Set VITE_CONTROL_PLANE_API_URL to a control-plane host.`,
    );
  }

  if (!isLocal && parsed.protocol !== 'https:') {
    throw new Error(
      `[control-plane] Credentialed requests must use https; got ${parsed.protocol}`,
    );
  }
}

assertControlPlaneOrigin(API_BASE_URL);

const API_BASE_PARSED = new URL(API_BASE_URL, window.location.origin);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

/**
 * Resolve the actual host the request will hit. Axios merges baseURL + url
 * itself only after the interceptor runs, so we recompute here using the
 * same precedence rules: an absolute `config.url` wins over `baseURL`.
 */
function resolvedRequestOrigin(config: { baseURL?: string; url?: string }): string | null {
  const url = config.url ?? '';
  const baseURL = config.baseURL ?? API_BASE_URL;
  try {
    return new URL(url, baseURL).origin;
  } catch {
    return null;
  }
}

// F089 (W1 task 10): the access token comes from the in-memory store
// in auth.ts, NOT from localStorage. The previous localStorage read was
// the XSS exfil vector — any malicious script could
// `localStorage.getItem('control_plane_token')` and send it off-origin.
// Now there is nothing in localStorage to exfiltrate.
//
// Indirected via a getter to avoid a circular import (api.ts ←→ auth.ts):
// auth.ts owns the variable; we read it through a closure-bound getter
// installed at module init. The getter is plain JS scope, so an XSS
// payload that runs in the same context can still reach
// `inMemoryAccessToken` via reflection — but it CANNOT survive a page
// reload, and it CANNOT be exfiltrated by the standard
// "scrape localStorage" worm. That's the W1 win.
let getAccessToken: () => string | null = () => null;

export function _registerAccessTokenSource(getter: () => string | null): void {
  getAccessToken = getter;
}

// Request interceptor: only attach the admin Bearer token when the request
// actually targets the configured control-plane origin. A misuse of `api`
// (or `axios.request({...})` against an absolute third-party URL through
// this same instance) MUST NOT leak the admin JWT off-origin. Anything
// outside the control-plane origin gets the Authorization header stripped.
api.interceptors.request.use(
  (config) => {
    const requestOrigin = resolvedRequestOrigin(config);
    const sameOrigin = requestOrigin === API_BASE_PARSED.origin;
    if (sameOrigin) {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else {
      // Defensive: if a caller manually set Authorization on a cross-origin
      // request, scrub it. The interceptor is the last line before egress.
      if (config.headers && 'Authorization' in config.headers) {
        delete (config.headers as Record<string, unknown>)['Authorization'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Module-level guard so a burst of in-flight requests that all 401 at once
// triggers exactly one redirect. Never reset; the page reload after redirect
// gives a fresh module instance.
let logoutInFlight = false;

// Single in-flight refresh promise: when several requests 401 simultaneously
// we must NOT call /auth/refresh once per request — that would burn through
// the refresh-token rotation chain and trigger the reuse-detection family
// revoke. Instead the first 401 starts the refresh and every later 401 in
// the burst awaits the same promise.
let refreshInFlight: Promise<string> | null = null;

// F089: refresh uses the HttpOnly cookie set by the backend; no body
// token, no localStorage read. withCredentials on the api instance
// causes the cookie to ride the request automatically.
let setAccessToken: (token: string | null) => void = () => {
  /* registered by auth.ts */
};
let clearAuthState: () => void = () => {
  /* registered by auth.ts */
};

export function _registerTokenLifecycle(
  setter: (token: string | null) => void,
  clearer: () => void,
): void {
  setAccessToken = setter;
  clearAuthState = clearer;
}

function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = api
      .post<{ accessToken: string }>(
        '/auth/refresh',
        // No body — refresh token is in HttpOnly cookie.
        {},
        { headers: { 'X-Skip-Auth-Refresh': 'true' } },
      )
      .then((res) => {
        const { accessToken } = res.data;
        setAccessToken(accessToken);
        return accessToken;
      })
      .finally(() => {
        // Always clear so a subsequent 401 (e.g., refresh token also
        // expired in the meantime) can attempt a fresh refresh once
        // before the user is bounced.
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function bounceToLogin(): void {
  if (logoutInFlight) return;
  logoutInFlight = true;
  // F089: clear in-memory access token + the legacy localStorage user
  // entry. The HttpOnly refresh cookie persists on the browser side
  // until the next /auth/login or /auth/logout sets/clears it; that's
  // fine — server-side reuse detection will flag a stolen cookie.
  clearAuthState();
  window.location.href = '/login';
}

// Response interceptor: silent refresh on 401 before falling back to logout.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config as
      | (typeof error.config & { _retried?: boolean; headers?: Record<string, string> })
      | undefined;

    if (
      status !== 401 ||
      !original ||
      original._retried ||
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/refresh') ||
      original.headers?.['X-Skip-Auth-Refresh'] === 'true'
    ) {
      if (status === 401 && !original?.url?.includes('/auth/login')) {
        // Refresh attempted and failed (or no refresh token at all): bounce.
        bounceToLogin();
      }
      return Promise.reject(error);
    }

    try {
      const newAccessToken = await refreshAccessToken();
      original._retried = true;
      original.headers = original.headers ?? {};
      original.headers['Authorization'] = `Bearer ${newAccessToken}`;
      return api.request(original);
    } catch (refreshErr) {
      bounceToLogin();
      return Promise.reject(refreshErr);
    }
  },
);

// Types
export interface Customer {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'trial' | 'suspended' | 'churned' | 'pending' | 'terminated';
  tier: 'starter' | 'professional' | 'enterprise';
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  mrr: number;
  contractStart?: string;
  contractEnd?: string;
  totalUsers: number;
  totalAssets: number;
  settings: CustomerSettings;
  instances?: TenantInstance[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSettings {
  features: {
    ai_assistant: boolean;
    advanced_analytics: boolean;
    custom_integrations: boolean;
    mobile_app: boolean;
    sso: boolean;
    audit_logs: boolean;
  };
  security: {
    mfa_required: boolean;
    ip_whitelist: string[];
    session_timeout: number;
    password_policy: 'standard' | 'strong' | 'enterprise';
  };
  notifications: {
    email_alerts: boolean;
    slack_integration: boolean;
    webhook_url: string;
  };
  backup: {
    frequency: 'hourly' | 'daily' | 'weekly';
    retention_days: number;
    cross_region: boolean;
  };
  api: {
    rate_limit: number;
    burst_limit: number;
  };
  branding: {
    primary_color: string;
    logo_url: string;
    custom_domain: string;
  };
}

export interface TenantInstance {
  id: string;
  customerId: string;
  environment: 'production' | 'staging' | 'dev';
  status: 'provisioning' | 'active' | 'suspended' | 'terminated' | 'failed';
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  domain?: string;
  region: string;
  version: string;
  resourceTier: 'standard' | 'professional' | 'enterprise' | 'enterprise_gpu';
  customer?: Customer;
  resourceMetrics: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    network_io?: number;
    db_connections?: number;
    active_users?: number;
  };
  gpuEnabled?: boolean;
  gpuInstanceType?: string;
  huggingfaceToken?: string;
  vllmModel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackRegistry {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  publisher: string;
  license?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PackRelease {
  id: string;
  packId: string;
  releaseId: string;
  manifestRevision: number;
  manifest: Record<string, unknown>;
  dependencies?: Record<string, unknown> | null;
  compatibility?: Record<string, unknown> | null;
  assets: Array<{ type: string; path: string; sha256: string }> | Record<string, unknown>;
  artifactBucket: string;
  artifactKey: string;
  artifactSha256: string;
  signature: string;
  signatureKeyId: string;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: string;
}

export type PackInstallStatus = 'applying' | 'applied' | 'failed' | 'rolled_back' | 'skipped';

export interface PackInstallStatusRecord {
  id: string;
  packCode: string;
  packReleaseId: string;
  status: PackInstallStatus;
  manifest: Record<string, unknown>;
  artifactSha256?: string | null;
  installSummary: Record<string, unknown>;
  warnings: Array<Record<string, unknown>>;
  appliedBy?: string | null;
  appliedByType: 'user' | 'system';
  startedAt: string;
  completedAt?: string | null;
  rollbackOfReleaseId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PackWithReleases extends PackRegistry {
  releases: PackRelease[];
}

export interface PackInstallRequest {
  instanceId: string;
  packCode: string;
  releaseId: string;
}

export interface PackRollbackRequest {
  instanceId: string;
  packCode: string;
  releaseId: string;
}

export interface InstanceBackupRequest {
  instanceId: string;
}

export interface InstanceRestoreRequest {
  instanceId: string;
  backupId: string;
}

export interface AuditLog {
  id: string;
  customerId?: string;
  eventType: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: string;
  actorType: 'user' | 'system' | 'api';
  target: string;
  targetType: 'customer' | 'instance' | 'license' | 'terraform' | 'settings';
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TerraformJob {
  id: string;
  instanceId: string;
  customerCode: string;
  environment: string;
  region?: string;
  version?: string;
  operation: 'plan' | 'apply' | 'destroy' | 'refresh';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  plan: {
    add: number;
    change: number;
    destroy: number;
  };
  output: Array<{
    time: string;
    level: 'info' | 'add' | 'change' | 'destroy' | 'success' | 'error' | 'plan';
    message: string;
  }>;
  duration?: number;
  createdAt: string;
}

export type LicenseStatus = 'active' | 'pending' | 'expired' | 'revoked';
export type LicenseType = 'starter' | 'professional' | 'enterprise' | 'trial';

export interface License {
  id: string;
  customerId: string;
  customer?: Customer;
  instanceId?: string | null;
  licenseKey: string;
  licenseType: LicenseType;
  status: LicenseStatus;
  maxUsers?: number | null;
  maxAssets?: number | null;
  features: string[];
  issuedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
  createdAt: string;
}

export interface GlobalSettings {
  id: string;
  platformName: string;
  maintenanceMode: boolean;
  publicSignup: boolean;
  defaultTrialDays: number;
  supportEmail: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformMetrics {
  customers: {
    total: number;
    active: number;
    trial: number;
    byTier: Record<string, number>;
    totalUsers: number;
    totalAssets: number;
  };
  instances: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    provisioning: number;
    byEnvironment: Record<string, number>;
    byRegion: Record<string, number>;
  };
  revenue: {
    totalMrr: number;
    avgMrr: number;
  };
  resources: {
    avgCpu: number;
    avgMemory: number;
    avgDisk: number;
    avgNetwork: number;
  };
  recentActivity?: AuditLog[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// API functions
export const controlPlaneApi = {
  // Customers
  getCustomers: (params?: { search?: string; status?: string; tier?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Customer>>('/customers', { params }).then((r) => r.data),

  getCustomer: (id: string) =>
    api.get<Customer>(`/customers/${id}`).then((r) => r.data),

  getCustomerByCode: (code: string) =>
    api.get<Customer>(`/customers/code/${code}`).then((r) => r.data),

  createCustomer: (data: Partial<Customer>) =>
    api.post<Customer>('/customers', data).then((r) => r.data),

  updateCustomer: (id: string, data: Partial<Customer>) =>
    api.put<Customer>(`/customers/${id}`, data).then((r) => r.data),

  updateCustomerSettings: (id: string, settings: Partial<CustomerSettings>) =>
    api.patch<Customer>(`/customers/${id}/settings`, settings).then((r) => r.data),

  deleteCustomer: (id: string) =>
    api.delete(`/customers/${id}`),

  getCustomerStats: () =>
    api.get('/customers/stats').then((r) => r.data),

  // Instances
  getInstances: (params?: { customerId?: string; environment?: string; status?: string }) =>
    api.get<PaginatedResponse<TenantInstance>>('/instances', { params }).then((r) => r.data),

  getInstance: (id: string) =>
    api.get<TenantInstance>(`/instances/${id}`).then((r) => r.data),

  getInstancesByCustomer: (customerId: string) =>
    api.get<TenantInstance[]>(`/instances/customer/${customerId}`).then((r) => r.data),

  createInstance: (data: {
    customerId: string;
    environment: string;
    region: string;
    version: string;
    resourceTier?: string;
    gpuEnabled?: boolean;
    gpuInstanceType?: string;
    vllmModel?: string;
  }) =>
    api.post<TenantInstance>('/instances', data).then((r) => r.data),

  provisionInstance: (id: string) =>
    api.post<{ instance: TenantInstance; jobId: string }>(`/instances/${id}/provision`).then((r) => r.data),

  updateInstance: (id: string, data: Partial<TenantInstance>) =>
    api.put<TenantInstance>(`/instances/${id}`, data).then((r) => r.data),

  terminateInstance: (id: string) =>
    api.delete(`/instances/${id}`),

  getInstanceStats: () =>
    api.get('/instances/stats').then((r) => r.data),

  // Packs
  getPacks: () =>
    api.get<PackWithReleases[]>('/packs').then((r) => r.data),

  getPack: (code: string) =>
    api.get<PackWithReleases>(`/packs/${code}`).then((r) => r.data),

  getPackRelease: (code: string, releaseId: string) =>
    api.get<PackRelease>(`/packs/${code}/releases/${releaseId}`).then((r) => r.data),

  getPackDownloadUrl: (code: string, releaseId: string, expiresInSeconds?: number) =>
    api
      .get<{ url: string; expiresInSeconds: number }>(`/packs/${code}/releases/${releaseId}/download-url`, {
        params: { expiresInSeconds },
      })
      .then((r) => r.data),

  createPackUploadUrl: (data: { code: string; releaseId: string; filename?: string }) =>
    api.post<{ bucket: string; key: string; url: string; expiresInSeconds: number }>('/packs/upload-url', data)
      .then((r) => r.data),

  registerPack: (data: { artifactKey: string; artifactBucket?: string }) =>
    api.post<PackRelease>('/packs/register', data).then((r) => r.data),

  triggerPackInstall: (data: PackInstallRequest) =>
    api.post<{ triggered: boolean }>('/packs/install', data).then((r) => r.data),

  triggerPackRollback: (data: PackRollbackRequest) =>
    api.post<{ triggered: boolean }>('/packs/rollback', data).then((r) => r.data),

  getPackInstallStatus: (params: {
    instanceId: string;
    packCode?: string;
    releaseId?: string;
    status?: string;
    limit?: number;
  }) =>
    api.get<PackInstallStatusRecord[]>('/packs/install-status', { params }).then((r) => r.data),

  // Audit Logs
  getAuditLogs: (params?: { customerId?: string; eventType?: string; severity?: string; page?: number }) =>
    api.get<PaginatedResponse<AuditLog>>('/audit-logs', { params }).then((r) => r.data),

  getRecentActivity: (customerId?: string, limit = 10) =>
    api.get<AuditLog[]>('/audit-logs/recent', { params: { customerId, limit } }).then((r) => r.data),

  getAuditStats: (customerId?: string) =>
    api.get('/audit-logs/stats', { params: { customerId } }).then((r) => r.data),

  // Terraform Jobs
  getTerraformJobs: (params?: { instanceId?: string; status?: string; operation?: string }) =>
    api.get<PaginatedResponse<TerraformJob>>('/terraform/jobs', { params }).then((r) => r.data),

  createTerraformJob: (data: { customerId: string; environment: string; operation: string; version: string; instanceId?: string }) =>
    api.post<TerraformJob>('/terraform/jobs', data).then((r) => r.data),

  getTerraformJob: (id: string) =>
    api.get<TerraformJob>(`/terraform/jobs/${id}`).then((r) => r.data),

  getRunningJobs: () =>
    api.get<TerraformJob[]>('/terraform/jobs/running').then((r) => r.data),



  cancelTerraformJob: (id: string) =>
    api.patch<TerraformJob>(`/terraform/jobs/${id}/cancel`).then((r) => r.data),

  getTerraformStats: () =>
    api.get('/terraform/jobs/stats').then((r) => r.data),

  // Recovery
  triggerInstanceBackup: (data: InstanceBackupRequest) =>
    api.post<{ triggered: boolean }>('/recovery/backup', data).then((r) => r.data),

  triggerInstanceRestore: (data: InstanceRestoreRequest) =>
    api.post<{ triggered: boolean }>('/recovery/restore', data).then((r) => r.data),

  // Metrics
  getMetrics: () =>
    api.get<PlatformMetrics>('/metrics').then((r) => r.data),

  getTopInstances: (limit = 10) =>
    api.get<TenantInstance[]>('/metrics/top-instances', { params: { limit } }).then((r) => r.data),

  // Licenses
  getLicenses: (params?: { customerId?: string }) =>
    api.get<License[]>('/licenses', { params }).then((r) => r.data),

  createLicense: (data: {
    customerId: string;
    licenseType: LicenseType;
    maxUsers: number;
    maxAssets: number;
    expiresAt: string;
    features?: string[];
  }) =>
    api.post<License>('/licenses', data).then((r) => r.data),

  updateLicenseStatus: (id: string, data: { status: LicenseStatus; revokeReason?: string }) =>
    api.post<License>(`/licenses/${id}/status`, data).then((r) => r.data),

  // Global Settings
  getGlobalSettings: () =>
    api.get<GlobalSettings>('/settings/global').then((r) => r.data),

  updateGlobalSettings: (data: Partial<GlobalSettings>) =>
    api.put<GlobalSettings>('/settings/global', data).then((r) => r.data),
};

export default api;
