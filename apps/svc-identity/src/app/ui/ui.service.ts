import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NavProfile, NavProfileItem } from '@hubblewave/instance-db';

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


@Injectable()
export class UiService {
  constructor(
    @InjectRepository(NavProfile)
    private readonly navProfileRepo: Repository<NavProfile>,
    @InjectRepository(NavProfileItem)
    private readonly navProfileItemRepo: Repository<NavProfileItem>,
  ) {}

  async getTheme(): Promise<ThemeResponse> {
    return FALLBACK_THEME;
  }

  async updateTheme(payload?: Partial<ThemeResponse>, _userId?: string): Promise<ThemeResponse> {
    return {
      variant: payload?.variant ?? FALLBACK_THEME.variant,
      tokens: { ...FALLBACK_THEME.tokens, ...(payload?.tokens ?? {}) },
    };
  }

  private buildNavigationFromItems(items: Partial<NavProfileItem>[]): NavigationResponse {
    const visibleItems = (items ?? []).filter((i) => i.isVisible !== false);
    const bySection: Record<string, NavItem[]> = {};

    visibleItems.forEach((item) => {
      const meta = item.metadata as Record<string, any> || {};
      const section = meta.section || 'Other';
      if (!bySection[section]) bySection[section] = [];
      bySection[section].push({
        code: item.code ?? '',
        label: item.label ?? item.code ?? '',
        icon: item.icon ?? 'Circle',
        path: meta.path,
        section,
        order: (item as any).position ?? (item as any).sortOrder ?? (item as any).order,
        pinned: meta.pinned,
        visible: item.isVisible,
      });
    });

    const sections: NavSection[] = Object.entries(bySection).map(([name, sectionItems]) => ({
      name,
      items: sectionItems.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    }));

    const bottomNav = visibleItems
      .filter((i) => (i.metadata as any)?.pinned)
      .sort((a, b) => ((a as any).position ?? 999) - ((b as any).position ?? 999))
      .slice(0, 4)
      .map((i) => {
        const meta = i.metadata as Record<string, any> || {};
        return { code: i.code ?? '', label: i.label ?? i.code ?? '', icon: i.icon ?? 'Circle', path: meta.path };
      });

    return { sections, bottomNav };
  }

  /**
   * Get navigation from the database.
   * Returns the default profile's navigation items.
   */
  async getNavigation(): Promise<NavigationResponse> {
    try {
      // Find the default navigation profile
      const profile = await this.navProfileRepo.findOne({
        where: { isDefault: true },
      });

      console.log('[UiService] getNavigation - profile:', profile?.id, profile?.name);

      if (!profile) {
        // No profile configured - return empty navigation
        console.log('[UiService] getNavigation - no default profile found');
        return { sections: [], bottomNav: [] };
      }

      // Get all items for this profile
      const items = await this.navProfileItemRepo.find({
        where: { profileId: profile.id },
        order: { position: 'ASC' },
      });

      console.log('[UiService] getNavigation - found', items.length, 'items');

      return this.buildNavigationFromItems(items);
    } catch (error) {
      console.error('[UiService] getNavigation - error:', error);
      throw error;
    }
  }

  async updateNavigation(
    payload?: Partial<NavigationResponse> & { items?: Partial<NavProfileItem> & { section?: string; pinned?: boolean; visible?: boolean; order?: number }[] },
  ): Promise<NavigationResponse> {
    if (!payload) return this.getNavigation();

    let profile = await this.navProfileRepo.findOne({
      where: { isDefault: true },
    });

    if (!profile) {
      profile = this.navProfileRepo.create({ isDefault: true, name: 'Default Navigation' });
      profile = await this.navProfileRepo.save(profile);
    }

    let items: NavProfileItem[] = await this.navProfileItemRepo.find({ where: { profileId: profile.id } });

    if (payload.items) {
      await this.navProfileItemRepo.delete({ profileId: profile.id });
      const toSave = payload.items.map((item: any, idx: number) => {
        const metadata: Record<string, any> = {
            section: item.section,
            pinned: item.pinned,
        };
        return this.navProfileItemRepo.create({
          profileId: profile.id,
          code: item.code ?? '',
          label: item.label,
          type: 'link', // Default type
          position: item.order ?? idx,
          isVisible: item.visible ?? true,
          icon: item.icon,
          metadata,
        });
      });
      items = await this.navProfileItemRepo.save(toSave);
    }

    return this.buildNavigationFromItems(items);
  }
}
