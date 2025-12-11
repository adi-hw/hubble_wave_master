import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, TenantId } from '@eam-platform/auth-guard';
import { ModuleService } from './module.service';

@Controller('modules')
@UseGuards(JwtAuthGuard)
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.moduleService.listModules(tenantId);
  }

  @Post()
  create(
    @Body()
    body: { name: string; slug: string; description?: string; route?: string; icon?: string; category?: string; sortOrder?: number },
    @TenantId() tenantId: string
  ) {
    return this.moduleService.createModule(tenantId, body);
  }
}
