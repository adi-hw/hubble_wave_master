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
import { GroupService, CreateGroupDto, UpdateGroupDto, GroupListOptions } from './group.service';
import { MembershipService, AddMemberDto, UpdateMemberDto, BulkAddMembersDto } from './membership.service';
import { GroupRoleService, AssignRoleDto } from './group-role.service';
import { RequirePermission } from '../roles/decorators/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { GroupType } from '@hubblewave/instance-db';

interface UserContext {
  userId: string;
  email?: string;
}

/**
 * GroupsController
 *
 * Admin endpoints for managing groups, memberships, and role assignments.
 */
@Controller('admin/groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(
    private readonly groupService: GroupService,
    private readonly membershipService: MembershipService,
    private readonly groupRoleService: GroupRoleService,
  ) {}

  // ==========================================================================
  // Group CRUD
  // ==========================================================================

  /**
   * List all groups
   */
  @Get()
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async listGroups(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('parentId') parentId?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('includeCounts') includeCounts?: string,
  ) {
    const options: GroupListOptions = {
      search: search || undefined,
      type: type ? (type as GroupType) : undefined,
      parentId: parentId === '' ? null : parentId,
      includeInactive: includeInactive === 'true',
      includeCounts: includeCounts !== 'false',
    };

    const groups = await this.groupService.listGroups(options);
    return { data: groups, total: groups.length };
  }

  /**
   * Get group hierarchy as tree
   */
  @Get('tree')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getGroupTree(@Query('includeInactive') includeInactive?: string) {
    const tree = await this.groupService.getGroupHierarchy({
      includeInactive: includeInactive === 'true',
    });
    return { data: tree };
  }

  /**
   * Get group statistics
   */
  @Get('stats')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getGroupStats() {
    const stats = await this.groupService.getGroupStats();
    return { data: stats };
  }

  /**
   * Get group by ID
   */
  @Get(':id')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getGroup(@Param('id', ParseUUIDPipe) id: string) {
    const group = await this.groupService.getGroupById(id);
    return { data: group };
  }

  /**
   * Create a new group
   */
  @Post()
  @RequirePermission('groups.create')
  @UseGuards(PermissionGuard)
  async createGroup(
    @CurrentUser() user: UserContext,
    @Body() body: CreateGroupDto,
  ) {
    const group = await this.groupService.createGroup(body, user?.userId);
    return { data: group };
  }

  /**
   * Update a group
   */
  @Put(':id')
  @RequirePermission('groups.update')
  @UseGuards(PermissionGuard)
  async updateGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserContext,
    @Body() body: UpdateGroupDto,
  ) {
    const group = await this.groupService.updateGroup(id, body, user?.userId);
    return { data: group };
  }

  /**
   * Delete a group (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('groups.delete')
  @UseGuards(PermissionGuard)
  async deleteGroup(@Param('id', ParseUUIDPipe) id: string) {
    await this.groupService.deleteGroup(id);
  }

  /**
   * Restore a deleted group
   */
  @Post(':id/restore')
  @RequirePermission('groups.update')
  @UseGuards(PermissionGuard)
  async restoreGroup(@Param('id', ParseUUIDPipe) id: string) {
    const group = await this.groupService.restoreGroup(id);
    return { data: group };
  }

  // ==========================================================================
  // Hierarchy
  // ==========================================================================

  /**
   * Get child groups
   */
  @Get(':id/children')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getChildren(@Param('id', ParseUUIDPipe) id: string) {
    const children = await this.groupService.getChildren(id);
    return { data: children, total: children.length };
  }

  /**
   * Get ancestor groups
   */
  @Get(':id/ancestors')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getAncestors(@Param('id', ParseUUIDPipe) id: string) {
    const ancestors = await this.groupService.getAncestors(id);
    return { data: ancestors, total: ancestors.length };
  }

  /**
   * Get descendant groups
   */
  @Get(':id/descendants')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getDescendants(@Param('id', ParseUUIDPipe) id: string) {
    const descendants = await this.groupService.getDescendants(id);
    return { data: descendants, total: descendants.length };
  }

  // ==========================================================================
  // Membership
  // ==========================================================================

  /**
   * Get group members (direct)
   */
  @Get(':id/members')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getGroupMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('search') search?: string,
    @Query('includeExpired') includeExpired?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.membershipService.getGroupMembers(id, {
      search,
      includeExpired: includeExpired === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return { data: result.members, total: result.total };
  }

  /**
   * Get effective group members (including nested groups)
   */
  @Get(':id/members/effective')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getEffectiveMembers(@Param('id', ParseUUIDPipe) id: string) {
    const members = await this.membershipService.getEffectiveGroupMembers(id);
    return { data: members, total: members.length };
  }

  /**
   * Get group managers
   */
  @Get(':id/managers')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getGroupManagers(@Param('id', ParseUUIDPipe) id: string) {
    const managers = await this.membershipService.getGroupManagers(id);
    return { data: managers, total: managers.length };
  }

  /**
   * Get member count
   */
  @Get(':id/members/count')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getMemberCount(@Param('id', ParseUUIDPipe) id: string) {
    const count = await this.membershipService.getMemberCount(id);
    return { data: count };
  }

  /**
   * Add a member to a group
   */
  @Post(':id/members')
  @RequirePermission('groups.manage-members')
  @UseGuards(PermissionGuard)
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserContext,
    @Body() body: AddMemberDto,
  ) {
    const member = await this.membershipService.addMember(id, body, user?.userId);
    return { data: member };
  }

  /**
   * Bulk add members to a group
   */
  @Post(':id/members/bulk')
  @RequirePermission('groups.manage-members')
  @UseGuards(PermissionGuard)
  async bulkAddMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserContext,
    @Body() body: BulkAddMembersDto,
  ) {
    const result = await this.membershipService.bulkAddMembers(id, body, user?.userId);
    return { data: result };
  }

  /**
   * Update a member
   */
  @Put(':id/members/:userId')
  @RequirePermission('groups.manage-members')
  @UseGuards(PermissionGuard)
  async updateMember(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: UpdateMemberDto,
  ) {
    const member = await this.membershipService.updateMember(groupId, userId, body);
    return { data: member };
  }

  /**
   * Remove a member from a group
   */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('groups.manage-members')
  @UseGuards(PermissionGuard)
  async removeMember(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.membershipService.removeMember(groupId, userId);
  }

  /**
   * Bulk remove members from a group
   */
  @Delete(':id/members/bulk')
  @RequirePermission('groups.manage-members')
  @UseGuards(PermissionGuard)
  async bulkRemoveMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { userIds: string[] },
  ) {
    const removed = await this.membershipService.bulkRemoveMembers(id, body.userIds);
    return { data: { removed } };
  }

  // ==========================================================================
  // Role Assignments
  // ==========================================================================

  /**
   * Get roles assigned to a group
   */
  @Get(':id/roles')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async getGroupRoles(@Param('id', ParseUUIDPipe) id: string) {
    const { direct, inherited } = await this.groupRoleService.getEffectiveRoles(id);
    return {
      data: {
        direct,
        inherited,
        totalDirect: direct.length,
        totalInherited: inherited.length,
      },
    };
  }

  /**
   * Assign a role to a group
   */
  @Post(':id/roles')
  @RequirePermission('groups.assign-roles')
  @UseGuards(PermissionGuard)
  async assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserContext,
    @Body() body: AssignRoleDto,
  ) {
    const assignment = await this.groupRoleService.assignRole(id, body, user?.userId);
    return { data: assignment };
  }

  /**
   * Bulk assign roles to a group
   */
  @Post(':id/roles/bulk')
  @RequirePermission('groups.assign-roles')
  @UseGuards(PermissionGuard)
  async bulkAssignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserContext,
    @Body() body: { roleIds: string[] },
  ) {
    const result = await this.groupRoleService.bulkAssignRoles(id, body.roleIds, user?.userId);
    return { data: result };
  }

  /**
   * Remove a role from a group
   */
  @Delete(':id/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('groups.assign-roles')
  @UseGuards(PermissionGuard)
  async revokeRole(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    await this.groupRoleService.revokeRole(groupId, roleId);
  }

  // ==========================================================================
  // User's Groups
  // ==========================================================================

  /**
   * Get groups a user belongs to (direct)
   */
  @Get('user/:userId')
  @RequirePermission('users.view')
  @UseGuards(PermissionGuard)
  async getUserGroups(@Param('userId', ParseUUIDPipe) userId: string) {
    const groups = await this.membershipService.getUserDirectGroups(userId);
    return { data: groups, total: groups.length };
  }

  /**
   * Get all effective groups for a user (including inherited)
   */
  @Get('user/:userId/effective')
  @RequirePermission('users.view')
  @UseGuards(PermissionGuard)
  async getUserEffectiveGroups(@Param('userId', ParseUUIDPipe) userId: string) {
    const groups = await this.membershipService.getUserEffectiveGroups(userId);
    return { data: groups, total: groups.length };
  }

  /**
   * Get all effective roles for a user through group memberships
   */
  @Get('user/:userId/roles')
  @RequirePermission('users.view')
  @UseGuards(PermissionGuard)
  async getUserGroupRoles(@Param('userId', ParseUUIDPipe) userId: string) {
    const roles = await this.groupRoleService.getUserEffectiveRoles(userId);
    return { data: roles, total: roles.length };
  }

  /**
   * Check if user is a member of a group
   */
  @Get(':id/members/:userId/check')
  @RequirePermission('groups.view')
  @UseGuards(PermissionGuard)
  async checkMembership(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const [isMember, isManager] = await Promise.all([
      this.membershipService.isMember(userId, groupId),
      this.membershipService.isManager(userId, groupId),
    ]);
    return { data: { isMember, isManager } };
  }
}
