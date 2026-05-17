import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequestUser,
  RequirePermission,
} from '@hubblewave/auth-guard';
import { AvaToolsService, CreateAvaToolRequest, UpdateAvaToolRequest } from './ava-tools.service';

/**
 * Canon §28 / W2 Stream 3 Task 25 — AVA tool registry administration
 * (catalog of platform-side tools the AI runtime can invoke). Gated
 * by `@RequirePermission('ava:admin')` — admin holds it via seeded
 * role_permissions.
 */
@Controller('ava/tools')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('ava:admin')
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
