import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Issuer, Client } from 'openid-client';
import { SsoProvider } from '@eam-platform/platform-db';

@Injectable()
export class OidcService {
  private clients = new Map<string, Client>();

  async getClient(provider: SsoProvider): Promise<Client> {
    // Cache client to avoid discovery requests on every login
    const cacheKey = `${provider.id}`;
    if (this.clients.has(cacheKey)) {
      const cached = this.clients.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const issuer = await Issuer.discover(provider.issuerUrl);
      const client = new issuer.Client({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        redirect_uris: [provider.redirectUri],
        response_types: ['code'],
      });

      this.clients.set(cacheKey, client);
      return client;
    } catch (error) {
      console.error(`Failed to discover OIDC issuer for ${provider.name}:`, error);
      throw new Error('OIDC discovery failed');
    }
  }

  async getAuthorizationUrl(provider: SsoProvider): Promise<string> {
    const client = await this.getClient(provider);
    return client.authorizationUrl({
      scope: 'openid profile email',
    });
  }

  async handleCallback(provider: SsoProvider, req: any) {
    const client = await this.getClient(provider);
    const params = client.callbackParams(req);
    
    try {
      const tokenSet = await client.callback(provider.redirectUri, params);
      if (!tokenSet.access_token) {
        throw new UnauthorizedException('Missing access token');
      }
      const userInfo = await client.userinfo(tokenSet.access_token);
      
      return {
        username: userInfo[provider.mapUsernameClaim] as string,
        email: userInfo[provider.mapEmailClaim] as string,
        displayName: userInfo[provider.mapDisplayNameClaim] as string,
      };
    } catch (error) {
      console.error('OIDC callback failed:', error);
      throw new UnauthorizedException('SSO authentication failed');
    }
  }
}
