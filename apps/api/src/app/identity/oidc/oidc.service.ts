import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class OidcService {
  async getAuthorizationUrl(): Promise<string> {
    throw new UnauthorizedException('OIDC is disabled for this deployment.');
  }

  async handleCallback() {
    throw new UnauthorizedException('OIDC is disabled for this deployment.');
  }
}
