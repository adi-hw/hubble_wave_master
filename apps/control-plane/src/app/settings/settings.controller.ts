import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { SettingsService } from './settings.service';
import { UpdateGlobalSettingsDto } from './settings.dto';

@Controller('settings')
@Roles('operator')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('global')
  async getGlobalSettings() {
    return this.settingsService.getGlobalSettings();
  }

  @Put('global')
  async updateGlobalSettings(
    @Body() dto: UpdateGlobalSettingsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateGlobalSettings(dto, userId);
  }
}
