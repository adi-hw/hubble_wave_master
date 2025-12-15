import { Injectable } from '@nestjs/common';
import { NavProfile, NavProfileItem } from '@eam-platform/platform-db';
import { ModuleEntity, ModuleType, Application, TenantDbService } from '@eam-platform/tenant-db';

interface ThemeTokens {
  [key: string]: string | number;
}

interface ThemeResponse {
  variant: string;
  tokens: ThemeTokens;
}

interface NavItem {
  code: string;
  label: string;
  icon: string;
  section?: string;
  pinned?: boolean;
  visible?: boolean;
  order?: number;
  path?: string;
}

interface NavSection {
  name: string;
  items: NavItem[];
}

interface NavigationResponse {
  sections: NavSection[];
  bottomNav: NavItem[];
}

const FALLBACK_THEME: ThemeResponse = {
  variant: 'glass-dock',
  tokens: {
    'color.primary': '#0ea5e9',
    'color.accent': '#6366f1',
    'color.bg': '#020617',
    'color.surface': 'rgba(15,23,42,0.9)',
    'radius.sm': 10,
    'radius.lg': 18,
    'shadow.level': 'soft',
    'glass.opacity': 0.18,
    'glass.blur': 18,
  },
};

const FALLBACK_NAV: NavigationResponse = {
  sections: [
    {
      name: 'Modules',
      items: [
        { code: 'assets', label: 'Assets', icon: 'Package' },
      ],
    },
  ],
  bottomNav: [
    { code: 'assets', label: 'Assets', icon: 'Package' },
    { code: 'more', label: 'More', icon: 'Ellipsis' },
  ],
};

@Injectable()
export class UiService {
  constructor(
    private readonly tenantDbService: TenantDbService,
  ) {}

  async getTheme(_tenantId: string): Promise<ThemeResponse> {
    // Single-tenant: return static theme (tenantId available for future customization)
    return FALLBACK_THEME;
  }

  async updateTheme(_tenantId: string, payload?: Partial<ThemeResponse>, _userId?: string): Promise<ThemeResponse> {
    // No-op; return merged with fallback
    return {
      variant: payload?.variant ?? FALLBACK_THEME.variant,
      tokens: { ...FALLBACK_THEME.tokens, ...(payload?.tokens ?? {}) },
    };
  }

  private buildNavigationFromItems(items: Partial<NavProfileItem>[]): NavigationResponse {
    const visibleItems = (items ?? []).filter((i) => i.visible !== false);
    const bySection: Record<string, NavItem[]> = {};

    visibleItems.forEach((item) => {
      const section = item.section || 'Other';
      if (!bySection[section]) bySection[section] = [];
      bySection[section].push({
        code: item.code ?? '',
        label: item.label ?? item.code ?? '',
        icon: item.icon ?? 'Circle',
        section,
        order: (item as any).sortOrder ?? (item as any).order,
        pinned: item.pinned,
        visible: item.visible,
      });
    });

    const sections: NavSection[] = Object.entries(bySection).map(([name, sectionItems]) => ({
      name,
      items: sectionItems.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    }));

    const bottomNav = visibleItems
      .filter((i) => i.pinned)
      .sort((a, b) => ((a as any).sortOrder ?? (a as any).order ?? 999) - ((b as any).sortOrder ?? (b as any).order ?? 999))
      .slice(0, 4)
      .map((i) => ({ code: i.code ?? '', label: i.label ?? i.code ?? '', icon: i.icon ?? 'Circle' }));

    return { sections, bottomNav: bottomNav.length ? bottomNav : FALLBACK_NAV.bottomNav };
  }

  /**
   * System/configuration tables that should route to Studio pages
   * instead of the generic list view
   */
  private readonly STUDIO_TABLE_ROUTES: Record<string, string> = {
    'applications': '/studio/applications',
    'modules': '/studio/modules',
    'workflow_definitions': '/studio/workflows',
    'business_rules': '/studio/business-rules',
    'platform_scripts': '/studio/scripts',
    'form_definitions': '/studio/forms',
    'view_definitions': '/studio/views',
    'collection_definitions': '/studio/collections',
    'property_definitions': '/studio/properties',
    'approval_types': '/studio/approvals',
    'notification_templates': '/studio/notifications',
    'event_definitions': '/studio/events',
  };

