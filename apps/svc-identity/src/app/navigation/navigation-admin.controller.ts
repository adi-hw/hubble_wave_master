import { Controller, Get, Post, Body, Param, Delete, Patch, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NavProfile, NavNode, NavPatch } from '@hubblewave/instance-db';
import { CreateNavProfileDto, UpdateNavProfileDto, CreateNavNodeDto, UpdateNavNodeDto } from './dto/navigation.dto';

@Controller('admin/navigation')
export class NavigationAdminController {
  constructor(
    @InjectRepository(NavProfile)
    private readonly profileRepo: Repository<NavProfile>,
    @InjectRepository(NavNode)
    private readonly nodeRepo: Repository<NavNode>,
    @InjectRepository(NavPatch)
    private readonly patchRepo: Repository<NavPatch>,
  ) {}

  // === Profiles ===

  @Get('profiles')
  async getProfiles() {
    return this.profileRepo.find({ order: { name: 'ASC' } });
  }

  @Get('profiles/:id')
  async getProfile(@Param('id') id: string) {
    const profile = await this.profileRepo.findOneBy({ id });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  @Post('profiles')
  async createProfile(@Body() dto: CreateNavProfileDto) {
    const profile = this.profileRepo.create({
      ...dto as any, // Cast to any to handle DTO mapping mismatch
      isActive: true,
      autoAssignRoles: dto.autoAssignRoles,
      // Default scope to 'role' if not provided, just in case
      scope: 'role', 
      code: dto.slug, // Map slug to code
    });
    return this.profileRepo.save(profile);
  }

  @Patch('profiles/:id')
  async updateProfile(@Param('id') id: string, @Body() dto: UpdateNavProfileDto) {
    const profile = await this.getProfile(id);
    
    // Map DTO specific fields
    if (dto.autoAssignRoles !== undefined) profile.autoAssignRoles = dto.autoAssignRoles;
    if (dto.autoAssignExpression !== undefined) profile.autoAssignExpression = dto.autoAssignExpression;
    if (dto.isDefault !== undefined) profile.isDefault = dto.isDefault;
    if (dto.isActive !== undefined) profile.isActive = dto.isActive;
    if (dto.name !== undefined) profile.name = dto.name;
    if (dto.description !== undefined) profile.description = dto.description;

    return this.profileRepo.save(profile);
  }

  @Delete('profiles/:id')
  async deleteProfile(@Param('id') id: string) {
     await this.profileRepo.delete(id);
  }

  // === Nodes ===

  @Get('nodes/:profileId')
  async getNodes(@Param('profileId') profileId: string) {
    const nodes = await this.nodeRepo.find({
      where: { profileId: profileId },
      order: { order: 'ASC' }
    });
    
    // Build tree
    return this.buildTree(nodes);
  }

  @Post('nodes/:profileId')
  async createNode(@Param('profileId') profileId: string, @Body() dto: CreateNavNodeDto) {
    // Determine parent_id from parentKey if provided, or null
    let parentId: string | undefined;
    if (dto.parentKey) {
       const parent = await this.nodeRepo.findOneBy({ profileId: profileId, key: dto.parentKey });
       if (parent) parentId = parent.id;
    }

    const node = this.nodeRepo.create({
      profileId: profileId,
      key: dto.key,
      label: dto.label,
      icon: dto.icon,
      type: dto.type,
      moduleKey: dto.moduleKey,
      url: dto.url,
      parentId: parentId, // Use resolved parentId
      order: dto.order ?? 0,
      isVisible: true,
      visibility: dto.visibility as any,
      contextTags: dto.contextTags,
    });
    return this.nodeRepo.save(node);
  }

  @Patch('nodes/:profileId/:nodeId')
  async updateNode(
    @Param('profileId') profileId: string, 
    @Param('nodeId') nodeId: string, 
    @Body() dto: UpdateNavNodeDto
  ) {
    const node = await this.nodeRepo.findOneBy({ id: nodeId, profileId: profileId });
    if (!node) throw new NotFoundException('Node not found');

    if (dto.label !== undefined) node.label = dto.label;
    if (dto.icon !== undefined) node.icon = dto.icon;
    if (dto.moduleKey !== undefined) node.moduleKey = dto.moduleKey;
    if (dto.url !== undefined) node.url = dto.url;
    // Handle parent update
    if (dto.parentKey !== undefined) {
      if (!dto.parentKey) {
          node.parentId = null as any; // Move to root (cast for TS strict null checks)
      } else {
          // Prevent self-parenting circular ref (basic check)
          if (dto.parentKey === node.key) {
             // Ignore or throw? For safety, ignore self-parenting
          } else {
             const parent = await this.nodeRepo.findOneBy({ profileId: profileId, key: dto.parentKey });
             if (parent) node.parentId = parent.id;
          }
      }
    }
    if (dto.order !== undefined) node.order = dto.order;
    if (dto.isVisible !== undefined) node.isVisible = dto.isVisible;
    if (dto.visibility !== undefined) node.visibility = dto.visibility as any;
    // Context tags mismatch in DTO?
    if (dto.contextTags !== undefined) node.contextTags = dto.contextTags;

    return this.nodeRepo.save(node);
  }

  @Delete('nodes/:profileId/:nodeId')
  async deleteNode(@Param('profileId') profileId: string, @Param('nodeId') nodeId: string) {
    await this.nodeRepo.delete({ id: nodeId, profileId: profileId });
  }

  @Post('nodes/:profileId/reorder')
  async reorderNodes(@Param('profileId') profileId: string, @Body() body: { orders: { nodeId: string; order: number; parentKey?: string }[] }) {
      const { orders } = body;
      
      // Bulk update is risky without transactions, doing loop for simplicity now
      for (const item of orders) {
          const updateData: any = { order: item.order };
          
          if (item.parentKey !== undefined) {
             // Resolve new parent
             if (item.parentKey === null) {
                 updateData.parentId = null;
             } else {
                 const parent = await this.nodeRepo.findOneBy({ profileId: profileId, key: item.parentKey });
                 if (parent) updateData.parentId = parent.id;
             }
          }
          
          await this.nodeRepo.update({ id: item.nodeId, profileId: profileId }, updateData);
      }
  }

  // === Patches ===
  
  // Implementation stub for patches
  @Get('patches/:profileId')
  async getPatches(@Param('profileId') profileId: string) {
      return this.patchRepo.find({ where: { profileId: profileId }, order: { priority: 'DESC' } });
  }

  // === Modules ===

  @Get('modules')
  getModules() {
    return [
       { key: 'studio.tables', label: 'Tables', type: 'list', icon: 'Database', applicationKey: 'Studio' },
       { key: 'studio.scripts', label: 'Scripts', type: 'list', icon: 'FileCode', applicationKey: 'Studio' },
       { key: 'studio.process-flows', label: 'Process Flows', type: 'list', icon: 'GitBranch', applicationKey: 'Studio' },
       { key: 'admin.users', label: 'Users & Roles', type: 'list', icon: 'Users', applicationKey: 'Admin' },
       { key: 'admin.groups', label: 'Groups', type: 'list', icon: 'Users', applicationKey: 'Admin' },
       { key: 'asset.list', label: 'Asset List', type: 'list', icon: 'Package' },
       { key: 'work_order.list', label: 'Work Orders', type: 'list', icon: 'ClipboardList' },
    ];
  }


  // === Preview ===

  @Post('preview/:profileId')
  async preview(@Param('profileId') profileId: string) {
      // Basic preview implementation:
      // 1. Fetch all nodes for the profile
      const nodes = await this.nodeRepo.find({
          where: { profileId: profileId },
          order: { order: 'ASC' }
      });
      
      // 2. Build the tree
      const rootNodes = this.buildTree(nodes);

      // 3. Apply visibility filter
      const filterNodes = (list: NavNode[]): any[] => {
          return list
              .filter(n => n.isVisible) // Basic check
              .map(n => ({
                  key: n.key,
                  label: n.label,
                  icon: n.icon,
                  type: n.type,
                  route: n.url || (n.moduleKey ? `/${n.moduleKey.replace('.', '/')}` : undefined),
                  children: n.children ? filterNodes(n.children) : [],
              }));
      };

      return {
          nodes: filterNodes(rootNodes)
      };
  }

  // Helper
  private buildTree(nodes: NavNode[]): NavNode[] {
    const nodeMap = new Map<string, NavNode>();
    const roots: NavNode[] = [];

    // First pass: map nodes
    nodes.forEach(node => {
        node.children = [];
        nodeMap.set(node.id, node);
    });

    // Second pass: link numbers
    nodes.forEach(node => {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
  }
}
