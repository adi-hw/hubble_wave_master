import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser, Roles, RolesGuard } from '@hubblewave/auth-guard';
import { AvaToolsService, CreateAvaToolRequest, UpdateAvaToolRequest } from './ava-tools.service';

@Controller('api/ava/tools')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AvaToolsController {
  constructor(private readonly toolsService: AvaToolsService) {}

  @Get()
  async list(@Query('include_inactive') includeInactive?: string) {
    const value = includeInactive === 'true';
    return this.toolsService.listTools(value);
  }

  @Post()
  async create(@Body() body: CreateAvaToolRequest, @CurrentUser() user?: RequestUser) {
    return this.toolsService.createTool(body, user?.id);
  }

  @Put(':code')
  async update(
    @Param('code') code: string,
    @Body() body: UpdateAvaToolRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.toolsService.updateTool(code, body, user?.id);
  }

  @Post(':code/publish')
  async publish(@Param('code') code: string, @CurrentUser() user?: RequestUser) {
    return this.toolsService.publishTool(code, user?.id);
  }
}
