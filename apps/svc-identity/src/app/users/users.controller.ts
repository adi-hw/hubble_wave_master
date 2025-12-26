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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UsersService,
  UserListOptions,
  UpdateUserDto,
  InviteUserDto,
} from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserStatus, AuthEvent } from '@hubblewave/instance-db';
import { UserRoleService } from '../roles/user-role.service';
import { MembershipService } from '../groups/membership.service';

interface UserContext {
  userId: string;
  email?: string;
}

/**
 * UsersController
 *
 * Admin endpoints for managing users.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userRoleService: UserRoleService,
    private readonly membershipService: MembershipService,
    @InjectRepository(AuthEvent)
    private readonly authEventRepo: Repository<AuthEvent>,
  ) {}

  // ==========================================================================
  // User List & Search
  // ==========================================================================

  /**
   * List users with pagination and filters
   */
  @Get()
  async listUsers(
    @Query('q') q?: string,
    @Query('status') status?: UserStatus,
    @Query('department') department?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const options: UserListOptions = {
      q,
      status,
      department,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      includeDeleted: includeDeleted === 'true',
    };

    return this.usersService.listUsers(options);
  }

  /**
   * Search users (simple endpoint for autocomplete)
   */
  @Get('search')
  async searchUsers(@Query('q') query: string) {
    return this.usersService.searchUsers(query || '');
  }

  // ==========================================================================
  // User CRUD
  // ==========================================================================

  /**
   * Get a single user by ID
   */
  @Get(':id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.getUserById(id);
    return { data: user };
  }

  /**
   * Get roles assigned to a user
   */
  @Get(':id/roles')
  async getUserRoles(@Param('id', ParseUUIDPipe) id: string) {
    // Verify user exists
    await this.usersService.getUserById(id);

    const userRoles = await this.userRoleService.getUserRoles(id);

    // Map to the expected response format
    const roles = userRoles
      .filter((ur) => ur.role)
      .map((ur) => ({
        id: ur.role!.id,
        name: ur.role!.name,
        slug: ur.role!.code, // Role entity uses 'code' as the slug
      }));

    return { data: roles };
  }

  /**
   * Get groups a user belongs to
   */
  @Get(':id/groups')
  async getUserGroups(@Param('id', ParseUUIDPipe) id: string) {
    // Verify user exists
    await this.usersService.getUserById(id);

    const memberships = await this.membershipService.getUserDirectGroups(id);

    // Map to the expected response format
    const groups = memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
    }));

    return { data: groups };
  }

  /**
   * Get audit log entries for a user
   */
  @Get(':id/audit')
  async getUserAuditLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    // Verify user exists
    await this.usersService.getUserById(id);

    const maxResults = limit ? parseInt(limit, 10) : 20;

    // Query auth events for this user
    const events = await this.authEventRepo.find({
      where: { userId: id },
      order: { createdAt: 'DESC' },
      take: maxResults,
      relations: ['user'],
    });

    // Map to the expected audit log format
    const auditLog = events.map((event) => ({
      id: event.id,
      action: event.eventType,
      actorId: event.userId,
      actorName: event.user?.displayName || event.user?.email || undefined,
      oldValue: undefined,
      newValue: event.success ? { success: true } : { success: false, ipAddress: event.ipAddress },
      createdAt: event.createdAt?.toISOString() || new Date().toISOString(),
    }));

    return { data: auditLog };
  }

  /**
   * Invite a new user
   */
  @Post('invite')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.create')
  async inviteUser(@Body() dto: InviteUserDto, @CurrentUser() user: UserContext) {
    const result = await this.usersService.inviteUser(dto, user.userId);
    return { data: result, message: 'User invited successfully' };
  }

  /**
   * Update a user
   */
  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.update')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const result = await this.usersService.updateUser(id, dto);
    return { data: result, message: 'User updated successfully' };
  }

  /**
   * Delete a user (soft delete)
   */
  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserContext,
  ) {
    await this.usersService.deleteUser(id, user.userId);
  }

  // ==========================================================================
  // User Status Actions
  // ==========================================================================

  /**
   * Deactivate a user
   */
  @Post(':id/deactivate')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.update')
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.usersService.deactivateUser(id, user.userId, reason);
    return { data: result, message: 'User deactivated successfully' };
  }

  /**
   * Reactivate a user
   */
  @Post(':id/reactivate')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.update')
  async reactivateUser(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.usersService.reactivateUser(id);
    return { data: result, message: 'User reactivated successfully' };
  }

  /**
   * Suspend a user
   */
  @Post(':id/suspend')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.update')
  async suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Body('expiresAt') expiresAt: string,
    @CurrentUser() user: UserContext,
  ) {
    const expires = expiresAt ? new Date(expiresAt) : undefined;
    const result = await this.usersService.suspendUser(id, user.userId, reason, expires);
    return { data: result, message: 'User suspended successfully' };
  }

  /**
   * Unsuspend a user
   */
  @Post(':id/unsuspend')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.update')
  async unsuspendUser(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.usersService.unsuspendUser(id);
    return { data: result, message: 'User unsuspended successfully' };
  }

  /**
   * Unlock a locked user
   */
  @Post(':id/unlock')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.update')
  async unlockUser(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.usersService.unlockUser(id);
    return { data: result, message: 'User unlocked successfully' };
  }

  /**
   * Resend invitation to an invited user
   */
  @Post(':id/resend-invitation')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.update')
  async resendInvitation(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.usersService.resendInvitation(id);
    return { data: result, message: 'Invitation resent successfully' };
  }

  /**
   * Restore a deleted user
   */
  @Post(':id/restore')
  @UseGuards(PermissionGuard)
  @RequirePermission('user.update')
  async restoreUser(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.usersService.restoreUser(id);
    return { data: result, message: 'User restored successfully' };
  }
}
