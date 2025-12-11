import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  TenantDbService,
  TenantNavProfile,
  TenantNavProfileItem,
  NavTemplate,
  NavPatch,
  NavPatchOperation,
  NavItemType,
} from '@eam-platform/tenant-db';
import { ModuleRegistryService, ResolvedModule } from './module-registry.service';
import { VisibilityExpressionService, VisibilityContext } from './visibility-expression.service';
import { NavigationPreferenceService } from './navigation-preference.service';
import { ResolvedNavNode, ResolvedNavigation, NavProfileSummary, NavSearchResult } from './dto/navigation.dto';

/**
 * User identity for navigation resolution
 */
export interface NavigationUser {
  userId: string;
  membershipId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

/**
 * NavigationResolutionService - Core service for resolving user navigation
 *
 * Resolution algorithm:
 * 1. Get user's active profile (or determine from roles via autoAssignRoles)
 * 2. Load base navigation from template (if templateKey set)
 * 3. Load NavProfileItems for profile (or expand from template)
 * 4. Apply NavPatches in priority order
 * 5. Filter by visibility (roles, permissions, feature flags, expressions)
 * 6. Resolve module references (get routes, icons from ModuleRegistry)
 * 7. Populate smart groups (favorites, recent, frequent)
 * 8. Sort by order
 * 9. Return ResolvedNavigation
 */
@Injectable()
export class NavigationResolutionService {
  private readonly logger = new Logger(NavigationResolutionService.name);

  constructor(
    private readonly tenantDbService: TenantDbService,
    private readonly moduleRegistry: ModuleRegistryService,
    private readonly visibilityService: VisibilityExpressionService,
    private readonly preferenceService: NavigationPreferenceService
  ) {}

  /**
   * Resolve navigation for a user
   */
  async resolveNavigation(
    user: NavigationUser,
    featureFlags: string[] = [],
    contextTags: string[] = []
  ): Promise<ResolvedNavigation> {
    const { tenantId, userId, roles, permissions } = user;

    // Build visibility context
    const visibilityContext: VisibilityContext = {
      roles,
      permissions,
      featureFlags,
      contextTags,
    };

    // Step 1: Get user's active profile
    const profile = await this.getActiveProfile(user);

    // Step 2-3: Load navigation structure
    let navNodes: TenantNavProfileItem[];
    if (profile.templateKey) {
      // Load from template and apply profile overrides
      navNodes = await this.loadFromTemplate(tenantId, profile);
    } else {
      // Load directly from profile items
      navNodes = await this.loadProfileItems(tenantId, profile.id);
    }

    // Step 4: Apply patches
    const patchedNodes = await this.applyPatches(tenantId, profile.id, navNodes);

    // Step 5: Collect all module keys for batch lookup
    const moduleKeys = this.collectModuleKeys(patchedNodes);
    const modules = await this.moduleRegistry.getModulesByKeys(tenantId, moduleKeys);

    // Step 6-7: Resolve nodes with visibility filtering and module resolution
    const resolvedNodes = this.resolveNodes(patchedNodes, modules, visibilityContext);

    // Step 8: Load user preferences for favorites and recent
    const favorites = this.preferenceService.getFavorites(tenantId, userId);
    const recentRaw = this.preferenceService.getRecent(tenantId, userId);

    // Resolve recent modules
    const recentKeys = recentRaw.map((r) => r.key);
    const recentModulesMap = await this.moduleRegistry.getModulesByKeys(tenantId, recentKeys);

    const recentModules = recentRaw
      .filter((r) => recentModulesMap.has(r.key))
      .map((r) => {
        const module = recentModulesMap.get(r.key)!;
        return {
          key: r.key,
          label: module.label,
          icon: module.icon,
          route: module.route,
          accessedAt: r.accessedAt,
        };
      })
      .slice(0, 10);

    // Populate smart groups
    const finalNodes = this.populateSmartGroups(
      resolvedNodes,
      favorites,
      recentModules,
      modules
    );

    return {
      profileId: profile.id,
      profileSlug: profile.slug,
      profileName: profile.name,
      nodes: finalNodes,
      favorites,
      recentModules,
    };
  }

