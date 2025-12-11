import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { AbacResource } from '../abac/abac.guard';

@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @AbacResource('rbac', 'read')
  listRoles(@Req() req: any) {
    return this.rbacService.listRoles(req.user.tenantId);
  }

  @Post('roles')
  @AbacResource('rbac', 'update')
  createRole(@Req() req: any, @Body() body: { name: string; description?: string; permissions?: string[] }) {
    return this.rbacService.createRole(req.user.tenantId, body.name, body.description, body.permissions || []);
  }

  @Get('groups')
  @AbacResource('rbac', 'read')
  listGroups(@Req() req: any) {
    return this.rbacService.listGroups(req.user.tenantId);
  }

  @Post('groups')
  @AbacResource('rbac', 'update')
  upsertGroup(@Req() req: any, @Body() body: { slug: string; name: string; description?: string }) {
    return this.rbacService.upsertGroup(req.user.tenantId, body.slug, body.name, body.description);
  }

  @Post('groups/:groupId/roles/:roleId')
  @AbacResource('rbac', 'update')
  assignRoleToGroup(@Req() req: any, @Param('groupId') groupId: string, @Param('roleId') roleId: string) {
    return this.rbacService.assignRoleToGroup(req.user.tenantId, groupId, roleId);
  }

  @Post('groups/:groupId/users/:userId')
  @AbacResource('rbac', 'update')
  addUserToGroup(@Req() req: any, @Param('groupId') groupId: string, @Param('userId') userId: string) {
    return this.rbacService.addUserToGroup(req.user.tenantId, userId, groupId);
  }
}
