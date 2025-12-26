import { Controller, Get, Param, UnauthorizedException } from '@nestjs/common';

/**
 * Placeholder controller to keep routing intact while SSO features are disabled.
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
