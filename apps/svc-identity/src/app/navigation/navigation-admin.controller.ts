/**
 * NavigationAdminController - Admin endpoints for navigation management
 *
 * Provides CRUD operations for:
 * - Navigation profiles
 * - Navigation nodes
 * - Navigation patches
 * - Preview functionality
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TenantNavProfile,
  TenantNavProfileItem,
  NavPatch,
  ModuleEntity,
} from '@eam-platform/tenant-db';
import {
  CreateNavProfileDto,
  UpdateNavProfileDto,
  CreateNavNodeDto,
  UpdateNavNodeDto,
  CreateNavPatchDto,
  PreviewNavigationDto,
  ResolvedNavigation,
} from './dto/navigation.dto';
import { NavigationResolutionService, NavigationUser } from './navigation-resolution.service';
import { NavigationCacheService } from './navigation-cache.service';

interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email: string;
    tenantId?: string;
    membershipId?: string;
    roles?: string[];
    permissions?: string[];
  };
}

@ApiTags('Navigation Admin')
@ApiBearerAuth()
@Controller('admin/navigation')
@Roles('tenant_admin')
export class NavigationAdminController {
  constructor(
    @InjectRepository(TenantNavProfile)
    private readonly profileRepo: Repository<TenantNavProfile>,
    @InjectRepository(TenantNavProfileItem)
    private readonly nodeRepo: Repository<TenantNavProfileItem>,
    @InjectRepository(NavPatch)
    private readonly patchRepo: Repository<NavPatch>,
    @InjectRepository(ModuleEntity)
    private readonly moduleRepo: Repository<ModuleEntity>,
    private readonly navigationService: NavigationResolutionService,
    private readonly cacheService: NavigationCacheService
  ) {}

  // === Profiles ===

  @Get('profiles')
  @ApiOperation({ summary: 'List all navigation profiles' })
  @ApiResponse({ status: 200, description: 'List of profiles' })
  async getProfiles(@Req() _req: AuthenticatedRequest) {
    const profiles = await this.profileRepo.find({
      order: { isDefault: 'DESC', name: 'ASC' },
    });

    return profiles.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      templateKey: p.templateKey,
      autoAssignRoles: p.autoAssignRoles,
      autoAssignExpression: p.autoAssignExpression,
      isDefault: p.isDefault,
      isActive: p.isActive,
      isLocked: p.isLocked,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  @Get('profiles/:id')
  @ApiOperation({ summary: 'Get a navigation profile' })
  @ApiResponse({ status: 200, description: 'Profile details' })
  async getProfile(@Param('id') id: string) {
    const profile = await this.profileRepo.findOneOrFail({ where: { id } });
    return profile;
  }

  @Post('profiles')
  @ApiOperation({ summary: 'Create a navigation profile' })
  @ApiResponse({ status: 201, description: 'Profile created' })
  async createProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateNavProfileDto
  ) {
    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.profileRepo.update({}, { isDefault: false });
    }

    const profile = this.profileRepo.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      templateKey: dto.templateKey,
      autoAssignRoles: dto.autoAssignRoles,
      isDefault: dto.isDefault ?? false,
      isActive: true,
      isLocked: false,
      createdBy: req.user?.sub,
      updatedBy: req.user?.sub,
    });

    const saved = await this.profileRepo.save(profile);
    this.cacheService.invalidateTenantNavigation(req.user?.tenantId || '');
    return saved;
  }

  @Patch('profiles/:id')
  @ApiOperation({ summary: 'Update a navigation profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateNavProfileDto
  ) {
    const profile = await this.profileRepo.findOneOrFail({ where: { id } });

    if (profile.isLocked) {
      throw new Error('Cannot modify locked profile');
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.profileRepo.update({}, { isDefault: false });
    }

    Object.assign(profile, {
      ...dto,
      updatedBy: req.user?.sub,
    });

    const saved = await this.profileRepo.save(profile);
    this.cacheService.invalidateProfileNavigation(req.user?.tenantId || '', id);
    return saved;
  }

  @Delete('profiles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a navigation profile' })
  @ApiResponse({ status: 204, description: 'Profile deleted' })
  async deleteProfile(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const profile = await this.profileRepo.findOneOrFail({ where: { id } });

    if (profile.isLocked) {
      throw new Error('Cannot delete locked profile');
    }

    if (profile.isDefault) {
      throw new Error('Cannot delete default profile');
    }

    // Delete associated nodes and patches
    await this.nodeRepo.delete({ navProfileId: id });
    await this.patchRepo.delete({ navProfileId: id });
    await this.profileRepo.remove(profile);

    this.cacheService.invalidateTenantNavigation(req.user?.tenantId || '');
  }

  // === Nodes ===

  @Get('nodes/:profileId')
  @ApiOperation({ summary: 'Get navigation nodes for a profile' })
  @ApiResponse({ status: 200, description: 'List of nodes' })
  async getNodes(@Param('profileId') profileId: string) {
    const nodes = await this.nodeRepo.find({
      where: { navProfileId: profileId },
      order: { order: 'ASC' },
    });

    // Build tree structure
    const nodeMap = new Map<string, any>();
    const rootNodes: any[] = [];

    for (const node of nodes) {
      const nodeData = {
        id: node.id,
        key: node.key,
        label: node.label,
        icon: node.icon,
        type: node.type.toLowerCase(),
        moduleKey: node.moduleKey,
        url: (node.metadata as any)?.url,
        parentId: node.parentId,
        parentKey: node.parentId ? nodes.find((n) => n.id === node.parentId)?.key : undefined,
        order: node.order,
        isVisible: node.isVisible,
        visibility: node.visibility,
        contextTags: node.contextTags,
        smartGroupType: (node.metadata as any)?.smartGroupType,
        children: [],
      };
      nodeMap.set(node.id, nodeData);
    }

    // Build tree
    for (const node of nodeMap.values()) {
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  @Post('nodes/:profileId')
  @ApiOperation({ summary: 'Create a navigation node' })
  @ApiResponse({ status: 201, description: 'Node created' })
  async createNode(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Body() dto: CreateNavNodeDto
  ) {
    // Find parent if specified
    let parentId: string | undefined;
    if (dto.parentKey) {
      const parent = await this.nodeRepo.findOne({
        where: { navProfileId: profileId, key: dto.parentKey },
      });
      parentId = parent?.id;
    }

    // Map type to enum
    const typeMap: Record<string, string> = {
      group: 'GROUP',
      module: 'MODULE',
      link: 'LINK',
      separator: 'SEPARATOR',
      smart_group: 'SMART_GROUP',
    };

    const node = this.nodeRepo.create({
      navProfileId: profileId,
      key: dto.key,
      label: dto.label,
      icon: dto.icon,
      type: typeMap[dto.type] || 'MODULE',
      moduleKey: dto.moduleKey,
      parentId,
      order: dto.order ?? 0,
      isVisible: true,
      visibility: dto.visibility,
      contextTags: dto.contextTags,
      metadata: dto.url ? { url: dto.url } : undefined,
      createdBy: req.user?.sub,
      updatedBy: req.user?.sub,
    } as any);

    const saved = await this.nodeRepo.save(node);
    this.cacheService.invalidateProfileNavigation(req.user?.tenantId || '', profileId);
    return saved;
  }

  @Patch('nodes/:profileId/:nodeId')
  @ApiOperation({ summary: 'Update a navigation node' })
  @ApiResponse({ status: 200, description: 'Node updated' })
  async updateNode(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateNavNodeDto
  ) {
    const node = await this.nodeRepo.findOneOrFail({
      where: { id: nodeId, navProfileId: profileId },
    });

    Object.assign(node, {
      label: dto.label ?? node.label,
      icon: dto.icon ?? node.icon,
      moduleKey: dto.moduleKey ?? node.moduleKey,
      order: dto.order ?? node.order,
      isVisible: dto.isVisible ?? node.isVisible,
      visibility: dto.visibility ?? node.visibility,
      contextTags: dto.contextTags ?? node.contextTags,
      metadata: dto.url ? { ...(node.metadata as any), url: dto.url } : node.metadata,
      updatedBy: req.user?.sub,
    });

    const saved = await this.nodeRepo.save(node);
    this.cacheService.invalidateProfileNavigation(req.user?.tenantId || '', profileId);
    return saved;
  }

  @Delete('nodes/:profileId/:nodeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a navigation node' })
  @ApiResponse({ status: 204, description: 'Node deleted' })
  async deleteNode(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Param('nodeId') nodeId: string
  ) {
    const node = await this.nodeRepo.findOneOrFail({
      where: { id: nodeId, navProfileId: profileId },
    });

    // Delete children first
    await this.nodeRepo.delete({ parentId: nodeId });
    await this.nodeRepo.remove(node);

    this.cacheService.invalidateProfileNavigation(req.user?.tenantId || '', profileId);
  }

  @Post('nodes/:profileId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder navigation nodes' })
  @ApiResponse({ status: 200, description: 'Nodes reordered' })
  async reorderNodes(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Body() body: { orders: { nodeId: string; order: number; parentKey?: string }[] }
  ) {
    for (const item of body.orders) {
      let parentId: string | undefined;
      if (item.parentKey) {
        const parent = await this.nodeRepo.findOne({
          where: { navProfileId: profileId, key: item.parentKey },
        });
        parentId = parent?.id;
      }

      await this.nodeRepo.update(item.nodeId, {
        order: item.order,
        parentId: parentId || null,
      } as any);
    }

    this.cacheService.invalidateProfileNavigation(req.user?.tenantId || '', profileId);
    return { success: true };
  }

  // === Patches ===

  @Get('patches/:profileId')
  @ApiOperation({ summary: 'Get navigation patches for a profile' })
  @ApiResponse({ status: 200, description: 'List of patches' })
  async getPatches(@Param('profileId') profileId: string) {
    const patches = await this.patchRepo.find({
      where: { navProfileId: profileId },
      order: { priority: 'ASC' },
    });

    return patches.map((p) => ({
      id: p.id,
      operation: p.operation,
      targetNodeKey: p.targetNodeKey,
      payload: p.payload,
      priority: p.priority,
      description: p.description,
      isActive: p.isActive,
      createdAt: p.createdAt,
    }));
  }

  @Post('patches/:profileId')
  @ApiOperation({ summary: 'Create a navigation patch' })
  @ApiResponse({ status: 201, description: 'Patch created' })
  async createPatch(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Body() dto: CreateNavPatchDto
  ) {
    const patch = this.patchRepo.create({
      navProfileId: profileId,
      operation: dto.operation,
      targetNodeKey: dto.targetNodeKey,
      payload: dto.payload,
      priority: dto.priority ?? 0,
      description: dto.description,
      isActive: true,
      createdBy: req.user?.sub,
    } as any);

    const saved = await this.patchRepo.save(patch);
    this.cacheService.invalidateProfileNavigation(req.user?.tenantId || '', profileId);
    return saved;
  }

  @Patch('patches/:profileId/:patchId')
  @ApiOperation({ summary: 'Update a navigation patch' })
  @ApiResponse({ status: 200, description: 'Patch updated' })
  async updatePatch(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Param('patchId') patchId: string,
    @Body() dto: Partial<CreateNavPatchDto>
  ) {
    const patch = await this.patchRepo.findOneOrFail({
      where: { id: patchId, navProfileId: profileId },
    });

    Object.assign(patch, dto);
    const saved = await this.patchRepo.save(patch);
    this.cacheService.invalidateProfileNavigation(req.user?.tenantId || '', profileId);
    return saved;
  }

  @Delete('patches/:profileId/:patchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a navigation patch' })
  @ApiResponse({ status: 204, description: 'Patch deleted' })
  async deletePatch(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Param('patchId') patchId: string
  ) {
    const patch = await this.patchRepo.findOneOrFail({
      where: { id: patchId, navProfileId: profileId },
    });

    await this.patchRepo.remove(patch);
    this.cacheService.invalidateProfileNavigation(req.user?.tenantId || '', profileId);
  }

  // === Preview ===

  @Post('preview/:profileId')
  @ApiOperation({ summary: 'Preview navigation with specific context' })
  @ApiResponse({ status: 200, description: 'Preview result' })
  async preview(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Body() dto: PreviewNavigationDto
  ): Promise<ResolvedNavigation> {
    // Create a mock user with the specified context
    const mockUser: NavigationUser = {
      userId: req.user?.sub || '',
      membershipId: req.user?.membershipId || '',
      tenantId: req.user?.tenantId || '',
      roles: dto.roles || [],
      permissions: dto.permissions || [],
    };

    // Override the profile selection
    return this.navigationService.resolveNavigationForProfile(
      mockUser,
      profileId,
      dto.featureFlags || [],
      dto.contextTags || []
    );
  }

  // === Modules (for picker) ===

  @Get('modules')
  @ApiOperation({ summary: 'Get available modules for navigation' })
  @ApiResponse({ status: 200, description: 'List of modules' })
  async getModules() {
    const modules = await this.moduleRepo.find({
      where: { isActive: true },
      order: { applicationKey: 'ASC', label: 'ASC' },
    });

    return modules.map((m) => ({
      key: m.key,
      label: m.label,
      description: m.description,
      icon: m.icon,
      type: m.type.toLowerCase(),
      applicationKey: m.applicationKey,
    }));
  }

  // === Templates ===

  @Get('templates')
  @ApiOperation({ summary: 'Get available navigation templates' })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async getTemplates() {
    // For now, return a static list of templates
    // In production, this would come from NavTemplate entity
    return [
      { key: 'default_eam', name: 'Default EAM', description: 'Standard EAM navigation' },
      { key: 'minimal', name: 'Minimal', description: 'Minimal navigation for simple setups' },
      { key: 'full', name: 'Full Featured', description: 'All modules enabled' },
    ];
  }
}
