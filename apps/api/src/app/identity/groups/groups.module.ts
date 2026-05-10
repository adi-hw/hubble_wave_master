import { Module } from '@nestjs/common';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { GroupService } from './group.service';
import { MembershipService } from './membership.service';
import { GroupRoleService } from './group-role.service';
import { GroupsController } from './groups.controller';
import { RolesModule } from '../roles/roles.module';

/**
 * GroupsModule
 *
 * Provides hierarchical group management functionality:
 * - Group CRUD with hierarchy (parent/child relationships)
 * - Group membership management
 * - Role assignments to groups
 * - Effective permissions through group inheritance
 *
 * Key Features:
 * - Self-referencing hierarchy with unlimited depth
 * - Role inheritance from parent groups to children
 * - Scoped role assignments (global, collection, asset, etc.)
 * - Membership expiration support
 * - Group manager designation
 * - Bulk operations for AVA integration
 */
@Module({
  imports: [InstanceDbModule, RolesModule],
  controllers: [GroupsController],
  providers: [GroupService, MembershipService, GroupRoleService],
  exports: [GroupService, MembershipService, GroupRoleService],
})
export class GroupsModule {}
