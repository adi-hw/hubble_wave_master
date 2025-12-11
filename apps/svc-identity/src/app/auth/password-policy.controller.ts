import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PasswordPolicy } from '@eam-platform/platform-db';
import { TenantDbService } from '@eam-platform/tenant-db';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantId } from './decorators/tenant.decorator';
import { Roles } from './decorators/roles.decorator';

@Controller('admin/auth/password-policy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class PasswordPolicyController {
  constructor(
    private readonly tenantDbService: TenantDbService,
  ) {}

  @Get()
  async getPolicy(@TenantId() tenantId: string) {
    const policyRepo = await this.tenantDbService.getRepository(tenantId, PasswordPolicy);
    return policyRepo.findOne({ where: {} });
  }

  @Post()
  async savePolicy(@TenantId() tenantId: string, @Body() policy: Partial<PasswordPolicy>) {
    const policyRepo = await this.tenantDbService.getRepository(tenantId, PasswordPolicy);
    let existing = await policyRepo.findOne({ where: {} });

    if (existing) {
      existing = policyRepo.merge(existing, policy);
      return policyRepo.save(existing);
    } else {
      const newPolicy = policyRepo.create({ ...policy });
      return policyRepo.save(newPolicy);
    }
  }
}
