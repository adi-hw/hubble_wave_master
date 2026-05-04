import { Body, Controller, Get, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '@hubblewave/auth-guard';
import { ModuleService } from './module.service';
import { CreateModuleDto } from './module.dto';

@Controller('modules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Get()
  list() {
    return this.moduleService.listModules();
  }

  @Post()
  @Roles('admin')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  create(@Body() body: CreateModuleDto) {
    return this.moduleService.createModule(body);
  }
}