  /**
   * Build the route path based on module type and target configuration
   * Similar to ServiceNow's module link types
   */
  private buildModulePath(module: ModuleEntity): string {
    const config = module.targetConfig;

    switch (module.type) {
      case ModuleType.LIST:
        // List view - points to a table
        if (config?.table) {
          // Check if this is a system table that should route to Studio
          const studioRoute = this.STUDIO_TABLE_ROUTES[config.table];
          if (studioRoute) {
            return studioRoute;
          }
          return `/${config.table}.list`;
        }
        if (config?.route) {
          return config.route;
        }
        // Fallback to slug-based route - also check for studio routes
        const slugStudioRoute = this.STUDIO_TABLE_ROUTES[module.slug];
        if (slugStudioRoute) {
          return slugStudioRoute;
        }
        return `/${module.slug}.list`;

      case ModuleType.RECORD:
        // Single record view
        if (config?.table) {
          return `/${config.table}.form`;
        }
        return config?.route || `/${module.slug}.form`;

      case ModuleType.DASHBOARD:
        // Dashboard view
        return config?.route || `/dashboard/${module.slug}`;

      case ModuleType.REPORT:
        // Report view
        return config?.route || `/report/${module.slug}`;

      case ModuleType.URL:
        // External URL - handled separately in frontend
        return config?.url || '#';

      case ModuleType.WIZARD:
        // Multi-step wizard
        return config?.route || `/wizard/${module.slug}`;

      case ModuleType.FORM:
        // Standalone form
        return config?.route || `/form/${module.slug}`;

      case ModuleType.CUSTOM:
        // Custom component
        return config?.route || `/${module.slug}`;

      default:
        // Default to list if route specified, otherwise slug-based
        return config?.route || module.route || `/${module.slug}.list`;
    }
  }

  async getNavigation(tenantId: string): Promise<NavigationResponse> {
    try {
      // ServiceNow-style navigation: Read from applications and modules tables
      let applications: Application[] = [];
      let modules: ModuleEntity[] = [];

      try {
        const appRepo = await this.tenantDbService.getRepository<Application>(tenantId, Application as any);
        applications = await appRepo.find({
          where: { isActive: true },
          order: { sortOrder: 'ASC', label: 'ASC' },
        });
      } catch (appError) {
        // Applications table may not exist yet - this is OK
        console.warn('Could not fetch applications:', appError instanceof Error ? appError.message : appError);
      }

      try {
        const moduleRepo = await this.tenantDbService.getRepository<ModuleEntity>(tenantId, ModuleEntity as any);
        modules = await moduleRepo.find({
          where: { isActive: true },
          order: { sortOrder: 'ASC', name: 'ASC' },
        });
      } catch (modError) {
        // Modules table may not exist yet - this is OK
        console.warn('Could not fetch modules:', modError instanceof Error ? modError.message : modError);
      }

      // If no applications/modules exist, return fallback with Studio
      if (applications.length === 0 && modules.length === 0) {
        return this.getDefaultNavigation();
      }

      // Group modules by applicationKey
      const modulesByApp = new Map<string, ModuleEntity[]>();
      const ungroupedModules: ModuleEntity[] = [];

      modules.forEach((mod) => {
        if (mod.applicationKey) {
          const existing = modulesByApp.get(mod.applicationKey) || [];
          existing.push(mod);
          modulesByApp.set(mod.applicationKey, existing);
        } else {
          ungroupedModules.push(mod);
        }
      });

      // Build sections from applications
      const sections: NavSection[] = [];

      // Add application sections
      applications.forEach((app) => {
        const appModules = modulesByApp.get(app.key) || [];
        if (appModules.length > 0) {
          sections.push({
            name: app.label,
            items: appModules.map((mod) => ({
              code: mod.key || mod.slug,
              label: mod.label || mod.name,
              icon: mod.icon || 'Circle',
              path: this.buildModulePath(mod),
            })),
          });
        }
      });

      // Add ungrouped modules as "Other" section
      if (ungroupedModules.length > 0) {
        sections.push({
          name: 'Other',
          items: ungroupedModules.map((mod) => ({
            code: mod.key || mod.slug,
            label: mod.label || mod.name,
            icon: mod.icon || 'Circle',
            path: this.buildModulePath(mod),
          })),
        });
      }

      // Always add Studio section for platform administration
      sections.unshift({
        name: 'Studio',
        items: [
          { code: 'studio-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/studio' },
          { code: 'tables', label: 'Tables', icon: 'Database', path: '/studio/tables' },
          { code: 'applications', label: 'Applications', icon: 'AppWindow', path: '/studio/applications' },
          { code: 'modules', label: 'Modules', icon: 'LayoutGrid', path: '/studio/modules' },
          { code: 'scripts', label: 'Scripts', icon: 'FileCode', path: '/studio/scripts' },
          { code: 'business-rules', label: 'Business Rules', icon: 'Shield', path: '/studio/business-rules' },
          { code: 'workflows', label: 'Workflows', icon: 'GitBranch', path: '/studio/workflows' },
        ],
      });

      // Build bottom nav from first few modules across all sections (excluding Studio)
      const allModuleItems = sections
        .filter((s) => s.name !== 'Studio')
        .flatMap((s) => s.items);
      const bottomNav = allModuleItems.slice(0, 3).concat([
        { code: 'more', label: 'More', icon: 'Ellipsis' },
      ]);

      return { sections, bottomNav };
    } catch (error) {
      console.error('Failed to fetch navigation:', error);
      return this.getDefaultNavigation();
    }
  }

