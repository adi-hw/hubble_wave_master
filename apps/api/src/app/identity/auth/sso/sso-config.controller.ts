import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';

@Controller('auth/sso/config')
export class SsoConfigController {
  @Public()
  @Get()
  getConfig() {
    throw new UnauthorizedException('SSO configuration is disabled for this instance.');
  }
}
