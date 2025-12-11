import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '@eam-platform/platform-db';
import { TenantProvisioningService } from './tenant-provisioning.service';

@Injectable()
export class DefaultTenantBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DefaultTenantBootstrapService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly provisioningService: TenantProvisioningService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>
  ) {}

  async onApplicationBootstrap() {
    const slug = this.configService.get<string>('DEFAULT_TENANT_SLUG') || 'acme';
    const tenantName = this.configService.get<string>('DEFAULT_TENANT_NAME') || 'Acme Corp';

    if (!slug) {
      this.logger.warn('DEFAULT_TENANT_SLUG not set; skipping default tenant bootstrap');
      return;
    }

    const existing = await this.tenantRepo.findOne({ where: { slug } });
    if (existing) {
      if (existing.status !== 'ACTIVE') {
        existing.status = 'ACTIVE';
        await this.tenantRepo.save(existing);
        this.logger.log(`Activated default tenant '${slug}'`);
      }
      // Ensure the default admin has tenant_admin role even if tenant already existed
      const adminUsername = this.configService.get<string>('DEFAULT_ADMIN_USERNAME') || 'admin';
      const adminPassword =
        this.configService.get<string>('DEFAULT_ADMIN_PASSWORD') ||
        this.configService.get<string>('ADMIN_PASSWORD') ||
        undefined;
      const adminEmail =
        this.configService.get<string>('DEFAULT_ADMIN_EMAIL') ||
        `${adminUsername}@${slug}.com`;
      try {
        await this.provisioningService.ensureAdminRoleAssignment(
          existing.id,
          adminEmail,
          adminPassword,
          adminUsername,
        );
        this.logger.log(`Verified tenant_admin role for default admin '${adminEmail}' on tenant '${slug}'`);
      } catch (err) {
        const msg = (err as Error)?.message || err;
        this.logger.error(`Failed to ensure tenant_admin for default admin '${adminEmail}': ${msg}`);
      }
      return;
    }

    const dbPrefix = this.configService.get<string>('TENANT_DB_PREFIX') || 'eam_tenant_';
    const dbName =
      this.configService.get<string>('DEFAULT_TENANT_DB_NAME') ||
      this.configService.get<string>('TENANT_DB_NAME') ||
      `${dbPrefix}${slug}`;

    const dbHost =
      this.configService.get<string>('TENANT_DB_HOST') ||
      this.configService.get<string>('DB_HOST') ||
      this.configService.get<string>('PLATFORM_DB_HOST') ||
      'localhost';
    const dbPort = Number(
      this.configService.get<string>('TENANT_DB_PORT') ||
        this.configService.get<string>('DB_PORT') ||
        this.configService.get<string>('PLATFORM_DB_PORT') ||
        5432
    );
    const dbUser =
      this.configService.get<string>('TENANT_DB_USER') ||
      this.configService.get<string>('DB_USER') ||
      this.configService.get<string>('PLATFORM_DB_USER') ||
      'admin';
    const dbPassword =
      this.configService.get<string>('TENANT_DB_PASSWORD') ||
      this.configService.get<string>('DB_PASSWORD') ||
      this.configService.get<string>('PLATFORM_DB_PASSWORD') ||
      'password';

    const adminUsername = this.configService.get<string>('DEFAULT_ADMIN_USERNAME') || 'admin';
    const adminPassword =
      this.configService.get<string>('DEFAULT_ADMIN_PASSWORD') ||
      this.configService.get<string>('ADMIN_PASSWORD') ||
      undefined;
    const adminEmail =
      this.configService.get<string>('DEFAULT_ADMIN_EMAIL') ||
      `${adminUsername}@${slug}.com`;

    try {
      await this.provisioningService.createTenant({
        slug,
        name: tenantName,
        dbHost,
        dbPort,
        dbName,
        dbUser,
        dbPassword,
        adminEmail,
        adminUsername,
        adminPassword,
      });
      this.logger.log(`Provisioned default tenant '${slug}' with admin '${adminUsername}'`);
    } catch (error) {
      const message = (error as Error)?.message || error;
      this.logger.error(`Failed to provision default tenant '${slug}': ${message}`);
    }
  }
}
