import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_CONTROL_PLANE_API_URL || 'http://localhost:3100/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for auth tokens
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('control_plane_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 if we're not on the login page and not trying to login
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      // Handle unauthorized - redirect to login
      localStorage.removeItem('control_plane_token');
      localStorage.removeItem('control_plane_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
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
  resourceTier: 'standard' | 'professional' | 'enterprise';
  customer?: Customer;
  resourceMetrics: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    network_io?: number;
    db_connections?: number;
    active_users?: number;
  };
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

  createInstance: (data: { customerId: string; environment: string; region: string; version: string; resourceTier?: string }) =>
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
