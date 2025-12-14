import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import {
  TenantUserService,
  TenantUserListQuery,
} from './tenant-user.service';
import { TenantUserStatus } from '@eam-platform/tenant-db';

// DTOs for API
class CreateUserBody {
  email!: string;
  displayName!: string;
  employeeId?: string;
  title?: string;
  department?: string;
  location?: string;
  managerId?: string;
  workPhone?: string;
  mobilePhone?: string;
  locale?: string;
  timeZone?: string;
  isTenantAdmin?: boolean;
  roleIds?: string[];
  groupIds?: string[];
  sendInvitation?: boolean;
  personalMessage?: string;
  metadata?: Record<string, unknown>;
}

class UpdateUserBody {
  displayName?: string;
  employeeId?: string;
  title?: string;
  department?: string;
  location?: string;
  costCenter?: string;
  managerId?: string | null;
  workPhone?: string;
  mobilePhone?: string;
  avatarUrl?: string;
  locale?: string;
  timeZone?: string;
  isTenantAdmin?: boolean;
  metadata?: Record<string, unknown>;
}

class ListUsersQuery {
  q?: string;
  status?: TenantUserStatus | TenantUserStatus[];
  department?: string;
  managerId?: string;
  roleId?: string;
  groupId?: string;
  isTenantAdmin?: string;
  includeDeleted?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

class DeactivateBody {
  reason?: string;
}

class SuspendBody {
  reason!: string;
  expiresAt?: string;
}

class AssignRolesBody {
  roleIds!: string[];
}

class AssignGroupsBody {
  groupIds!: string[];
}

class ActivateBody {
  token!: string;
  password?: string;
}

@Controller('tenant-users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantUserController {
  constructor(private readonly tenantUserService: TenantUserService) {}

  /**
   * Create/invite a new user
   */
  @Post()
  @Roles('admin', 'tenant_admin', 'user_admin')
  async createUser(@Request() req: any, @Body() body: CreateUserBody) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    const result = await this.tenantUserService.createUser(tenantId, body, actorId);
    return {
      user: result.tenantUser,
      isNewPlatformUser: result.isNewPlatformUser,
    };
  }

  /**
   * List users with filters
   */
  @Get()
  async listUsers(@Request() req: any, @Query() query: ListUsersQuery) {
    const tenantId = req.user.tenantId;
    const listQuery: TenantUserListQuery = {
      q: query.q,
      status: query.status,
      department: query.department,
      managerId: query.managerId,
      roleId: query.roleId,
      groupId: query.groupId,
      isTenantAdmin: query.isTenantAdmin === 'true' ? true : query.isTenantAdmin === 'false' ? false : undefined,
      includeDeleted: query.includeDeleted === 'true',
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
    return this.tenantUserService.listUsers(tenantId, listQuery);
  }

  /**
   * Get current user's tenant profile
   */
  @Get('me')
  async getCurrentUser(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const userAccountId = req.user.sub;
    return this.tenantUserService.getUserByAccountId(tenantId, userAccountId);
  }

  /**
   * Get user by ID
   */
  @Get(':id')
  async getUser(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const tenantId = req.user.tenantId;
    return this.tenantUserService.getUserById(tenantId, id);
  }

  /**
   * Update user profile
   */
  @Patch(':id')
  async updateUser(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserBody,
  ) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    return this.tenantUserService.updateUser(tenantId, id, body, actorId);
  }

  /**
   * Delete user (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async deleteUser(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    await this.tenantUserService.deleteUser(tenantId, id, actorId);
  }

  /**
   * Activate user with token (public endpoint)
   */
  @Post('activate')
  @Public()
  @HttpCode(HttpStatus.OK)
  async activateUser(
    @Query('tenant') tenantSlug: string,
    @Body() body: ActivateBody,
  ) {
    // Resolve tenant from slug and activate user
    return this.tenantUserService.activateUserBySlug(tenantSlug, body.token, body.password);
  }

  /**
   * Deactivate user
   */
  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async deactivateUser(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeactivateBody,
  ) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    return this.tenantUserService.deactivateUser(tenantId, id, body.reason, actorId);
  }

  /**
   * Reactivate user
   */
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async reactivateUser(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    return this.tenantUserService.reactivateUser(tenantId, id, actorId);
  }

  /**
   * Suspend user
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async suspendUser(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SuspendBody,
  ) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    return this.tenantUserService.suspendUser(tenantId, id, body.reason, expiresAt, actorId);
  }

  /**
   * Unsuspend user
   */
  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async unsuspendUser(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    return this.tenantUserService.unsuspendUser(tenantId, id, actorId);
  }

  /**
   * Resend invitation email
   */
  @Post(':id/resend-invitation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async resendInvitation(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    await this.tenantUserService.resendInvitation(tenantId, id, actorId);
  }

  // Role management

  /**
   * Get user's roles
   */
  @Get(':id/roles')
  async getUserRoles(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const tenantId = req.user.tenantId;
    return this.tenantUserService.getUserRoles(tenantId, id);
  }

  /**
   * Assign roles to user
   */
  @Post(':id/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async assignRoles(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignRolesBody,
  ) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    await this.tenantUserService.assignRoles(tenantId, id, body.roleIds, actorId);
  }

  /**
   * Remove roles from user
   */
  @Delete(':id/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async removeRoles(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignRolesBody,
  ) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    await this.tenantUserService.removeRoles(tenantId, id, body.roleIds, actorId);
  }

  // Group management

  /**
   * Get user's groups
   */
  @Get(':id/groups')
  async getUserGroups(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const tenantId = req.user.tenantId;
    return this.tenantUserService.getUserGroups(tenantId, id);
  }

  /**
   * Add user to groups
   */
  @Post(':id/groups')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async addToGroups(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignGroupsBody,
  ) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    await this.tenantUserService.addToGroups(tenantId, id, body.groupIds, actorId);
  }

  /**
   * Remove user from groups
   */
  @Delete(':id/groups')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'tenant_admin', 'user_admin')
  async removeFromGroups(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignGroupsBody,
  ) {
    const tenantId = req.user.tenantId;
    const actorId = req.user.sub;
    await this.tenantUserService.removeFromGroups(tenantId, id, body.groupIds, actorId);
  }

  // Audit log

  /**
   * Get user's audit log
   */
  @Get(':id/audit')
  async getUserAuditLog(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tenantId = req.user.tenantId;
    return this.tenantUserService.getUserAuditLog(
      tenantId,
      id,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
