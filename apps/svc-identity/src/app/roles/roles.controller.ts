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
  UseGuards,
} from '@nestjs/common';
import { RoleService, CreateRoleDto, UpdateRoleDto, RoleListOptions } from './role.service';
import { UserRoleService } from './user-role.service';
import { PermissionResolverService } from './permission-resolver.service';
import { RequirePermission } from './decorators/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';

interface UserContext {
  userId: string;
  email?: string;
}

/**
 * Roles Controller
 *
 * Admin endpoints for managing roles and role assignments.
 */
@Controller('admin/roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(
    private readonly roleService: RoleService,
    private readonly userRoleService: UserRoleService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  /**
   * List all roles with optional filters
   */
  @Get()
  @RequirePermission('roles.view')
  @UseGuards(PermissionGuard)
  async listRoles(
    @Query('search') search?: string,
    @Query('parentId') parentId?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('isSystem') isSystem?: string,
    @Query('isDefault') isDefault?: string,
  ) {
    const options: RoleListOptions = {
      search: search || undefined,
      parentId: parentId === undefined ? undefined : parentId || null,
      includeInactive: includeInactive === 'true',
      isSystem: isSystem === undefined ? undefined : isSystem === 'true',
      isDefault: isDefault === undefined ? undefined : isDefault === 'true',
    };

    const roles = await this.roleService.listRoles(options);
    return { data: roles, total: roles.length };
  }

  /**
   * Get role hierarchy as tree
   */
  @Get('hierarchy')
  @RequirePermission('roles.view')
  @UseGuards(PermissionGuard)
  async getRoleHierarchy() {
    const hierarchy = await this.roleService.getRoleHierarchy();
    return { data: hierarchy };
  }

  /**
   * Get role by ID
   */
  @Get(':id')
  @RequirePermission('roles.view')
  @UseGuards(PermissionGuard)
  async getRole(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const role = await this.roleService.getRoleById(id);
    return { data: role };
  }

  /**
   * Create a new role
   */
  @Post()
  @RequirePermission('roles.create')
  @UseGuards(PermissionGuard)
  async createRole(
    @CurrentUser() user: UserContext,
    @Body() body: CreateRoleDto,
  ) {
    const created = await this.roleService.createRole(body, user?.userId);
    return { data: created };
  }

  /**
   * Update role
   */
  @Put(':id')
  @RequirePermission('roles.update')
  @UseGuards(PermissionGuard)
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserContext,
    @Body() body: UpdateRoleDto,
  ) {
    const updated = await this.roleService.updateRole(id, body, user?.userId);
    return { data: updated };
  }

  /**
   * Delete role
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('roles.delete')
  @UseGuards(PermissionGuard)
  async deleteRole(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.roleService.deleteRole(id);
  }

  /**
   * Get effective permissions for role (direct + inherited)
   */
  @Get(':id/permissions')
  @RequirePermission('roles.view')
  @UseGuards(PermissionGuard)
  async getRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { direct, inherited } = await this.roleService.getRoleEffectivePermissions(id);

    return {
      data: {
        direct,
        inherited,
        total: direct.length + inherited.length,
      },
    };
  }

  /**
   * Set permissions for role (replace all)
   */
  @Put(':id/permissions')
  @RequirePermission('roles.update')
  @UseGuards(PermissionGuard)
  async setRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { permissions: string[] },
  ) {
    await this.roleService.setRolePermissions(id, body.permissions || []);
    const { direct, inherited } = await this.roleService.getRoleEffectivePermissions(id);
    return { data: { direct, inherited } };
  }

  /**
   * Add permissions to role
   */
  @Post(':id/permissions')
  @RequirePermission('roles.update')
  @UseGuards(PermissionGuard)
  async addRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { permissions: string[] },
  ) {
    await this.roleService.addRolePermissions(id, body.permissions || []);
    const { direct, inherited } = await this.roleService.getRoleEffectivePermissions(id);
    return { data: { direct, inherited } };
  }

  /**
   * Remove permissions from role
   */
  @Delete(':id/permissions')
  @RequirePermission('roles.update')
  @UseGuards(PermissionGuard)
  async removeRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { permissions: string[] },
  ) {
    await this.roleService.removeRolePermissions(id, body.permissions || []);
    const { direct, inherited } = await this.roleService.getRoleEffectivePermissions(id);
    return { data: { direct, inherited } };
  }

  /**
   * Get users assigned to a role
   */
  @Get(':id/users')
  @RequirePermission('roles.view')
  @UseGuards(PermissionGuard)
  async getRoleUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const assignments = await this.userRoleService.getRoleUsers(
      id,
      includeExpired === 'true',
    );

    return {
      data: assignments,
      total: assignments.length,
    };
  }

  /**
   * Remove role from user
   */
  @Delete(':id/users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('users.assign-roles')
  @UseGuards(PermissionGuard)
  async removeRoleFromUser(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.userRoleService.removeRole(userId, roleId);
  }

  /**
   * Get roles for a specific user
   */
  @Get('user/:userId')
  @RequirePermission('users.view')
  @UseGuards(PermissionGuard)
  async getUserRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const assignments = await this.userRoleService.getUserRoles(
      userId,
      includeExpired === 'true',
    );

    return {
      data: assignments,
      total: assignments.length,
    };
  }

  /**
   * Get effective permissions for a user
   */
  @Get('user/:userId/permissions')
  @RequirePermission('users.view')
  @UseGuards(PermissionGuard)
  async getUserPermissions(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const cache = await this.permissionResolver.getUserPermissions(userId);

    return {
      data: {
        permissions: Array.from(cache.permissions),
        roles: cache.roles.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.code,
          color: r.color,
        })),
        computedAt: cache.computedAt,
      },
    };
  }

  /**
   * Test if a user has a specific permission
   */
  @Post('user/:userId/check-permission')
  @RequirePermission('users.view')
  @UseGuards(PermissionGuard)
  async checkUserPermission(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: { permission: string },
  ) {
    const result = await this.permissionResolver.hasPermission(userId, body.permission);

    return { data: result };
  }

  /**
   * Get my roles (current user) - primarily for single-instance deployments
   */
  @Get('me/roles')
  async getMyRoles(@Query('userId') userId: string) {
    const assignments = await this.userRoleService.getUserRoles(userId);
    return {
      data: assignments,
      total: assignments.length,
    };
  }

  /**
   * Get my permissions (current user)
   */
  @Get('me/permissions')
  async getMyPermissions(@Query('userId') userId: string) {
    const cache = await this.permissionResolver.getUserPermissions(userId);

    return {
      data: {
        permissions: Array.from(cache.permissions),
        roles: cache.roles.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.code,
          color: r.color,
        })),
      },
    };
  }

  /**
   * Check if I have a specific permission
   */
  @Get('me/check/:permission')
  async checkMyPermission(
    @Query('userId') userId: string,
    @Param('permission') permission: string,
  ) {
    const result = await this.permissionResolver.hasPermission(
      userId,
      permission,
    );

    return { data: result };
  }
}
