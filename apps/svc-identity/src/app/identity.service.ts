import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Tenant, UserAccount, TenantUserMembership, UserRoleAssignment, Role } from '@eam-platform/platform-db';
import { TenantDbService } from '@eam-platform/tenant-db';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    private readonly tenantDbService: TenantDbService
  ) {}

  /**
   * Create a new Tenant and a default Admin user
   */
  async createTenant(slug: string, name: string) {
    // 1. Check if tenant exists
    const existing = await this.tenantRepo.findOne({ where: { slug } });
    if (existing) {
      return { status: 'exists', tenant: existing };
    }

    // 2. Create Tenant
    const tenant = this.tenantRepo.create({
      slug,
      name,
      status: 'ACTIVE',
    });
    await this.tenantRepo.save(tenant);

    // 3. Create Admin User
    const generatedPassword = crypto.randomBytes(16).toString('base64url');
    const passwordHash = await argon2.hash(generatedPassword);
    const userRepo = await this.tenantDbService.getRepository<UserAccount>(tenant.id, UserAccount as any);
    const membershipRepo = await this.tenantDbService.getRepository<TenantUserMembership>(tenant.id, TenantUserMembership as any);
    const roleRepo = await this.tenantDbService.getRepository<Role>(tenant.id, Role as any);
    const assignmentRepo = await this.tenantDbService.getRepository<UserRoleAssignment>(tenant.id, UserRoleAssignment as any);

    const adminUser = userRepo.create({
      primaryEmail: `admin@${slug}.com`,
      displayName: 'Tenant Admin',
      passwordHash,
      status: 'ACTIVE',
    });
    await userRepo.save(adminUser);

    const membership = membershipRepo.create({
      tenantId: tenant.id,
      userId: adminUser.id,
      status: 'ACTIVE',
      isTenantAdmin: true,
      title: 'Admin',
    });
    await membershipRepo.save(membership);

    // Ensure tenant admin role exists
    let adminRole = await roleRepo.findOne({ where: { tenantId: tenant.id, slug: 'tenant_admin' } });
    if (!adminRole) {
      adminRole = await roleRepo.save(
        roleRepo.create({ tenantId: tenant.id, slug: 'tenant_admin', name: 'Tenant Admin', isSystem: true }),
      );
    }
    // Assign role
    const existingAssignment = await assignmentRepo.findOne({ where: { tenantUserMembershipId: membership.id, roleId: adminRole.id } });
    if (!existingAssignment) {
      await assignmentRepo.save(
        assignmentRepo.create({ tenantUserMembershipId: membership.id, roleId: adminRole.id, source: 'DIRECT' }),
      );
    }

    this.logger.log(`Created tenant ${slug} and admin user`);
    return { status: 'created', tenant, adminUser, generatedPassword };
  }
}
