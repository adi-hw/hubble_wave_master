import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/require-permission.decorator';
import { SettingsService } from './settings.service';
import { UpdateGlobalSettingsDto } from './settings.dto';

/**
 * Canon §28 / W2 Stream 3 — global control-plane settings. Read by
 * `control_plane:settings:read`; write by `control_plane:settings:configure`.
 */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('global')
  @RequirePermission('control_plane:settings:read')
  async getGlobalSettings() {
    return this.settingsService.getGlobalSettings();
  }

  @Put('global')
  @RequirePermission('control_plane:settings:configure')
  async updateGlobalSettings(
    @Body() dto: UpdateGlobalSettingsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateGlobalSettings(dto, userId);
  }
}
