import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NavProfile, NavNode } from '@hubblewave/instance-db';
import { ResolvedNavigation, ResolvedNavNode, NavProfileSummary } from './dto/navigation.dto';

interface UserContext {
  userId?: string;
  roles?: string[];
  permissions?: string[];
}

@Injectable()
export class NavigationResolutionService {
  constructor(
    @InjectRepository(NavProfile)
    private readonly profileRepo: Repository<NavProfile>,
    @InjectRepository(NavNode)
    private readonly nodeRepo: Repository<NavNode>,
    // NavPatch repository for future patch application
    // @InjectRepository(NavPatch)
    // private readonly patchRepo: Repository<NavPatch>,
  ) {}

  /**
   * Resolve navigation for a user (or default)
   */
  async resolveNavigation(_userContext: UserContext = {}): Promise<ResolvedNavigation> {
    // 1. Determine active profile
    // For now, load the default profile or the first active one
    let profile = await this.profileRepo.findOne({ 
      where: { isDefault: true, isActive: true } 
    });

    if (!profile) {
      // Fallback: first active profile
      profile = await this.profileRepo.findOne({ 
        where: { isActive: true },
        order: { name: 'ASC' }
      });
    }

    if (!profile) {
      // Emergency fallback if no profiles exist
      return this.getEmptyNavigation();
    }

    // 2. Fetch nodes
    const nodes = await this.nodeRepo.find({
      where: { profileId: profile.id },
      order: { order: 'ASC' }
    });

    // 3. Build Tree
    const rootNodes = this.buildTree(nodes);

    // 4. Transform to ResolvedNavNode
    // TODO: Apply visibility rules, patches, etc.
    const resolvedNodes = rootNodes.map(n => this.mapToResolved(n));

    return {
      profileId: profile.id,
      profileSlug: profile.code,
      profileName: profile.name,
      nodes: resolvedNodes,
      favorites: [], // TODO: Load user favorites
      recentModules: [],
    };
  }

  /**
   * Get available profiles for switching
   */
  async getAvailableProfiles(): Promise<NavProfileSummary[]> {
    const profiles = await this.profileRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' }
    });

    return profiles.map(p => ({
      id: p.id,
      slug: p.code,
      name: p.name,
      description: p.description ?? undefined,
      isActive: p.isActive,
      isDefault: p.isDefault,
    }));
  }

  // === Helpers ===

  private getEmptyNavigation(): ResolvedNavigation {
    return {
      profileId: 'empty',
      profileSlug: 'empty',
      profileName: 'No Profile',
      nodes: [],
      favorites: [],
      recentModules: [],
    };
  }

  private buildTree(nodes: NavNode[]): NavNode[] {
    const nodeMap = new Map<string, NavNode>();
    const roots: NavNode[] = [];

    nodes.forEach(node => {
      node.children = [];
      nodeMap.set(node.id, node);
    });

    nodes.forEach(node => {
      // If parentId exists and is in map, add to children
      // We must cast parentId to string because we fixed the nullable type issue in controller but entity might still have it as string|null
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  private mapToResolved(node: NavNode): ResolvedNavNode {
    // For module/link types, default moduleKey to the node's key if not set
    const isNavigableType = ['module', 'link', 'table', 'form', 'report', 'dashboard'].includes(node.type);
    const moduleKey = node.moduleKey || (isNavigableType ? node.key : undefined);

    return {
      key: node.key,
      label: node.label,
      icon: node.icon,
      type: node.type as any,
      moduleKey,
      url: node.url,
      route: node.url || (moduleKey ? `/${moduleKey.replace('.', '/')}` : undefined),
      children: node.children?.length ? node.children.map(c => this.mapToResolved(c)) : [],
    };
  }
}
