import { Controller, Get, Param, UnauthorizedException } from '@nestjs/common';

/**
 * SSO authentication controller. Returns appropriate errors when SSO is not configured.
 */
@Controller('auth/sso')
export class OidcController {
  @Get(':providerId/login')
  async login(@Param('providerId') providerId: string) {
    throw new UnauthorizedException(`SSO provider ${providerId} is not enabled for this instance.`);
  }

  @Get(':providerId/callback')
  async callback(@Param('providerId') providerId: string) {
    throw new UnauthorizedException(`SSO provider ${providerId} is not enabled for this instance.`);
  }
}
