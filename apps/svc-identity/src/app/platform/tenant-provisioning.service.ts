import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Tenant, UserAccount, Role, UserRoleAssignment, TenantUserMembership } from '@eam-platform/platform-db';
import { TenantDbService } from '@eam-platform/tenant-db';

export interface CreateTenantDto {
  slug: string;
  name: string;
  dbHost?: string;
  dbPort?: number;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  adminEmail?: string;
  adminUsername?: string;
  adminPassword?: string;
}

@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantDb: TenantDbService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>
  ) {}

  /**
   * Ensure a specific user has the tenant_admin role and membership in an existing tenant.
   * Safe to run repeatedly; creates missing user/membership/role assignment if needed.
   */
  async ensureAdminRoleAssignment(
    tenantId: string,
    adminEmail: string,
    adminPassword?: string,
    adminDisplayName?: string,
  ) {
    const userRepo = await this.tenantDb.getRepository<UserAccount>(tenantId, UserAccount);
    const membershipRepo = await this.tenantDb.getRepository<TenantUserMembership>(tenantId, TenantUserMembership);
    const roleRepo = await this.tenantDb.getRepository<Role>(tenantId, Role);
    const userRoleRepo = await this.tenantDb.getRepository<UserRoleAssignment>(tenantId, UserRoleAssignment);

    let adminRole = await roleRepo.findOne({ where: { slug: 'tenant_admin', tenantId } });
    if (!adminRole) {
      adminRole = roleRepo.create({
        tenantId,
        slug: 'tenant_admin',
        name: 'Tenant Admin',
        description: 'Tenant administrator',
        isSystem: true,
      });
      await roleRepo.save(adminRole);
    }

    let user = await userRepo.findOne({ where: { primaryEmail: adminEmail } });
    if (!user) {
      const password = adminPassword ?? crypto.randomBytes(16).toString('base64url');
      user = userRepo.create({
        primaryEmail: adminEmail,
        displayName: adminDisplayName || 'Admin',
        passwordHash: await argon2.hash(password),
        passwordAlgo: 'argon2id',
        status: 'ACTIVE',
      });
      await userRepo.save(user);
    }

    let membership = await membershipRepo.findOne({ where: { tenantId, userId: user.id } });
    if (!membership) {
      membership = membershipRepo.create({
        tenantId,
        userId: user.id,
        status: 'ACTIVE',
        isTenantAdmin: true,
      });
      membership = await membershipRepo.save(membership);
    } else if (!membership.isTenantAdmin) {
      membership.isTenantAdmin = true;
      await membershipRepo.save(membership);
    }

    const assignmentExists = await userRoleRepo.findOne({
      where: { tenantUserMembershipId: membership.id, roleId: adminRole.id },
    });
    if (!assignmentExists) {
      const assignment = userRoleRepo.create({
        tenantUserMembershipId: membership.id,
        roleId: adminRole.id,
        source: 'DIRECT',
      });
      await userRoleRepo.save(assignment);
    }
  }

  private async ensureDatabase(dbName: string, dbUser?: string, dbPassword?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const exists = await queryRunner.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
      if (exists.length === 0) {
        let ownerClause = '';
        if (dbUser) {
          const roleExists = await queryRunner.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [dbUser]);
          if (roleExists.length === 0) {
            this.logger.log(`Creating role ${dbUser} for tenant database ${dbName}`);
            await queryRunner.query(`CREATE ROLE "${dbUser}" LOGIN PASSWORD $1`, [dbPassword || '']);
          }
          ownerClause = ` OWNER "${dbUser}"`;
        }
        this.logger.log(`Creating tenant database ${dbName}`);
        // CREATE DATABASE cannot run inside a transaction block
        await queryRunner.query(`CREATE DATABASE "${dbName}"${ownerClause}`);
      }
      return exists.length === 0;
    } catch (err) {
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async seedAdminUser(
    tenantId: string,
    tenantSlug: string,
    adminEmail?: string,
    adminPassword?: string,
    adminDisplayName?: string,
  ) {
    const userRepo = await this.tenantDb.getRepository<UserAccount>(tenantId, UserAccount);
    const membershipRepo = await this.tenantDb.getRepository<TenantUserMembership>(tenantId, TenantUserMembership);
    const roleRepo = await this.tenantDb.getRepository<Role>(tenantId, Role);
    const userRoleRepo = await this.tenantDb.getRepository<UserRoleAssignment>(tenantId, UserRoleAssignment);

    const primaryEmail = adminEmail || `admin@${tenantSlug}.com`;
    const generatedPassword = adminPassword ? undefined : crypto.randomBytes(16).toString('base64url');
    const password = adminPassword ?? generatedPassword ?? crypto.randomBytes(16).toString('base64url');

    let adminRole = await roleRepo.findOne({ where: { slug: 'tenant_admin', tenantId } });
    if (!adminRole) {
      adminRole = roleRepo.create({
        tenantId,
        slug: 'tenant_admin',
        name: 'Tenant Admin',
        description: 'Tenant administrator',
        isSystem: true,
      });
      await roleRepo.save(adminRole);
    }

    let user = await userRepo.findOne({ where: { primaryEmail } });
    if (!user) {
      user = userRepo.create({
        primaryEmail,
        displayName: adminDisplayName || 'Admin',
        passwordHash: await argon2.hash(password),
        passwordAlgo: 'argon2id',
        status: 'ACTIVE',
      });
      await userRepo.save(user);
    }

    let membership = await membershipRepo.findOne({ where: { tenantId, userId: user.id } });
    if (!membership) {
      membership = membershipRepo.create({
        tenantId,
        userId: user.id,
        status: 'ACTIVE',
        isTenantAdmin: true,
      });
      membership = await membershipRepo.save(membership);
    }

    const assignmentExists = await userRoleRepo.findOne({
      where: { tenantUserMembershipId: membership.id, roleId: adminRole.id },
    });
    if (!assignmentExists) {
      const assignment = userRoleRepo.create({
        tenantUserMembershipId: membership.id,
        roleId: adminRole.id,
        source: 'DIRECT',
      });
      await userRoleRepo.save(assignment);
    }

    return { user, generatedPassword };
  }

  async createTenant(dto: CreateTenantDto) {
    const existing = await this.tenantRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new BadRequestException('Tenant slug already exists');
    }

    const dbPrefix = process.env.TENANT_DB_PREFIX || 'eam_tenant_';
    const dbName = dto.dbName || `${dbPrefix}${dto.slug}`;
    let databaseCreated = false;
    let savedTenant: Tenant | null = null;

    try {
      const baseOptions = this.dataSource.options as any;
      const dbHost = dto.dbHost || baseOptions.host || 'localhost';
      const dbPort = dto.dbPort || Number(baseOptions.port) || 5432;
      const dbUser = dto.dbUser || (baseOptions.username as string) || 'admin';
      const dbPasswordEnc = dto.dbPassword || (baseOptions.password as string) || 'password';
      const tenant = this.tenantRepo.create({
        slug: dto.slug,
        name: dto.name,
        status: 'ACTIVE',
        dbHost,
        dbPort,
        dbName,
        dbUser,
        dbPasswordEnc,
      });
      savedTenant = await this.tenantRepo.save(tenant);

      databaseCreated = await this.ensureDatabase(dbName, dbUser, dbPasswordEnc);

      // Initialize tenant database and run migrations
      await this.tenantDb.getDataSource(savedTenant.id);

      const adminResult = await this.seedAdminUser(
        savedTenant.id,
        savedTenant.slug || dto.slug,
        dto.adminEmail,
        dto.adminPassword,
        dto.adminUsername
      );

      return {
        tenant: savedTenant,
        admin: {
          user: adminResult.user,
          generatedPassword: adminResult.generatedPassword,
        },
      };
    } catch (error) {
      const message = (error as Error)?.message || error;
      this.logger.error(`Failed to provision tenant ${dto.slug}: ${message}`);
      if (savedTenant?.id) {
        await this.tenantRepo.delete(savedTenant.id);
      }
      if (databaseCreated) {
        try {
          await this.dataSource.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        } catch (dropErr) {
          const dropMessage = (dropErr as Error)?.message || dropErr;
          this.logger.error(`Failed to drop database ${dbName} after provision failure: ${dropMessage}`);
        }
      }
      throw error;
    }
  }
}
