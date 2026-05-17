import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LdapConfig } from '@hubblewave/instance-db';
import { LdapService } from './ldap.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '@hubblewave/auth-guard';
import { SkipAbac } from '../abac/abac.guard';

/**
 * Canon §28 / W2 Stream 3 Task 20 — LDAP configuration is gated by
 * `@RequirePermission('system:configure')`. The pre-Stream-3
 * class-level `@Roles('admin')` was redundant once the capability
 * model expressed the same authority.
 */
@Controller('admin/auth/ldap')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('system:configure')
@SkipAbac()
export class LdapController {
  constructor(
    @InjectRepository(LdapConfig) private readonly ldapConfigRepo: Repository<LdapConfig>,
    private ldapService: LdapService
  ) {}

  @Get()
  async getConfig() {
    return this.ldapConfigRepo.findOne({ where: {} });
  }

  @Post()
  async saveConfig(@Body() config: Partial<LdapConfig>) {
    let existing = await this.ldapConfigRepo.findOne({ where: {} });

    if (existing) {
      existing = this.ldapConfigRepo.merge(existing, config);
      return this.ldapConfigRepo.save(existing);
    } else {
      const newConfig = this.ldapConfigRepo.create({ ...config });
      return this.ldapConfigRepo.save(newConfig);
    }
  }

  @Post('test')
  async testConnection(@Body() config: LdapConfig) {
    // Allow testing with provided config (before saving) or saved config
    let configToTest = config;
    if (!config.host) {
      configToTest = (await this.ldapConfigRepo.findOne({ where: {} })) as LdapConfig;
    }

    if (!configToTest) {
      return { success: false, message: 'No configuration found' };
    }

    const success = await this.ldapService.testConnection(configToTest);
    return { success, message: success ? 'Connection successful' : 'Connection failed' };
  }
}
