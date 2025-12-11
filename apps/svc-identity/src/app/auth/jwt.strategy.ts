import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserAccount, UserRoleAssignment, GroupRole, UserGroup, TenantUserMembership, RoleInheritance, Role, RolePermission, Permission } from '@eam-platform/platform-db';
import { TenantDbService } from '@eam-platform/tenant-db';
import { JwtPayload } from '@eam-platform/shared-types';
import { In } from 'typeorm';

interface RoleWithPermissions extends Role {
  rolePermissions?: Array<RolePermission & { permission?: Permission }>;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly tenantDbService: TenantDbService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET environment variable must be set. ' +
        'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const tenantId = payload.tenant_id;
    const usersRepo = await this.tenantDbService.getRepository(tenantId, UserAccount);
    const user = await usersRepo.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const membershipRepo = await this.tenantDbService.getRepository<TenantUserMembership>(tenantId, TenantUserMembership as any);
    const membership = await membershipRepo.findOne({ where: { tenantId, userId: user.id } });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('Membership not active');
    }

    const { roleNames, permissions } = await this.resolveRolesAndPermissions(tenantId, membership.id);

    return {
      userId: payload.sub,
      username: payload.username,
      tenantId,
      roles: roleNames,
      permissions: Array.from(permissions),
      sessionId: payload.session_id,
    };
  }

  private async resolveRolesAndPermissions(tenantId: string, membershipId: string) {
    const userRolesRepo = await this.tenantDbService.getRepository<UserRoleAssignment>(tenantId, UserRoleAssignment);
    const inheritanceRepo = await this.tenantDbService.getRepository<RoleInheritance>(tenantId, RoleInheritance as any);
    const groupRoleRepo = await this.tenantDbService.getRepository<GroupRole>(tenantId, GroupRole as any);
    const roleRepo = await this.tenantDbService.getRepository<Role>(tenantId, Role as any);

    const directAssignments = await userRolesRepo.find({
      where: { tenantUserMembershipId: membershipId },
      relations: ['role', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });

    const groupRoles = await groupRoleRepo
      .createQueryBuilder('gr')
      .innerJoin(UserGroup, 'ug', 'ug.group_id = gr.group_id AND ug.tenant_user_membership_id = :membershipId', { membershipId })
      .leftJoinAndSelect('gr.role', 'role')
      .leftJoinAndSelect('role.rolePermissions', 'rp')
      .leftJoinAndSelect('rp.permission', 'perm')
      .getMany();

    const roleMap = new Map<string, RoleWithPermissions>();
    [...directAssignments.map((ra) => ra.role), ...groupRoles.map((gr) => gr.role)]
      .filter((r): r is RoleWithPermissions => Boolean(r))
      .forEach((r) => roleMap.set(r.id, r));

    const collectInherited = async (roleIds: string[], visited: Set<string>) => {
      if (!roleIds.length) return;
      const rows = await inheritanceRepo.find({ where: [{ parentRoleId: In(roleIds) }] });
      const childIds = rows.map((r) => r.childRoleId).filter((id) => !visited.has(id));
      if (!childIds.length) return;
      for (const id of childIds) {
        visited.add(id);
        const child = await roleRepo.findOne({ where: { id }, relations: ['rolePermissions', 'rolePermissions.permission'] });
        if (child) roleMap.set(child.id, child);
      }
      await collectInherited(childIds, visited);
    };

    await collectInherited(Array.from(roleMap.keys()), new Set());

    const uniqueRoles = Array.from(roleMap.values());
    const roleNames = uniqueRoles.map((r) => r.slug || r.name);
    const permissions = new Set<string>();
    uniqueRoles.forEach((role) => {
      role.rolePermissions?.forEach((rp) => {
        if (rp.permission?.name) permissions.add(rp.permission.name);
      });
    });
    return { roleNames, permissions };
  }
}
