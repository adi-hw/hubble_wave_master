import { Injectable, Logger } from '@nestjs/common';
import {
  TenantDbService,
  ModuleEntity,
  ModuleType,
  ModuleTargetConfig,
  ModuleSecurity,
} from '@eam-platform/tenant-db';

/**
 * Resolved module with all necessary information for navigation
 */
export interface ResolvedModule {
  key: string;
  label: string;
  icon?: string;
  type: ModuleType;
  route?: string;
  url?: string;
  targetConfig?: ModuleTargetConfig;
  security?: ModuleSecurity;
  applicationKey?: string;
  isActive: boolean;
}

/**
 * ModuleRegistryService - Manages module lookups and resolution
 *
 * Modules are reusable navigation destinations. This service provides:
 * - Lookup by key
 * - Bulk lookup for efficiency
 * - Route resolution based on module type and target config
 */
@Injectable()
export class ModuleRegistryService {
  private readonly logger = new Logger(ModuleRegistryService.name);

  constructor(private readonly tenantDbService: TenantDbService) {}

  /**
   * Get a single module by key
   */
  async getModuleByKey(tenantId: string, moduleKey: string): Promise<ResolvedModule | null> {
    try {
      const repo = await this.tenantDbService.getRepository<ModuleEntity>(tenantId, ModuleEntity);
      const module = await repo.findOne({
        where: { key: moduleKey, isActive: true },
      });

      if (!module) {
        return null;
      }

      return this.resolveModule(module);
    } catch (error) {
      this.logger.error(`Failed to get module ${moduleKey}`, error);
      return null;
    }
  }

  /**
   * Get multiple modules by keys (batch lookup)
   */
  async getModulesByKeys(tenantId: string, moduleKeys: string[]): Promise<Map<string, ResolvedModule>> {
    const result = new Map<string, ResolvedModule>();

    if (!moduleKeys.length) {
      return result;
    }

    try {
      const repo = await this.tenantDbService.getRepository<ModuleEntity>(tenantId, ModuleEntity);
      const modules = await repo
        .createQueryBuilder('m')
        .where('m.key IN (:...keys)', { keys: moduleKeys })
        .andWhere('m.is_active = true')
        .getMany();

      for (const module of modules) {
        if (module.key) {
          result.set(module.key, this.resolveModule(module));
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get modules by keys`, error);
    }

    return result;
  }

  /**
   * Get all active modules for an application
   */
  async getModulesByApplication(tenantId: string, applicationKey: string): Promise<ResolvedModule[]> {
    try {
      const repo = await this.tenantDbService.getRepository<ModuleEntity>(tenantId, ModuleEntity);
      const modules = await repo.find({
        where: { applicationKey, isActive: true },
        order: { sortOrder: 'ASC' },
      });

      return modules.map((m) => this.resolveModule(m));
    } catch (error) {
      this.logger.error(`Failed to get modules for application ${applicationKey}`, error);
      return [];
    }
  }

  /**
   * Get all active modules
   */
  async getAllModules(tenantId: string): Promise<ResolvedModule[]> {
    try {
      const repo = await this.tenantDbService.getRepository<ModuleEntity>(tenantId, ModuleEntity);
      const modules = await repo.find({
        where: { isActive: true },
        order: { applicationKey: 'ASC', sortOrder: 'ASC' },
      });

      return modules.map((m) => this.resolveModule(m));
    } catch (error) {
      this.logger.error(`Failed to get all modules`, error);
      return [];
    }
  }

  /**
   * Search modules by label or key
   */
  async searchModules(tenantId: string, query: string, limit = 20): Promise<ResolvedModule[]> {
    try {
      const repo = await this.tenantDbService.getRepository<ModuleEntity>(tenantId, ModuleEntity);
      const modules = await repo
        .createQueryBuilder('m')
        .where('m.is_active = true')
        .andWhere(
          '(LOWER(m.label) LIKE LOWER(:query) OR LOWER(m.key) LIKE LOWER(:query) OR LOWER(m.name) LIKE LOWER(:query))',
          { query: `%${query}%` }
        )
        .orderBy('m.sort_order', 'ASC')
        .limit(limit)
        .getMany();

      return modules.map((m) => this.resolveModule(m));
    } catch (error) {
      this.logger.error(`Failed to search modules`, error);
      return [];
    }
  }

  /**
   * Resolve a module entity to a ResolvedModule with computed route
   */
  private resolveModule(module: ModuleEntity): ResolvedModule {
    const route = this.computeRoute(module);

    return {
      key: module.key || module.slug,
      label: module.label || module.name,
      icon: module.icon,
      type: module.type || ModuleType.LIST,
      route,
      url: module.targetConfig?.url,
      targetConfig: module.targetConfig,
      security: module.security,
      applicationKey: module.applicationKey,
      isActive: module.isActive,
    };
  }

  /**
   * Compute the route for a module based on its type and configuration
   */
  private computeRoute(module: ModuleEntity): string | undefined {
    // Priority 1: Explicit route in targetConfig
    if (module.targetConfig?.route) {
      return module.targetConfig.route;
    }

    // Priority 2: Legacy route field
    if (module.route) {
      return module.route;
    }

    // Priority 3: Compute based on type and target
    const type = module.type || ModuleType.LIST;
    const table = module.targetConfig?.table;

    switch (type) {
      case ModuleType.LIST:
        if (table) {
          return `/tables/${table}`;
        }
        break;
      case ModuleType.RECORD:
        if (table) {
          // Record routes typically need an ID, return base path
          return `/tables/${table}`;
        }
        break;
      case ModuleType.FORM:
        if (table) {
          return `/tables/${table}/new`;
        }
        break;
      case ModuleType.DASHBOARD:
        return `/dashboards/${module.key || module.slug}`;
      case ModuleType.REPORT:
        return `/reports/${module.key || module.slug}`;
      case ModuleType.URL:
        // External URLs don't have internal routes
        return undefined;
      case ModuleType.CUSTOM:
        // Custom components use their slug as the route
        return `/${module.slug}`;
      case ModuleType.WIZARD:
        return `/wizards/${module.key || module.slug}`;
    }

    // Fallback to slug-based route
    return `/${module.slug}`;
  }
}
