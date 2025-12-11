import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { LdapConfig } from '@eam-platform/platform-db';
import { LdapService } from './ldap.service';
import { TenantDbService } from '@eam-platform/tenant-db';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantId } from '../auth/decorators/tenant.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/auth/ldap')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class LdapController {
  constructor(
    private readonly tenantDbService: TenantDbService,
    private ldapService: LdapService
  ) {}

  @Get()
  async getConfig(@TenantId() tenantId: string) {
    const ldapConfigRepo = await this.tenantDbService.getRepository<LdapConfig>(tenantId, LdapConfig as any);
    return ldapConfigRepo.findOne({ where: {} });
  }

  @Post()
  async saveConfig(@TenantId() tenantId: string, @Body() config: Partial<LdapConfig>) {
    const ldapConfigRepo = await this.tenantDbService.getRepository<LdapConfig>(tenantId, LdapConfig as any);
    let existing = await ldapConfigRepo.findOne({ where: {} });

    if (existing) {
      existing = ldapConfigRepo.merge(existing, config);
      return ldapConfigRepo.save(existing);
    } else {
      const newConfig = ldapConfigRepo.create({ ...config });
      return ldapConfigRepo.save(newConfig);
    }
  }

  @Post('test')
  async testConnection(@TenantId() tenantId: string, @Body() config: LdapConfig) {
    // Allow testing with provided config (before saving) or saved config
    const ldapConfigRepo = await this.tenantDbService.getRepository<LdapConfig>(tenantId, LdapConfig as any);
    const configToTest = config.host ? config : await ldapConfigRepo.findOne({ where: {} });

    if (!configToTest) {
      return { success: false, message: 'No configuration found' };
    }

    const success = await this.ldapService.testConnection(configToTest);
    return { success, message: success ? 'Connection successful' : 'Connection failed' };
  }
}
