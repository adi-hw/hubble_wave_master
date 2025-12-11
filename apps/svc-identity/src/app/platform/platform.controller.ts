import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantProvisioningService, CreateTenantDto } from './tenant-provisioning.service';

@Controller('platform')
@UseGuards(JwtAuthGuard)
export class PlatformController {
  constructor(private readonly provisioningService: TenantProvisioningService) {}

  @Post('tenants')
  async createTenant(@Body() body: CreateTenantDto) {
    return this.provisioningService.createTenant(body);
  }
}
