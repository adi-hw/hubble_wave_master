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
  list(@Req() req: any, @Param('scope') scope: ConfigScope) {
    const tenantId = scope === 'tenant' ? req.user?.tenantId : null;
    return this.configService.list(scope, tenantId);
  }

  @Post(':scope')
  @AbacResource('config', 'update')
  set(
    @Req() req: any,
    @Param('scope') scope: ConfigScope,
    @Body() body: { key: string; value: any; category: string; type: ConfigType },
  ) {
    const tenantId = scope === 'tenant' ? req.user?.tenantId : null;
    return this.configService.set({
      scope,
      tenantId,
      key: body.key,
      value: body.value,
      category: body.category,
      type: body.type,
      userId: req.user?.sub,
    });
  }
}