  /**
   * Default navigation when no applications/modules are configured
   */
  private getDefaultNavigation(): NavigationResponse {
    return {
      sections: [
        {
          name: 'Studio',
          items: [
            { code: 'studio-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/studio' },
            { code: 'tables', label: 'Tables', icon: 'Database', path: '/studio/tables' },
            { code: 'applications', label: 'Applications', icon: 'AppWindow', path: '/studio/applications' },
            { code: 'modules', label: 'Modules', icon: 'LayoutGrid', path: '/studio/modules' },
            { code: 'scripts', label: 'Scripts', icon: 'FileCode', path: '/studio/scripts' },
            { code: 'business-rules', label: 'Business Rules', icon: 'Shield', path: '/studio/business-rules' },
            { code: 'workflows', label: 'Workflows', icon: 'GitBranch', path: '/studio/workflows' },
          ],
        },
      ],
      bottomNav: [
        { code: 'studio-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/studio' },
        { code: 'tables', label: 'Tables', icon: 'Database', path: '/studio/tables' },
        { code: 'more', label: 'More', icon: 'Ellipsis' },
      ],
    };
  }

  async updateNavigation(
    tenantId: string,
    payload?: Partial<NavigationResponse> & { items?: Partial<NavProfileItem>[] },
  ): Promise<NavigationResponse> {
    if (!payload) return this.getNavigation(tenantId);

    const navProfileRepo = await this.tenantDbService.getRepository<NavProfile>(tenantId, NavProfile as any);
    const navProfileItemRepo = await this.tenantDbService.getRepository<NavProfileItem>(tenantId, NavProfileItem as any);

    let profile = await navProfileRepo.findOne({
      where: { tenantId: tenantId, isDefault: true },
    });

    if (!profile) {
      profile = navProfileRepo.create({ tenantId: tenantId, isDefault: true, name: 'Default Navigation' });
      profile = await navProfileRepo.save(profile);
    }

    let items: NavProfileItem[] = await navProfileItemRepo.find({ where: { profileId: profile.id } });

    if (payload.items) {
      await navProfileItemRepo.delete({ profileId: profile.id });
      const toSave = payload.items.map((item, idx) =>
        navProfileItemRepo.create({
          profileId: profile.id,
          code: item.code ?? '',
          label: item.label,
          section: item.section,
          sortOrder: (item as any).order ?? (item as any).sortOrder ?? idx,
          visible: item.visible ?? true,
          pinned: item.pinned ?? false,
          icon: item.icon,
        }),
      );
      items = await navProfileItemRepo.save(toSave);
    }

    return this.buildNavigationFromItems(items);
  }
}
