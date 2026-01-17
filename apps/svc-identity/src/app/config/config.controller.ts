import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ConfigServiceLocal } from './config.service';
type ConfigScope = string;
type ConfigType = string;
import { AbacResource } from '../abac/abac.guard';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigServiceLocal) {}

  @Get(':scope')
  @AbacResource('config', 'read')
  list() {
    return this.configService.list();
  }

  @Post(':scope')
  @AbacResource('config', 'update')
  set(
    @Req() req: { user?: { id?: string } },
    @Param('scope') scope: ConfigScope,
    @Body() body: { key: string; value: unknown; category: string; type: ConfigType },
  ) {
    return this.configService.set(scope, body.key, body.value, req.user?.id);
  }
}
