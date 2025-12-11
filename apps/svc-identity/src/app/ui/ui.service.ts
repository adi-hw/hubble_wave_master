import { Injectable } from '@nestjs/common';
import { NavProfile, NavProfileItem } from '@eam-platform/platform-db';
import { ModuleEntity, TenantDbService } from '@eam-platform/tenant-db';

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
    // Single-tenant: return static theme
    return FALLBACK_THEME;
  }

  async updateTheme(_tenantId: string, payload: Partial<ThemeResponse>, _userId?: string): Promise<ThemeResponse> {
    // No-op; return merged with fallback
    return {
      variant: payload.variant ?? FALLBACK_THEME.variant,
      tokens: { ...FALLBACK_THEME.tokens, ...(payload.tokens ?? {}) },
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

  async getNavigation(tenantId?: string): Promise<NavigationResponse> {
    // If no tenantId (unauthenticated user), return fallback navigation
    if (!tenantId) {
      return FALLBACK_NAV;
    }

    try {
      // New source of truth: modules table
      const modulesRepo = await this.tenantDbService.getRepository<ModuleEntity>(tenantId, ModuleEntity as any);
      const modules = await modulesRepo.find({
        order: { sortOrder: 'ASC', name: 'ASC' },
      });

      if (!modules.length) {
        return FALLBACK_NAV;
      }

      const items = modules.map((m) => ({
        code: m.slug || m.route || m.name.toLowerCase(),
        label: m.name,
        icon: m.icon || 'Circle',
      }));

      return {
        sections: [{ name: 'Modules', items }],
        bottomNav: items.slice(0, 4),
      };
    } catch (error) {
      // If tenant DB access fails, return fallback
      return FALLBACK_NAV;
    }
  }

  async updateNavigation(
    tenantId: string,
    payload: Partial<NavigationResponse> & { items?: Partial<NavProfileItem>[] },
  ): Promise<NavigationResponse> {
    if (!tenantId) return FALLBACK_NAV;

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
