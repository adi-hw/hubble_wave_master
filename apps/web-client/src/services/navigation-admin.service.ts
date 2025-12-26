/**
 * Navigation Admin Service
 *
 * API client for navigation administration (Studio).
 */

import { createApiClient } from './api';
import { ResolvedNavigation } from '../types/navigation-v2';
import { NavNodeData } from '../components/studio/NavNodeEditor';
import { ModuleOption } from '../components/studio/ModulePicker';

// Use identity service for navigation admin endpoints
const IDENTITY_API_URL = import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';
const adminApi = createApiClient(IDENTITY_API_URL);

/**
 * Navigation Profile (Admin)
 */
export interface NavProfile {
  id: string;
  slug: string;
  name: string;
  description?: string;
  templateKey?: string;
  autoAssignRoles?: string[];
  autoAssignExpression?: string;
  isDefault: boolean;
  isActive: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Profile DTO
 */
export interface CreateNavProfileDto {
  slug: string;
  name: string;
  description?: string;
  templateKey?: string;
  autoAssignRoles?: string[];
  isDefault?: boolean;
}

/**
 * Update Profile DTO
 */
export interface UpdateNavProfileDto {
  name?: string;
  description?: string;
  autoAssignRoles?: string[];
  autoAssignExpression?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

/**
 * NavNode (Admin)
 */
export interface NavNode {
  id: string;
  key: string;
  label: string;
  icon?: string;
  type: 'group' | 'module' | 'link' | 'separator' | 'smart_group';
  moduleKey?: string;
  url?: string;
  parentId?: string;
  parentKey?: string;
  order: number;
  isVisible: boolean;
  visibility?: {
    rolesAny?: string[];
    rolesAll?: string[];
    permissionsAny?: string[];
    featureFlagsAny?: string[];
    expression?: string;
  };
  contextTags?: string[];
  smartGroupType?: 'favorites' | 'recent' | 'frequent';
  children?: NavNode[];
}

/**
 * Create Node DTO
 */
export interface CreateNavNodeDto {
  key: string;
  label: string;
  icon?: string;
  type: 'group' | 'module' | 'link' | 'separator' | 'smart_group';
  moduleKey?: string;
  url?: string;
  parentKey?: string;
  order?: number;
  visibility?: NavNodeData['visibility'];
  contextTags?: string[];
}

/**
 * Update Node DTO
 */
export interface UpdateNavNodeDto {
  label?: string;
  icon?: string;
  moduleKey?: string;
  url?: string;
  parentKey?: string;
  order?: number;
  isVisible?: boolean;
  visibility?: NavNodeData['visibility'];
  contextTags?: string[];
}

/**
 * NavPatch
 */
export interface NavPatch {
  id: string;
  operation: string;
  targetNodeKey: string;
  payload?: Record<string, unknown>;
  priority: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Create Patch DTO
 */
export interface CreateNavPatchDto {
  operation: string;
  targetNodeKey: string;
  payload?: Record<string, unknown>;
  priority?: number;
  description?: string;
}

/**
 * Preview Context
 */
export interface PreviewContext {
  roles?: string[];
  permissions?: string[];
  featureFlags?: string[];
  contextTags?: string[];
}

/**
 * Navigation Admin Service
 */
export const navigationAdminService = {
  // === Profiles ===

  async getProfiles(): Promise<NavProfile[]> {
    const res = await adminApi.get<NavProfile[]>('/admin/navigation/profiles');
    return res.data;
  },

  async getProfile(profileId: string): Promise<NavProfile> {
    const res = await adminApi.get<NavProfile>(`/admin/navigation/profiles/${profileId}`);
    return res.data;
  },

  async createProfile(dto: CreateNavProfileDto): Promise<NavProfile> {
    const res = await adminApi.post<NavProfile>('/admin/navigation/profiles', dto);
    return res.data;
  },

  async updateProfile(profileId: string, dto: UpdateNavProfileDto): Promise<NavProfile> {
    const res = await adminApi.patch<NavProfile>(`/admin/navigation/profiles/${profileId}`, dto);
    return res.data;
  },

  async deleteProfile(profileId: string): Promise<void> {
    await adminApi.delete(`/admin/navigation/profiles/${profileId}`);
  },

  // === Nodes ===

  async getNodes(profileId: string): Promise<NavNode[]> {
    const res = await adminApi.get<NavNode[]>(`/admin/navigation/nodes/${profileId}`);
    return res.data;
  },

  async createNode(profileId: string, dto: CreateNavNodeDto): Promise<NavNode> {
    const res = await adminApi.post<NavNode>(`/admin/navigation/nodes/${profileId}`, dto);
    return res.data;
  },

  async updateNode(profileId: string, nodeId: string, dto: UpdateNavNodeDto): Promise<NavNode> {
    const res = await adminApi.patch<NavNode>(
      `/admin/navigation/nodes/${profileId}/${nodeId}`,
      dto
    );
    return res.data;
  },

  async deleteNode(profileId: string, nodeId: string): Promise<void> {
    await adminApi.delete(`/admin/navigation/nodes/${profileId}/${nodeId}`);
  },

  async reorderNodes(
    profileId: string,
    orders: { nodeId: string; order: number; parentKey?: string }[]
  ): Promise<void> {
    await adminApi.post(`/admin/navigation/nodes/${profileId}/reorder`, { orders });
  },

  // === Patches ===

  async getPatches(profileId: string): Promise<NavPatch[]> {
    const res = await adminApi.get<NavPatch[]>(`/admin/navigation/patches/${profileId}`);
    return res.data;
  },

  async createPatch(profileId: string, dto: CreateNavPatchDto): Promise<NavPatch> {
    const res = await adminApi.post<NavPatch>(`/admin/navigation/patches/${profileId}`, dto);
    return res.data;
  },

  async updatePatch(
    profileId: string,
    patchId: string,
    dto: Partial<CreateNavPatchDto>
  ): Promise<NavPatch> {
    const res = await adminApi.patch<NavPatch>(
      `/admin/navigation/patches/${profileId}/${patchId}`,
      dto
    );
    return res.data;
  },

  async deletePatch(profileId: string, patchId: string): Promise<void> {
    await adminApi.delete(`/admin/navigation/patches/${profileId}/${patchId}`);
  },

  // === Preview ===

  async preview(profileId: string, context: PreviewContext): Promise<ResolvedNavigation> {
    const res = await adminApi.post<ResolvedNavigation>(
      `/admin/navigation/preview/${profileId}`,
      context
    );
    return res.data;
  },

  // === Modules ===

  async getModules(): Promise<ModuleOption[]> {
    const res = await adminApi.get<ModuleOption[]>('/admin/navigation/modules');
    return res.data;
  },

  // === Templates ===

  async getTemplates(): Promise<{ key: string; name: string; description?: string }[]> {
    const res = await adminApi.get<{ key: string; name: string; description?: string }[]>(
      '/admin/navigation/templates'
    );
    return res.data;
  },
};
