/**
 * LegacyAdapterService
 *
 * Converts between V2 navigation format and legacy format for backward compatibility.
 * This allows gradual migration of tenants from the old navigation system.
 */

import { Injectable } from '@nestjs/common';
import { ResolvedNavNode, ResolvedNavigation } from './dto/navigation.dto';

/**
 * Legacy navigation item
 */
export interface LegacyNavItem {
  code: string;
  label: string;
  icon: string;
  path?: string;
}

/**
 * Legacy navigation section
 */
export interface LegacyNavSection {
  name: string;
  items: LegacyNavItem[];
}

/**
 * Legacy navigation response
 */
export interface LegacyNavigationResponse {
  sections: LegacyNavSection[];
  bottomNav: LegacyNavItem[];
}

@Injectable()
export class LegacyAdapterService {
  // Logger available for future use
  // private readonly logger = new Logger(LegacyAdapterService.name);

  /**
   * Convert V2 resolved navigation to legacy format
   */
  toV1(navigation: ResolvedNavigation): LegacyNavigationResponse {
    const sections: LegacyNavSection[] = [];
    const bottomNav: LegacyNavItem[] = [];

    // Process each top-level node
    for (const node of navigation.nodes) {
      if (node.type === 'group') {
        // Convert group to section
        const section = this.convertGroupToSection(node);
        if (section.items.length > 0) {
          sections.push(section);
        }
      } else if (node.type === 'module' || node.type === 'link') {
        // Top-level modules go to a default section
        const item = this.convertNodeToItem(node);
        if (item) {
          // Add to a "Modules" section
          let modulesSection = sections.find((s) => s.name === 'Modules');
          if (!modulesSection) {
            modulesSection = { name: 'Modules', items: [] };
            sections.push(modulesSection);
          }
          modulesSection.items.push(item);
        }
      }
    }

    // Generate bottom nav from first few items
    const allItems = sections.flatMap((s) => s.items);
    for (const item of allItems.slice(0, 4)) {
      bottomNav.push(item);
    }

    // Add "More" item if there are more items
    if (allItems.length > 4) {
      bottomNav.push({
        code: 'more',
        label: 'More',
        icon: 'Ellipsis',
      });
    }

    return { sections, bottomNav };
  }

  /**
   * Convert legacy navigation to V2 format
   */
  toV2(legacy: LegacyNavigationResponse): ResolvedNavigation {
    const nodes: ResolvedNavNode[] = legacy.sections.map((section) => ({
      key: `section-${section.name.toLowerCase().replace(/\s+/g, '-')}`,
      label: section.name,
      type: 'group' as const,
      children: section.items.map((item) => ({
        key: item.code,
        label: item.label,
        icon: item.icon,
        type: 'module' as const,
        route: item.path ?? `/${item.code}.list`,
        moduleKey: item.code,
      })),
    }));

    return {
      profileId: 'legacy',
      profileSlug: 'legacy',
      profileName: 'Default',
      nodes,
      favorites: [],
      recentModules: [],
    };
  }

  /**
   * Convert a group node to a legacy section
   */
  private convertGroupToSection(node: ResolvedNavNode): LegacyNavSection {
    const items: LegacyNavItem[] = [];

    if (node.children) {
      for (const child of node.children) {
        const item = this.convertNodeToItem(child);
        if (item) {
          items.push(item);
        }
      }
    }

    return {
      name: node.label,
      items,
    };
  }

  /**
   * Convert a nav node to a legacy item
   */
  private convertNodeToItem(node: ResolvedNavNode): LegacyNavItem | null {
    // Skip separators and smart groups
    if (node.type === 'separator' || node.type === 'smart_group') {
      return null;
    }

    return {
      code: node.key,
      label: node.label,
      icon: node.icon || 'Circle',
      path: node.route || node.url,
    };
  }
}
