import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '@hubblewave/instance-db';
import { RequirePermission } from './decorators/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';

interface UserContext {
  id: string;
}

/**
 * DTO for creating a permission
 */
interface CreatePermissionDto {
  code: string;
  name: string;
  description?: string;
  category: string;
  resourceType?: string;
  actionType?: string;
  isDangerous?: boolean;
}

/**
 * DTO for updating a permission
 */
interface UpdatePermissionDto {
  name?: string;
  description?: string;
  category?: string;
  resourceType?: string;
  actionType?: string;
  isDangerous?: boolean;
}

/**
 * Permissions Controller
 *
 * Admin endpoints for managing permissions.
 */
@Controller('admin/permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  private readonly logger = new Logger(PermissionsController.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permRepo: Repository<Permission>,
  ) {}

  /**
   * List all permissions with optional filters
   */
  @Get()
  @RequirePermission('roles.view')
  @UseGuards(PermissionGuard)
  async listPermissions(
    @CurrentUser() _user: UserContext,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('resourceType') resourceType?: string,
    @Query('isSystem') isSystem?: string,
  ) {
    const query = this.permRepo.createQueryBuilder('perm');

    if (category) {
      query.andWhere('perm.category = :category', { category });
    }

    if (search) {
      query.andWhere(
        '(perm.name ILIKE :search OR perm.code ILIKE :search OR perm.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (resourceType) {
      query.andWhere('perm.resourceType = :resourceType', { resourceType });
    }

    if (isSystem !== undefined) {
      query.andWhere('perm.isSystem = :isSystem', { isSystem: isSystem === 'true' });
    }

    query.orderBy('perm.category', 'ASC')
      .addOrderBy('perm.name', 'ASC');

    const permissions = await query.getMany();

    // Group by category
    const byCategory = permissions.reduce<Record<string, Permission[]>>(
      (acc, perm) => {
        const cat = perm.category || 'uncategorized';
        if (!acc[cat]) {
          acc[cat] = [];
        }
        acc[cat].push(perm);
        return acc;
      },
      {},
    );

    return {
      data: permissions,
      byCategory,
      total: permissions.length,
    };
  }

  /**
   * Get distinct permission categories
   */
  @Get('categories')
  @RequirePermission('roles.view')
  @UseGuards(PermissionGuard)
  async getCategories(@CurrentUser() _user: UserContext) {
    const result = await this.permRepo
      .createQueryBuilder('perm')
      .select('DISTINCT perm.category', 'category')
      .where('perm.category IS NOT NULL')
      .orderBy('perm.category', 'ASC')
      .getRawMany();

    const categories = result.map((r) => r.category);

    // Add descriptions for standard categories
    const categoryInfo = categories.map((cat: string) => ({
      slug: cat,
      name: this.getCategoryName(cat),
      description: this.getCategoryDescription(cat),
    }));

    return { data: categoryInfo };
  }

  /**
   * Get permission by ID
   */
  @Get(':id')
  @RequirePermission('roles.view')
  @UseGuards(PermissionGuard)
  async getPermission(
    @CurrentUser() _user: UserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const permission = await this.permRepo.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found: ${id}`);
    }

    return { data: permission };
  }

  /**
   * Create new permission
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('admin.settings')
  @UseGuards(PermissionGuard)
  async createPermission(
    @CurrentUser() _user: UserContext,
    @Body() dto: CreatePermissionDto,
  ) {
    // Check for duplicate code
    const existing = await this.permRepo.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Permission with code "${dto.code}" already exists`);
    }

    const permission = this.permRepo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description,
      category: dto.category,
      resourceType: dto.resourceType,
      actionType: dto.actionType,
      isDangerous: dto.isDangerous ?? false,
      isSystem: false,
    });

    const saved = await this.permRepo.save(permission);

    this.logger.log(`Created permission: ${saved.name} (${saved.code})`);

    return { data: saved };
  }

  /**
   * Update permission
   */
  @Put(':id')
  @RequirePermission('admin.settings')
  @UseGuards(PermissionGuard)
  async updatePermission(
    @CurrentUser() _user: UserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    const permission = await this.permRepo.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found: ${id}`);
    }

    // System permissions can only have limited fields updated
    if (permission.isSystem) {
      if (dto.name !== undefined) permission.name = dto.name;
      if (dto.description !== undefined) permission.description = dto.description;
    } else {
      if (dto.name !== undefined) permission.name = dto.name;
      if (dto.description !== undefined) permission.description = dto.description;
      if (dto.category !== undefined) permission.category = dto.category;
      if (dto.resourceType !== undefined) permission.resourceType = dto.resourceType;
      if (dto.actionType !== undefined) permission.actionType = dto.actionType;
      if (dto.isDangerous !== undefined) permission.isDangerous = dto.isDangerous;
    }

    const saved = await this.permRepo.save(permission);

    this.logger.log(`Updated permission: ${saved.name} (${saved.id})`);

    return { data: saved };
  }

  /**
   * Delete permission
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('admin.settings')
  @UseGuards(PermissionGuard)
  async deletePermission(
    @CurrentUser() _user: UserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const permission = await this.permRepo.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found: ${id}`);
    }

    if (permission.isSystem) {
      throw new BadRequestException('Cannot delete system permission');
    }

    await this.permRepo.remove(permission);

    this.logger.log(`Deleted permission: ${permission.name} (${id})`);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private getCategoryName(slug: string): string {
    const names: Record<string, string> = {
      assets: 'Assets',
      'work-orders': 'Work Orders',
      users: 'Users',
      groups: 'Groups',
      roles: 'Roles',
      reports: 'Reports',
      admin: 'Administration',
      workflows: 'Workflows',
      collections: 'Collections',
      scripts: 'Scripts',
      audit: 'Audit',
      notifications: 'Notifications',
      integrations: 'Integrations',
    };
    return names[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  private getCategoryDescription(slug: string): string {
    const descriptions: Record<string, string> = {
      assets: 'Manage asset records and details',
      'work-orders': 'Manage work order lifecycle',
      users: 'User account management',
      groups: 'Group and team management',
      roles: 'Role and permission management',
      reports: 'Report access and creation',
      admin: 'System administration',
      workflows: 'Workflow design and execution',
      collections: 'Collection/table management',
      scripts: 'Script development and execution',
      audit: 'Audit log access',
      notifications: 'Notification management',
      integrations: 'External integrations',
    };
    return descriptions[slug] || `Permissions for ${slug}`;
  }
}
