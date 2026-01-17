import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SsoProvider } from '@hubblewave/instance-db';
import { Public } from '../decorators/public.decorator';
import { OidcService } from './oidc.service';
import { SamlService } from './saml.service';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';

export interface SsoProviderInfo {
  id: string;
  name: string;
  slug: string;
  type: 'oidc' | 'saml';
  buttonText?: string;
  buttonIconUrl?: string;
}

export interface SsoConfigResponse {
  enabled: boolean;
  googleEnabled: boolean;
  microsoftEnabled: boolean;
  samlEnabled: boolean;
  oidcEnabled: boolean;
  enterpriseSsoEnabled: boolean;
  providers: SsoProviderInfo[];
}

interface InitiateSsoDto {
  redirectUri?: string;
}

interface OidcCallbackDto {
  code: string;
  state: string;
}

interface SamlCallbackDto {
  SAMLResponse: string;
  RelayState: string;
}

/**
 * SSO Controller - Provides SSO configuration, initiation, and callback handling.
 * Returns what SSO options are available so the frontend can show/hide buttons.
 */
@Controller('auth/sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(
    @InjectRepository(SsoProvider)
    private readonly ssoProviderRepo: Repository<SsoProvider>,
    private readonly oidcService: OidcService,
    private readonly samlService: SamlService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get SSO configuration for the login page.
   * This endpoint is public so the login page can check what options to show.
   */
  @Public()
  @Get('config')
  async getConfig(): Promise<SsoConfigResponse> {
    // Fetch enabled SSO providers
    const providers = await this.ssoProviderRepo.find({
      where: { enabled: true },
      select: ['id', 'name', 'slug', 'type', 'buttonText', 'buttonIconUrl'],
      order: { displayOrder: 'ASC' },
    });

    // Check for specific providers
    const googleProvider = providers.find(p =>
      p.slug === 'google' || p.name.toLowerCase().includes('google')
    );
    const microsoftProvider = providers.find(p =>
      p.slug === 'microsoft' || p.slug === 'azure-ad' ||
      p.name.toLowerCase().includes('microsoft') || p.name.toLowerCase().includes('azure')
    );

    const hasSaml = providers.some(p => p.type === 'saml');
    const hasOidc = providers.some(p => p.type === 'oidc');

    // Enterprise SSO is enabled if there are any non-Google/Microsoft OIDC or SAML providers
    const enterpriseProviders = providers.filter(p =>
      p.slug !== 'google' && p.slug !== 'microsoft' && p.slug !== 'azure-ad'
    );

    return {
      enabled: providers.length > 0,
      googleEnabled: !!googleProvider,
      microsoftEnabled: !!microsoftProvider,
      samlEnabled: hasSaml,
      oidcEnabled: hasOidc,
      enterpriseSsoEnabled: enterpriseProviders.length > 0,
      providers: providers.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        type: p.type,
        buttonText: p.buttonText,
        buttonIconUrl: p.buttonIconUrl,
      })),
    };
  }

  /**
   * Get SSO status and configuration summary
   */
  @Public()
  @Get('status')
  async getStatus() {
    const config = await this.getConfig();
    return {
      samlEnabled: config.samlEnabled,
      oidcEnabled: config.oidcEnabled,
      providers: config.providers,
    };
  }

  @Public()
  @Get('providers')
  async getProviders() {
    const config = await this.getConfig();
    return { providers: config.providers };
  }

  /**
   * Initiate SSO login - redirects to the identity provider
   */
  @Public()
  @Get('initiate/:provider')
  async initiateLogin(
    @Param('provider') providerSlug: string,
    @Query('redirect_uri') redirectUri: string,
    @Res() res: Response,
  ) {
    const provider = await this.ssoProviderRepo.findOne({
      where: [
        { slug: providerSlug, enabled: true },
        { id: providerSlug, enabled: true },
      ],
    });

    if (!provider) {
      throw new BadRequestException(`SSO provider "${providerSlug}" not found or not enabled`);
    }

    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3001';
    const finalRedirectUri = redirectUri || `${baseUrl}/`;

    if (provider.type === 'oidc') {
      const callbackUrl = `${baseUrl}/api/auth/oidc/callback`;
      const { url } = await this.oidcService.getAuthorizationUrl(providerSlug, callbackUrl);

      // Store the final redirect URI in a cookie for use after callback
      res.cookie('sso_redirect', finalRedirectUri, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      return res.redirect(url);
    } else if (provider.type === 'saml') {
      const spEntityId = `${baseUrl}/api/auth/saml/metadata`;
      const acsUrl = `${baseUrl}/api/auth/saml/acs`;
      const { url } = await this.samlService.getAuthUrl(providerSlug, finalRedirectUri, spEntityId, acsUrl);

      // Store the final redirect URI in a cookie for use after callback
      res.cookie('sso_redirect', finalRedirectUri, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      return res.redirect(url);
    }

    throw new BadRequestException(`Unsupported SSO type: ${provider.type}`);
  }

  /**
   * POST version of initiate for compatibility
   */
  @Public()
  @Post('initiate/:provider')
  async initiateLoginPost(
    @Param('provider') providerSlug: string,
    @Body() dto: InitiateSsoDto,
    @Res() res: Response,
  ) {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3001';

    const provider = await this.ssoProviderRepo.findOne({
      where: [
        { slug: providerSlug, enabled: true },
        { id: providerSlug, enabled: true },
      ],
    });

    if (!provider) {
      throw new BadRequestException(`SSO provider "${providerSlug}" not found or not enabled`);
    }

    const finalRedirectUri = dto.redirectUri || `${baseUrl}/`;

    if (provider.type === 'oidc') {
      const callbackUrl = `${baseUrl}/api/auth/oidc/callback`;
      const { url, state } = await this.oidcService.getAuthorizationUrl(providerSlug, callbackUrl);
      return res.json({ url, state, provider: providerSlug });
    } else if (provider.type === 'saml') {
      const spEntityId = `${baseUrl}/api/auth/saml/metadata`;
      const acsUrl = `${baseUrl}/api/auth/saml/acs`;
      const { url, relayState } = await this.samlService.getAuthUrl(providerSlug, finalRedirectUri, spEntityId, acsUrl);
      return res.json({ url, relayState, provider: providerSlug });
    }

    throw new BadRequestException(`Unsupported SSO type: ${provider.type}`);
  }

  /**
   * OIDC callback handler
   */
  @Public()
  @Get('oidc/callback')
  async handleOidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3001';
    const redirectUri = (req.cookies?.sso_redirect as string) || `${baseUrl}/`;

    // Clear the redirect cookie
    res.clearCookie('sso_redirect');

    if (error) {
      this.logger.warn(`OIDC callback error: ${error} - ${errorDescription}`);
      return res.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${baseUrl}/login?error=${encodeURIComponent('Missing authorization code or state')}`);
    }

    try {
      const callbackUrl = `${baseUrl}/api/auth/oidc/callback`;

      // Extract provider from state and find matching OIDC provider
      const providers = await this.ssoProviderRepo.find({
        where: { type: 'oidc', enabled: true },
      });

      let result: { user: any; isNewUser: boolean } | null = null;
      let usedProvider: SsoProvider | null = null;

      for (const provider of providers) {
        try {
          result = await this.oidcService.handleCallback(provider.slug, code, state, callbackUrl);
          usedProvider = provider;
          break;
        } catch {
          // Try next provider
          continue;
        }
      }

      if (!result || !usedProvider) {
        throw new BadRequestException('Failed to process SSO callback');
      }

      // Generate tokens for the authenticated user
      const tokens = await this.authService.generateTokensForUser(result.user, req);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect with access token in URL fragment (for SPA to capture)
      const redirectUrl = new URL(redirectUri);
      redirectUrl.hash = `access_token=${tokens.accessToken}&token_type=Bearer&expires_in=${tokens.expiresIn}`;

      return res.redirect(redirectUrl.toString());
    } catch (err) {
      this.logger.error('OIDC callback failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'SSO login failed';
      return res.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorMessage)}`);
    }
  }

  /**
   * SAML Assertion Consumer Service (ACS) - handles POST from IdP
   */
  @Public()
  @Post('saml/acs')
  async handleSamlCallback(
    @Body() body: SamlCallbackDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3001';
    const redirectUri = (req.cookies?.sso_redirect as string) || `${baseUrl}/`;

    // Clear the redirect cookie
    res.clearCookie('sso_redirect');

    if (!body.SAMLResponse || !body.RelayState) {
      return res.redirect(`${baseUrl}/login?error=${encodeURIComponent('Invalid SAML response')}`);
    }

    try {
      // Find the SAML provider from relay state
      const providers = await this.ssoProviderRepo.find({
        where: { type: 'saml', enabled: true },
      });

      let result: { user: any; isNewUser: boolean } | null = null;
      let usedProvider: SsoProvider | null = null;

      for (const provider of providers) {
        try {
          result = await this.samlService.processResponse(provider.slug, body.SAMLResponse, body.RelayState);
          usedProvider = provider;
          break;
        } catch {
          // Try next provider
          continue;
        }
      }

      if (!result || !usedProvider) {
        throw new BadRequestException('Failed to process SAML response');
      }

      // Generate tokens for the authenticated user
      const tokens = await this.authService.generateTokensForUser(result.user, req);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect with access token in URL fragment (for SPA to capture)
      const redirectUrl = new URL(redirectUri);
      redirectUrl.hash = `access_token=${tokens.accessToken}&token_type=Bearer&expires_in=${tokens.expiresIn}`;

      return res.redirect(redirectUrl.toString());
    } catch (err) {
      this.logger.error('SAML callback failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'SSO login failed';
      return res.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorMessage)}`);
    }
  }

  /**
   * SAML Metadata endpoint
   */
  @Public()
  @Get('saml/metadata')
  async getSamlMetadata(@Res() res: Response) {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3001';
    const spEntityId = `${baseUrl}/api/auth/saml/metadata`;
    const acsUrl = `${baseUrl}/api/auth/saml/acs`;
    const sloUrl = `${baseUrl}/api/auth/saml/slo`;

    const metadata = this.samlService.generateMetadata(spEntityId, acsUrl, sloUrl);

    res.setHeader('Content-Type', 'application/xml');
    return res.send(metadata);
  }

  /**
   * Handle SSO callback via POST (used by some SAML providers)
   */
  @Public()
  @Post('callback/:provider')
  async handleCallback(
    @Param('provider') providerSlug: string,
    @Body() body: OidcCallbackDto | SamlCallbackDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3001';

    const provider = await this.ssoProviderRepo.findOne({
      where: [
        { slug: providerSlug, enabled: true },
        { id: providerSlug, enabled: true },
      ],
    });

    if (!provider) {
      throw new BadRequestException(`SSO provider "${providerSlug}" not found`);
    }

    try {
      let result: { user: any; isNewUser: boolean };

      if (provider.type === 'oidc') {
        const oidcBody = body as OidcCallbackDto;
        const callbackUrl = `${baseUrl}/api/auth/oidc/callback`;
        result = await this.oidcService.handleCallback(providerSlug, oidcBody.code, oidcBody.state, callbackUrl);
      } else {
        const samlBody = body as SamlCallbackDto;
        result = await this.samlService.processResponse(providerSlug, samlBody.SAMLResponse, samlBody.RelayState);
      }

      // Generate tokens for the authenticated user
      const tokens = await this.authService.generateTokensForUser(result.user, req);

      // Return tokens as JSON for API usage
      return res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
        },
        isNewUser: result.isNewUser,
      });
    } catch (err) {
      this.logger.error(`SSO callback failed for ${providerSlug}:`, err);
      throw err;
    }
  }
}
