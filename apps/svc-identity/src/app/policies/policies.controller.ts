import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { PoliciesService, PolicyListOptions } from './policies.service';
import { RequirePermission } from '../roles/decorators/permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';

/**
 * PoliciesController
 *
 * Admin endpoints for viewing access rules (collection and property level policies).
 * All endpoints require admin-level permissions.
 */
@Controller('policies')
@UseGuards(JwtAuthGuard)
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  /**
   * List all access rules with optional filtering
   *
   * Supports filtering by:
   * - collectionId: Filter by specific collection
   * - propertyId: Filter by specific property
   * - roleId: Filter by policies assigned to a role
   * - groupId: Filter by policies assigned to a group
   * - userId: Filter by policies assigned to a user
   * - includeInactive: Include inactive policies (default: false)
   */
  @Get()
  @RequirePermission('admin.policies.view')
  @UseGuards(PermissionGuard)
  async listPolicies(
    @Query('collectionId') collectionId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('roleId') roleId?: string,
    @Query('groupId') groupId?: string,
    @Query('userId') userId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const options: PolicyListOptions = {
      collectionId: collectionId || undefined,
      propertyId: propertyId || undefined,
      roleId: roleId || undefined,
      groupId: groupId || undefined,
      userId: userId || undefined,
      includeInactive: includeInactive === 'true',
    };

    const policies = await this.policiesService.listPolicies(options);
    return { data: policies, total: policies.length };
  }

  /**
   * Get policy statistics
   */
  @Get('stats')
  @RequirePermission('admin.policies.view')
  @UseGuards(PermissionGuard)
  async getPolicyStats() {
    const stats = await this.policiesService.getPolicyStats();
    return { data: stats };
  }

  /**
   * Get policies for a specific collection (both row-level and field-level)
   */
  @Get('collection/:collectionId')
  @RequirePermission('admin.policies.view')
  @UseGuards(PermissionGuard)
  async getPoliciesForCollection(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
  ) {
    const result = await this.policiesService.getPoliciesForCollection(collectionId);
    return {
      data: result,
      total: {
        collectionRules: result.collectionRules.length,
        propertyRules: result.propertyRules.length,
      },
    };
  }

  /**
   * Get policies assigned to a specific role
   */
  @Get('role/:roleId')
  @RequirePermission('admin.policies.view')
  @UseGuards(PermissionGuard)
  async getPoliciesForRole(@Param('roleId', ParseUUIDPipe) roleId: string) {
    const policies = await this.policiesService.getPoliciesForRole(roleId);
    return { data: policies, total: policies.length };
  }

  /**
   * Get policies assigned to a specific group
   */
  @Get('group/:groupId')
  @RequirePermission('admin.policies.view')
  @UseGuards(PermissionGuard)
  async getPoliciesForGroup(@Param('groupId', ParseUUIDPipe) groupId: string) {
    const policies = await this.policiesService.getPoliciesForGroup(groupId);
    return { data: policies, total: policies.length };
  }

  /**
   * Get policies assigned to a specific user
   */
  @Get('user/:userId')
  @RequirePermission('admin.policies.view')
  @UseGuards(PermissionGuard)
  async getPoliciesForUser(@Param('userId', ParseUUIDPipe) userId: string) {
    const policies = await this.policiesService.getPoliciesForUser(userId);
    return { data: policies, total: policies.length };
  }

  /**
   * Get a specific policy by ID
   */
  @Get(':id')
  @RequirePermission('admin.policies.view')
  @UseGuards(PermissionGuard)
  async getPolicy(@Param('id', ParseUUIDPipe) id: string) {
    const policy = await this.policiesService.getPolicyById(id);
    return { data: policy };
  }
}
