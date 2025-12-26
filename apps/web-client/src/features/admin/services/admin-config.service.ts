import { createApiClient } from '../../../services/api';
import type {
  PlatformConfig,
  InstanceCustomization,
  CreateCustomizationDto,
  UpdateCustomizationDto,
  ConfigChangeHistory,
  UpgradeManifest,
  ListResponse,
  ConfigListFilters,
  HistoryListFilters,
  UpgradeAnalysis,
  BusinessRule,
  ResolutionStrategy,
  InstanceUpgradeImpact,
} from '../types';

// Create a dedicated API client for the metadata service
// In development, use proxy path to avoid cross-origin cookie issues
const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const api = createApiClient(METADATA_API_URL);

// ========== Platform Config API ==========

export const platformConfigApi = {
  /**
   * List all platform configurations
   */
  list: async (filters?: { type?: string; version?: string }): Promise<ListResponse<PlatformConfig>> => {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.version) params.append('version', filters.version);

    const response = await api.get(`/studio/config/platform?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a specific platform config by type and resource key
   */
  get: async (configType: string, resourceKey: string): Promise<PlatformConfig> => {
    const response = await api.get(`/studio/config/platform/${configType}/${encodeURIComponent(resourceKey)}`);
    return response.data;
  },

  /**
   * Get all config types available
   */
  getConfigTypes: async (): Promise<string[]> => {
    const response = await api.get('/studio/config/platform/types');
    return response.data;
  },
};

// ========== Tenant Customization API ==========

export const customizationApi = {
  /**
   * List all tenant customizations
   */
  list: async (filters?: ConfigListFilters): Promise<ListResponse<InstanceCustomization>> => {
    const params = new URLSearchParams();
    if (filters?.configType) params.append('type', filters.configType);
    if (filters?.customizationType) params.append('customizationType', filters.customizationType);
    if (filters?.active !== undefined) params.append('active', String(filters.active));

    const response = await api.get(`/studio/config/customizations?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a specific customization by ID
   */
  get: async (id: string): Promise<InstanceCustomization> => {
    const response = await api.get(`/studio/config/customizations/${id}`);
    return response.data;
  },

  /**
   * Create a new customization
   */
  create: async (data: CreateCustomizationDto): Promise<InstanceCustomization> => {
    const response = await api.post('/studio/config/customizations', data);
    return response.data;
  },

  /**
   * Update an existing customization
   */
  update: async (id: string, data: UpdateCustomizationDto): Promise<InstanceCustomization> => {
    const response = await api.patch(`/studio/config/customizations/${id}`, data);
    return response.data;
  },

  /**
   * Delete (deactivate) a customization
   */
  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/studio/config/customizations/${id}`);
    return response.data;
  },

  /**
   * Get customization history (all versions)
   */
  getVersionHistory: async (configType: string, resourceKey: string): Promise<InstanceCustomization[]> => {
    const response = await api.get(
      `/studio/config/customizations/history/${configType}/${encodeURIComponent(resourceKey)}`
    );
    return response.data;
  },

  /**
   * Compare customization with platform config
   */
  compareWithPlatform: async (id: string): Promise<{
    customization: InstanceCustomization;
    platformConfig: PlatformConfig;
    diff: any[];
  }> => {
    const response = await api.get(`/studio/config/customizations/${id}/compare`);
    return response.data;
  },
};

// ========== Change History API ==========

export const historyApi = {
  /**
   * List change history entries
   */
  list: async (filters?: HistoryListFilters): Promise<ListResponse<ConfigChangeHistory>> => {
    const params = new URLSearchParams();
    if (filters?.configType) params.append('type', filters.configType);
    if (filters?.resourceKey) params.append('resourceKey', filters.resourceKey);
    if (filters?.changeType) params.append('changeType', filters.changeType);
    if (filters?.changedBy) params.append('changedBy', filters.changedBy);
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const response = await api.get(`/studio/config/history?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a specific change history entry
   */
  get: async (id: string): Promise<ConfigChangeHistory> => {
    const response = await api.get(`/studio/config/history/${id}`);
    return response.data;
  },

  /**
   * Rollback to a previous state
   */
  rollback: async (id: string, reason?: string): Promise<{ success: boolean }> => {
    const response = await api.post(`/studio/config/history/${id}/rollback`, { reason });
    return response.data;
  },
};

// ========== Upgrade Management API ==========

export const upgradeApi = {
  /**
   * List available upgrades
   */
  listManifests: async (filters?: { fromVersion?: string }): Promise<ListResponse<UpgradeManifest>> => {
    const params = new URLSearchParams();
    if (filters?.fromVersion) params.append('fromVersion', filters.fromVersion);

    const response = await api.get(`/admin/upgrade/manifests?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a specific upgrade manifest
   */
  getManifest: async (id: string): Promise<UpgradeManifest> => {
    const response = await api.get(`/admin/upgrade/manifests/${id}`);
    return response.data;
  },

  /**
   * Analyze upgrade impact for current tenant
   */
  analyzeImpact: async (manifestId: string): Promise<UpgradeAnalysis> => {
    const response = await api.get(`/admin/upgrade/analyze/${manifestId}`);
    return response.data;
  },

  /**
   * Get upgrade impacts for a manifest
   */
  getImpacts: async (_manifestId: string): Promise<ListResponse<InstanceUpgradeImpact>> => {
    // Backend uses /admin/upgrade/impacts without manifestId filter for now
    const response = await api.get(`/admin/upgrade/impacts`);
    return response.data;
  },

  /**
   * Resolve an upgrade impact (placeholder - endpoint not implemented in backend)
   */
  resolveImpact: async (
    impactId: string,
    resolution: {
      choice: ResolutionStrategy;
      customValue?: Record<string, any>;
      notes?: string;
    }
  ): Promise<InstanceUpgradeImpact> => {
    const response = await api.post(`/admin/upgrade/impacts/${impactId}/resolve`, resolution);
    return response.data;
  },

  /**
   * Preview the merged result for an impact (placeholder - endpoint not implemented in backend)
   */
  previewMerge: async (
    impactId: string,
    strategy: ResolutionStrategy
  ): Promise<{ mergedValue: Record<string, any> }> => {
    const response = await api.post(`/admin/upgrade/impacts/${impactId}/preview`, { strategy });
    return response.data;
  },

  /**
   * Apply upgrade after all impacts are resolved (placeholder - endpoint not implemented in backend)
   */
  applyUpgrade: async (manifestId: string): Promise<{ success: boolean; appliedAt: string }> => {
    const response = await api.post(`/admin/upgrade/manifests/${manifestId}/apply`);
    return response.data;
  },

  /**
   * Get current platform version and upgrade status
   */
  getCurrentVersion: async (): Promise<{ version: string; appliedAt: string }> => {
    const response = await api.get('/admin/upgrade/status');
    // Map backend response format to expected frontend format
    return {
      version: response.data.currentVersion,
      appliedAt: new Date().toISOString(), // Backend doesn't provide this yet
    };
  },

  /**
   * Get customizations summary for upgrade planning
   */
  getCustomizationsSummary: async (): Promise<{
    totalCustomizations: number;
    byCustomizationType: Record<string, number>;
    byConfigType: Record<string, number>;
  }> => {
    const response = await api.get('/admin/upgrade/customizations-summary');
    return response.data;
  },

  /**
   * Run pre-upgrade checks
   */
  runPreCheck: async (): Promise<{
    status: string;
    checks: Array<{ name: string; status: string; details: string }>;
    recommendations: string[];
  }> => {
    const response = await api.post('/admin/upgrade/pre-check');
    return response.data;
  },
};

// ========== Business Rules API ==========

export const businessRulesApi = {
  /**
   * List business rules
   */
  list: async (filters?: { targetTable?: string; ruleType?: string; active?: boolean }): Promise<ListResponse<BusinessRule>> => {
    const params = new URLSearchParams();
    if (filters?.targetTable) params.append('table', filters.targetTable);
    if (filters?.ruleType) params.append('type', filters.ruleType);
    if (filters?.active !== undefined) params.append('active', String(filters.active));

    const response = await api.get(`/admin/business-rules?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a specific business rule
   */
  get: async (id: string): Promise<BusinessRule> => {
    const response = await api.get(`/admin/business-rules/${id}`);
    return response.data;
  },

  /**
   * Create a new business rule
   */
  create: async (data: Omit<BusinessRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<BusinessRule> => {
    const response = await api.post('/admin/business-rules', data);
    return response.data;
  },

  /**
   * Update a business rule
   */
  update: async (id: string, data: Partial<BusinessRule>): Promise<BusinessRule> => {
    const response = await api.patch(`/admin/business-rules/${id}`, data);
    return response.data;
  },

  /**
   * Delete a business rule
   */
  delete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/admin/business-rules/${id}`);
    return response.data;
  },

  /**
   * Toggle business rule active status
   */
  toggle: async (id: string): Promise<{ id: string; isActive: boolean }> => {
    const response = await api.post(`/admin/business-rules/${id}/toggle`);
    return response.data;
  },

  /**
   * Test a business rule
   */
  test: async (id: string, testData: Record<string, any>): Promise<{ passed: boolean; result: any; error?: string }> => {
    const response = await api.post(`/admin/business-rules/${id}/test`, { recordData: testData });
    return response.data;
  },
};

// Export all APIs as a single object for convenience
export const adminConfigService = {
  platformConfig: platformConfigApi,
  customization: customizationApi,
  history: historyApi,
  upgrade: upgradeApi,
  businessRules: businessRulesApi,
};

export default adminConfigService;