  /**
   * Get the user's active navigation profile
   */
  async getActiveProfile(user: NavigationUser): Promise<TenantNavProfile> {
    const { tenantId, userId, roles } = user;

    // Check for user-selected profile in preferences
    const activeProfileId = this.preferenceService.getActiveProfileId(tenantId, userId);

    if (activeProfileId) {
      const profileRepo = await this.tenantDbService.getRepository<TenantNavProfile>(
        tenantId,
        TenantNavProfile
      );
      const selectedProfile = await profileRepo.findOne({
        where: { id: activeProfileId, isActive: true },
      });
      if (selectedProfile) {
        return selectedProfile;
      }
    }

    // Auto-assign based on roles
    const profileRepo = await this.tenantDbService.getRepository<TenantNavProfile>(
      tenantId,
      TenantNavProfile
    );
    const profiles = await profileRepo.find({
      where: { isActive: true },
      order: { priority: 'ASC' },
    });

    // Find first profile that matches user's roles
    for (const profile of profiles) {
      if (profile.autoAssignRoles?.length) {
        const hasMatchingRole = profile.autoAssignRoles.some((role) =>
          roles.includes(role)
        );
        if (hasMatchingRole) {
          return profile;
        }
      }
    }

    // Fall back to default profile
    const defaultProfile = profiles.find((p) => p.isDefault);
    if (defaultProfile) {
      return defaultProfile;
    }

    // Last resort: first active profile
    if (profiles.length > 0) {
      return profiles[0];
    }

    throw new NotFoundException('No navigation profile found');
  }

  /**
   * Get all profiles available to a user
   */
  async getAvailableProfiles(user: NavigationUser): Promise<NavProfileSummary[]> {
    const { tenantId, roles } = user;

    const profileRepo = await this.tenantDbService.getRepository<TenantNavProfile>(
      tenantId,
      TenantNavProfile
    );
    const profiles = await profileRepo.find({
      where: { isActive: true },
      order: { priority: 'ASC', name: 'ASC' },
    });

    // Filter to profiles the user has access to
    return profiles
      .filter((profile) => {
        if (!profile.autoAssignRoles?.length) {
          return true; // No role restriction
        }
        return profile.autoAssignRoles.some((role) => roles.includes(role));
      })
      .map((profile) => ({
        id: profile.id,
        slug: profile.slug,
        name: profile.name,
        description: profile.description,
        isActive: profile.isActive,
        isDefault: profile.isDefault,
      }));
  }

  /**
   * Switch user's active profile
   */
  async switchProfile(user: NavigationUser, profileId: string): Promise<void> {
    const { tenantId, userId } = user;

    // Verify profile exists and user has access
    const profiles = await this.getAvailableProfiles(user);
    if (!profiles.some((p) => p.id === profileId)) {
      throw new NotFoundException('Profile not found or not accessible');
    }

    // Save preference
    this.preferenceService.setActiveProfileId(tenantId, userId, profileId);
  }

