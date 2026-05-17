import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { CreateThemeDto, UpdateThemeDto, UpdatePreferenceDto } from './theme.dto';
import {
  AuthenticatedOnly,
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  Public,
  RequirePermission,
} from '@hubblewave/auth-guard';

/**
 * Canon §28 / W2 Stream 3 — theme catalog + per-user preference surface.
 * The theme catalog reads (`list`, `findOne`) are `@Public` so the
 * unauthenticated login page can render the theme; preference reads/writes
 * are `@AuthenticatedOnly` (each user manages their own preference);
 * catalog mutations (`create`, `update`, `remove`) are platform-admin
 * configuration and gated by `system:configure`.
 */
@Controller('themes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Public()
  @Get()
  async list() {
    return this.themeService.list();
  }

  // Preference routes must come BEFORE parameterized routes to avoid
  // "preferences" being matched as :id and failing ParseUUIDPipe
  @AuthenticatedOnly()
  @Get('preferences/me')
  async getPref(@CurrentUser('userId') userId: string) {
    return this.themeService.getPreference(userId);
  }

  @AuthenticatedOnly()
  @Put('preferences/me')
  async updatePref(@CurrentUser('userId') userId: string, @Body() dto: UpdatePreferenceDto) {
    return this.themeService.updatePreference(userId, dto);
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.themeService.findOne(id);
  }

  @RequirePermission('system:configure')
  @Post()
  async create(@Body() dto: CreateThemeDto, @CurrentUser('userId') userId: string) {
    return this.themeService.create(dto, userId);
  }

  @RequirePermission('system:configure')
  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateThemeDto) {
    return this.themeService.update(id, dto);
  }

  @RequirePermission('system:configure')
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.themeService.remove(id);
  }
}
