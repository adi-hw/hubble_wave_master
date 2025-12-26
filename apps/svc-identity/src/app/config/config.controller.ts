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
    @Req() _req: any,
    @Param('scope') _scope: ConfigScope,
    @Body() _body: { key: string; value: any; category: string; type: ConfigType },
  ) {
    return this.configService.set();
  }
}