  /**
   * Search navigation items
   */
  async searchNavigation(
    user: NavigationUser,
    query: string,
    limit = 20
  ): Promise<NavSearchResult[]> {
    const { tenantId, roles, permissions } = user;

    // Search modules
    const modules = await this.moduleRegistry.searchModules(tenantId, query, limit);

    const visibilityContext: VisibilityContext = {
      roles,
      permissions,
      featureFlags: [],
      contextTags: [],
    };

    // Filter by visibility and map to results
    return modules
      .filter((m) => this.visibilityService.isVisible(m.security, visibilityContext))
      .map((module, index) => ({
        key: module.key,
        label: module.label,
        icon: module.icon,
        route: module.route,
        path: module.applicationKey ? [module.applicationKey, module.key] : [module.key],
        score: this.calculateSearchScore(module, query, index),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Toggle favorite status for a module
   */
  toggleFavorite(user: NavigationUser, moduleKey: string): string[] {
    const { tenantId, userId } = user;
    return this.preferenceService.toggleFavorite(tenantId, userId, moduleKey);
  }

  /**
   * Record navigation to a module (for recent/frequent tracking)
   */
  recordNavigation(user: NavigationUser, moduleKey: string): void {
    const { tenantId, userId } = user;
    this.preferenceService.recordNavigation(tenantId, userId, moduleKey);
  }

  /**
   * Resolve navigation for a specific profile (for admin preview)
   */
  async resolveNavigationForProfile(
    user: NavigationUser,
    profileId: string,
    featureFlags: string[] = [],
    contextTags: string[] = []
  ): Promise<ResolvedNavigation> {
    const { tenantId, userId, roles, permissions } = user;

    // Build visibility context with the provided roles/permissions
    const visibilityContext: VisibilityContext = {
      roles,
      permissions,
      featureFlags,
      contextTags,
    };

    // Get the specific profile
    const profileRepo = await this.tenantDbService.getRepository<TenantNavProfile>(
      tenantId,
      TenantNavProfile
    );
    const profile = await profileRepo.findOne({ where: { id: profileId } });

    if (!profile) {
      throw new NotFoundException(`Profile ${profileId} not found`);
    }

    // Load navigation structure
    let navNodes: TenantNavProfileItem[];
    if (profile.templateKey) {
      navNodes = await this.loadFromTemplate(tenantId, profile);
    } else {
      navNodes = await this.loadProfileItems(tenantId, profile.id);
    }

    // Apply patches
    const patchedNodes = await this.applyPatches(tenantId, profile.id, navNodes);

    // Collect module keys and resolve
    const moduleKeys = this.collectModuleKeys(patchedNodes);
    const modules = await this.moduleRegistry.getModulesByKeys(tenantId, moduleKeys);

    // Resolve nodes with visibility filtering
    const resolvedNodes = this.resolveNodes(patchedNodes, modules, visibilityContext);

    // Load preferences for smart groups
    const favorites = this.preferenceService.getFavorites(tenantId, userId);
    const recentRaw = this.preferenceService.getRecent(tenantId, userId);
    const recentKeys = recentRaw.map((r) => r.key);
    const recentModulesMap = await this.moduleRegistry.getModulesByKeys(tenantId, recentKeys);

    const recentModules = recentRaw
      .filter((r) => recentModulesMap.has(r.key))
      .map((r) => {
        const module = recentModulesMap.get(r.key)!;
        return {
          key: r.key,
          label: module.label,
          icon: module.icon,
          route: module.route,
          accessedAt: r.accessedAt,
        };
      })
      .slice(0, 10);

    // Populate smart groups
    const finalNodes = this.populateSmartGroups(
      resolvedNodes,
      favorites,
      recentModules,
      modules
    );

    return {
      profileId: profile.id,
      profileSlug: profile.slug,
      profileName: profile.name,
      nodes: finalNodes,
      favorites,
      recentModules,
    };
  }

  // === Private Helper Methods ===

  private async loadFromTemplate(
    tenantId: string,
    profile: TenantNavProfile
  ): Promise<TenantNavProfileItem[]> {
    const templateRepo = await this.tenantDbService.getRepository<NavTemplate>(
      tenantId,
      NavTemplate
    );
    const template = await templateRepo.findOne({
      where: { key: profile.templateKey!, isActive: true },
    });

    if (!template) {
      this.logger.warn(`Template ${profile.templateKey} not found, falling back to profile items`);
      return this.loadProfileItems(tenantId, profile.id);
    }

    // Convert template structure to NavProfileItems
    return this.convertTemplateToItems(template.navStructure || [], profile.id);
  }

  private convertTemplateToItems(
    nodes: any[],
    profileId: string,
    parentId?: string,
    order = 0
  ): TenantNavProfileItem[] {
    const items: TenantNavProfileItem[] = [];

    for (const node of nodes) {
      const item = new TenantNavProfileItem();
      item.id = `template-${node.key}`; // Temporary ID
      item.navProfileId = profileId;
      item.key = node.key;
      item.label = node.label;
      item.icon = node.icon;
      item.type = this.mapTemplateType(node.type);
      item.moduleKey = node.moduleKey;
      item.url = node.url;
      item.parentId = parentId;
      item.order = node.order ?? order++;
      item.visibility = node.visibility;
      item.contextTags = node.contextTags;
      item.isVisible = true;

      if (node.type === 'smart_group') {
        item.smartGroupType = node.smartGroupType;
      }

      items.push(item);

      // Process children
      if (node.children?.length) {
        const childItems = this.convertTemplateToItems(
          node.children,
          profileId,
          item.id,
          0
        );
        items.push(...childItems);
      }
    }

    return items;
  }

  private mapTemplateType(type: string): NavItemType {
    switch (type) {
      case 'group':
        return NavItemType.GROUP;
      case 'module':
        return NavItemType.MODULE;
      case 'link':
        return NavItemType.LINK;
      case 'separator':
        return NavItemType.SEPARATOR;
      case 'smart_group':
        return NavItemType.SMART_GROUP;
      default:
        return NavItemType.LINK;
    }
  }

  private async loadProfileItems(
    tenantId: string,
    profileId: string
  ): Promise<TenantNavProfileItem[]> {
    const itemRepo = await this.tenantDbService.getRepository<TenantNavProfileItem>(
      tenantId,
      TenantNavProfileItem
    );

    return itemRepo.find({
      where: { navProfileId: profileId },
      order: { order: 'ASC' },
    });
  }

  private async applyPatches(
    tenantId: string,
    profileId: string,
    nodes: TenantNavProfileItem[]
  ): Promise<TenantNavProfileItem[]> {
    const patchRepo = await this.tenantDbService.getRepository<NavPatch>(tenantId, NavPatch);
    const patches = await patchRepo.find({
      where: { navProfileId: profileId, isActive: true },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });

    if (!patches.length) {
      return nodes;
    }

    // Create a map for quick lookup
    const nodeMap = new Map<string, TenantNavProfileItem>();
    for (const node of nodes) {
      if (node.key) {
        nodeMap.set(node.key, node);
      }
    }

    // Apply patches in order
    for (const patch of patches) {
      this.applyPatch(nodeMap, nodes, patch);
    }

    return nodes;
  }

  private applyPatch(
    nodeMap: Map<string, TenantNavProfileItem>,
    nodes: TenantNavProfileItem[],
    patch: NavPatch
  ): void {
    const targetNode = nodeMap.get(patch.targetNodeKey);

    switch (patch.operation) {
      case NavPatchOperation.HIDE:
        if (targetNode) {
          targetNode.isVisible = false;
        }
        break;

      case NavPatchOperation.SHOW:
        if (targetNode) {
          targetNode.isVisible = true;
        }
        break;

      case NavPatchOperation.RENAME:
        if (targetNode && patch.payload?.label) {
          targetNode.label = patch.payload.label as string;
        }
        break;

      case NavPatchOperation.SET_ICON:
        if (targetNode && patch.payload?.icon) {
          targetNode.icon = patch.payload.icon as string;
        }
        break;

      case NavPatchOperation.SET_VISIBILITY:
        if (targetNode && patch.payload?.visibility) {
          targetNode.visibility = patch.payload.visibility as any;
        }
        break;

      case NavPatchOperation.REORDER:
        if (targetNode && typeof patch.payload?.position === 'number') {
          targetNode.order = patch.payload.position;
        }
        break;

      case NavPatchOperation.MOVE:
        if (targetNode && patch.payload?.newParentKey) {
          const newParent = nodeMap.get(patch.payload.newParentKey as string);
          if (newParent) {
            targetNode.parentId = newParent.id;
          }
        }
        break;

      case NavPatchOperation.INSERT:
        if (patch.payload?.nodeDefinition) {
          const newNode = this.createNodeFromDefinition(
            patch.payload.nodeDefinition as any,
            patch.targetNodeKey,
            nodeMap
          );
          nodes.push(newNode);
          if (newNode.key) {
            nodeMap.set(newNode.key, newNode);
          }
        }
        break;

      // Other operations can be added as needed
    }
  }

  private createNodeFromDefinition(
    def: any,
    parentKey: string,
    nodeMap: Map<string, TenantNavProfileItem>
  ): TenantNavProfileItem {
    const parent = nodeMap.get(parentKey);
    const node = new TenantNavProfileItem();
    node.id = `patch-${def.key}-${Date.now()}`;
    node.key = def.key;
    node.label = def.label;
    node.icon = def.icon;
    node.type = this.mapTemplateType(def.type);
    node.moduleKey = def.moduleKey;
    node.url = def.url;
    node.parentId = parent?.id;
    node.visibility = def.visibility;
    node.contextTags = def.contextTags;
    node.isVisible = true;
    node.order = 999; // Will be sorted
    return node;
  }

  private collectModuleKeys(nodes: TenantNavProfileItem[]): string[] {
    const keys: string[] = [];
    for (const node of nodes) {
      if (node.moduleKey) {
        keys.push(node.moduleKey);
      }
    }
    return [...new Set(keys)];
  }

  private resolveNodes(
    items: TenantNavProfileItem[],
    modules: Map<string, ResolvedModule>,
    context: VisibilityContext
  ): ResolvedNavNode[] {
    // Build tree structure
    const rootItems = items.filter((i) => !i.parentId);
    const childMap = new Map<string, TenantNavProfileItem[]>();

    for (const item of items) {
      if (item.parentId) {
        const existing = childMap.get(item.parentId) || [];
        existing.push(item);
        childMap.set(item.parentId, existing);
      }
    }

    return this.resolveNodeTree(rootItems, childMap, modules, context);
  }

  private resolveNodeTree(
    items: TenantNavProfileItem[],
    childMap: Map<string, TenantNavProfileItem[]>,
    modules: Map<string, ResolvedModule>,
    context: VisibilityContext
  ): ResolvedNavNode[] {
    const result: ResolvedNavNode[] = [];

    for (const item of items.sort((a, b) => a.order - b.order)) {
      // Check visibility
      if (!item.isVisible) continue;
      if (!this.visibilityService.isVisible(item.visibility, context)) continue;
      if (!this.visibilityService.matchesContextTags(item.contextTags, context.contextTags)) continue;

      // Resolve module if referenced
      const module = item.moduleKey ? modules.get(item.moduleKey) : null;
      if (item.moduleKey && module) {
        // Check module visibility too
        if (!this.visibilityService.isVisible(module.security, context)) continue;
      }

      const node: ResolvedNavNode = {
        key: item.key || item.id,
        label: item.label,
        icon: item.icon || module?.icon,
        type: this.mapItemTypeToNodeType(item.type),
        route: module?.route,
        url: item.url || module?.url,
        moduleKey: item.moduleKey,
      };

      if (item.type === NavItemType.SMART_GROUP) {
        node.smartGroupType = item.smartGroupType;
      }

      // Process children
      const children = childMap.get(item.id);
      if (children?.length) {
        node.children = this.resolveNodeTree(children, childMap, modules, context);
      }

      result.push(node);
    }

    return result;
  }

  private mapItemTypeToNodeType(type: NavItemType): ResolvedNavNode['type'] {
    switch (type) {
      case NavItemType.GROUP:
        return 'group';
      case NavItemType.MODULE:
      case NavItemType.TABLE:
      case NavItemType.FORM:
      case NavItemType.REPORT:
      case NavItemType.DASHBOARD:
        return 'module';
      case NavItemType.LINK:
        return 'link';
      case NavItemType.SEPARATOR:
        return 'separator';
      case NavItemType.SMART_GROUP:
        return 'smart_group';
      default:
        return 'link';
    }
  }

  private populateSmartGroups(
    nodes: ResolvedNavNode[],
    favorites: string[],
    recentModules: { key: string; label: string; icon?: string; route?: string; accessedAt: string }[],
    modules: Map<string, ResolvedModule>
  ): ResolvedNavNode[] {
    // Recursively populate smart groups
    for (const node of nodes) {
      if (node.type === 'smart_group') {
        node.smartGroupItems = this.getSmartGroupItems(
          node.smartGroupType!,
          favorites,
          recentModules,
          modules
        );
      }

      if (node.children?.length) {
        node.children = this.populateSmartGroups(
          node.children,
          favorites,
          recentModules,
          modules
        );
      }
    }

    return nodes;
  }

  private getSmartGroupItems(
    type: 'favorites' | 'recent' | 'frequent',
    favorites: string[],
    recentModules: { key: string; label: string; icon?: string; route?: string; accessedAt: string }[],
    modules: Map<string, ResolvedModule>
  ): ResolvedNavNode[] {
    switch (type) {
      case 'favorites':
        // Get favorite modules
        const favModules = favorites
          .map((key) => modules.get(key))
          .filter((m): m is ResolvedModule => !!m);

        return favModules.map((m) => ({
          key: m.key,
          label: m.label,
          icon: m.icon,
          type: 'module' as const,
          route: m.route,
          moduleKey: m.key,
        }));

      case 'recent':
        return recentModules.slice(0, 10).map((r) => ({
          key: r.key,
          label: r.label,
          icon: r.icon,
          type: 'module' as const,
          route: r.route,
          moduleKey: r.key,
        }));

      case 'frequent':
        // Would need to load frequency data - simplified for now
        return recentModules.slice(0, 5).map((r) => ({
          key: r.key,
          label: r.label,
          icon: r.icon,
          type: 'module' as const,
          route: r.route,
          moduleKey: r.key,
        }));

      default:
        return [];
    }
  }

  private calculateSearchScore(
    module: ResolvedModule,
    query: string,
    index: number
  ): number {
    const queryLower = query.toLowerCase();
    const labelLower = module.label.toLowerCase();
    const keyLower = module.key.toLowerCase();

    let score = 100 - index; // Base score decreases with index

    // Exact match bonus
    if (labelLower === queryLower) score += 100;
    if (keyLower === queryLower) score += 90;

    // Starts with bonus
    if (labelLower.startsWith(queryLower)) score += 50;
    if (keyLower.startsWith(queryLower)) score += 40;

    // Word match bonus
    if (labelLower.includes(queryLower)) score += 20;
    if (keyLower.includes(queryLower)) score += 15;

    return score;
  }
}
