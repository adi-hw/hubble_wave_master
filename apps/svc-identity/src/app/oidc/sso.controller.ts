import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SsoProvider } from '@eam-platform/platform-db';
import { TenantDbService } from '@eam-platform/tenant-db';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantId } from '../auth/decorators/tenant.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/auth/sso')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class SsoController {
  constructor(
    private readonly tenantDbService: TenantDbService,
  ) {}

  @Get()
  async getProviders(@TenantId() tenantId: string) {
    const repo = await this.tenantDbService.getRepository(tenantId, SsoProvider);
    return repo.find({ where: {} });
  }

  @Post()
  async createProvider(@TenantId() tenantId: string, @Body() provider: Partial<SsoProvider>) {
    const repo = await this.tenantDbService.getRepository(tenantId, SsoProvider);
    const newProvider = repo.create({ ...provider });
    return repo.save(newProvider);
  }

  @Put(':providerId')
  async updateProvider(@TenantId() tenantId: string, @Param('providerId') providerId: string, @Body() provider: Partial<SsoProvider>) {
    const repo = await this.tenantDbService.getRepository(tenantId, SsoProvider);
    await repo.update(providerId, provider);
    return repo.findOne({ where: { id: providerId } });
  }

  @Delete(':providerId')
  async deleteProvider(@TenantId() tenantId: string, @Param('providerId') providerId: string) {
    const repo = await this.tenantDbService.getRepository(tenantId, SsoProvider);
    await repo.delete(providerId);
    return { success: true };
  }
}
