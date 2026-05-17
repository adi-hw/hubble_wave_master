import { Body, Controller, Get, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  AuthenticatedOnly,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '@hubblewave/auth-guard';
import { ModuleService } from './module.service';
import { CreateModuleDto } from './module.dto';

/**
 * Canon §28 / W2 Stream 3 — application module (navigation entry)
 * surface. Reading the module list is available to any authenticated
 * user (drives the left-nav); creating a module mutates the platform's
 * navigation tree and is gated by `metadata:navigation:manage`.
 */
@Controller('modules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Get()
  @AuthenticatedOnly()
  list() {
    return this.moduleService.listModules();
  }

  @Post()
  @RequirePermission('metadata:navigation:manage')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  create(@Body() body: CreateModuleDto) {
    return this.moduleService.createModule(body);
  }
}
