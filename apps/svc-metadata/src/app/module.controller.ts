import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { ModuleService } from './module.service';

@Controller('modules')
@UseGuards(JwtAuthGuard)
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Get()
  list() {
    return this.moduleService.listModules();
  }

  @Post()
  create(
    @Body()
    body: { name: string; slug: string; description?: string; route?: string; icon?: string; category?: string; sortOrder?: number }
  ) {
    return this.moduleService.createModule(body);
  }
}
