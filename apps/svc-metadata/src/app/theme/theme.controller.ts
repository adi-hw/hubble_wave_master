import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { CreateThemeDto, UpdateThemeDto, UpdatePreferenceDto } from './theme.dto';
import { CurrentUser, JwtAuthGuard, Roles } from '@hubblewave/auth-guard';

@Controller('themes')
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Get()
  async list() {
    return this.themeService.list();
  }

  // Preference routes must come BEFORE parameterized routes to avoid
  // "preferences" being matched as :id and failing ParseUUIDPipe
  @UseGuards(JwtAuthGuard)
  @Get('preferences/me')
  async getPref(@CurrentUser('id') userId: string) {
    return this.themeService.getPreference(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('preferences/me')
  async updatePref(@CurrentUser('id') userId: string, @Body() dto: UpdatePreferenceDto) {
    return this.themeService.updatePreference(userId, dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.themeService.findOne(id);
  }

  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateThemeDto, @CurrentUser('id') userId: string) {
    return this.themeService.create(dto, userId);
  }

  @Roles('admin')
  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateThemeDto) {
    return this.themeService.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.themeService.remove(id);
  }
}
