import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SsoProvider, User } from '@hubblewave/instance-db';
import * as crypto from 'crypto';

export interface OIDCUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
  locale?: string;
  [key: string]: unknown;
}

export interface OIDCTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface OIDCAuthState {
  providerId: string;
  nonce: string;
  redirectUri: string;
  state: string;
}

/**
 * OIDC Service - Handles OpenID Connect authentication flow
 *
 * Supports:
 * - Authorization Code Flow with PKCE
 * - Token exchange
 * - UserInfo endpoint
 * - Just-In-Time user provisioning
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  // In-memory state store (in production, use Redis)
  private stateStore = new Map<string, OIDCAuthState>();

  constructor(
    @InjectRepository(SsoProvider)
    private readonly ssoProviderRepo: Repository<SsoProvider>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Generate the authorization URL for initiating OIDC login
   */
  async getAuthorizationUrl(
    providerSlugOrId: string,
    redirectUri: string,
  ): Promise<{ url: string; state: string }> {
    const provider = await this.findProvider(providerSlugOrId);

    if (!provider.authorizationUrl) {
      throw new BadRequestException('Provider authorization URL not configured');
    }

    if (!provider.clientId) {
      throw new BadRequestException('Provider client ID not configured');
    }

    // Generate state and nonce for security
    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');

    // Store state for validation on callback
    this.stateStore.set(state, {
      providerId: provider.id,
      nonce,
      redirectUri,
      state,
    });

    // Clean up old states after 10 minutes
    setTimeout(() => this.stateStore.delete(state), 10 * 60 * 1000);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes || 'openid profile email',
      state,
      nonce,
    });

    const authUrl = `${provider.authorizationUrl}?${params.toString()}`;

    this.logger.debug(`Generated OIDC auth URL for provider ${provider.name}`);

    return { url: authUrl, state };
  }

  /**
   * Handle the OIDC callback and exchange code for tokens
   */
  async handleCallback(
    providerSlugOrId: string,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    // Validate state
    const storedState = this.stateStore.get(state);
    if (!storedState) {
      throw new UnauthorizedException('Invalid or expired state parameter');
    }
    this.stateStore.delete(state);

    const provider = await this.findProvider(providerSlugOrId);

    if (storedState.providerId !== provider.id) {
      throw new UnauthorizedException('State mismatch: provider ID does not match');
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(provider, code, redirectUri);

    // Get user info
    const userInfo = await this.getUserInfo(provider, tokens.access_token);

    // Validate email domain if restrictions are set
    if (provider.allowedDomains && provider.allowedDomains.length > 0) {
      const email = userInfo.email;
      if (!email) {
        throw new UnauthorizedException('Email is required but not provided by IdP');
      }
      const domain = email.split('@')[1]?.toLowerCase();
      const isAllowed = provider.allowedDomains.some(
        d => d.toLowerCase() === domain
      );
      if (!isAllowed) {
        throw new UnauthorizedException(`Email domain "${domain}" is not allowed for this SSO provider`);
      }
    }

    // Find or create user
    const { user, isNewUser } = await this.findOrCreateUser(provider, userInfo);

    this.logger.log(`OIDC login successful for user ${user.email} via ${provider.name}`);

    return { user, isNewUser };
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    provider: SsoProvider,
    code: string,
    redirectUri: string,
  ): Promise<OIDCTokenResponse> {
    if (!provider.tokenUrl) {
      throw new BadRequestException('Provider token URL not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId!,
    });

    if (provider.clientSecret) {
      params.append('client_secret', provider.clientSecret);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<OIDCTokenResponse>(
          provider.tokenUrl,
          params.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Token exchange failed for ${provider.name}:`, error);
      throw new UnauthorizedException('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Fetch user info from the OIDC provider
   */
  private async getUserInfo(
    provider: SsoProvider,
    accessToken: string,
  ): Promise<OIDCUserInfo> {
    if (!provider.userInfoUrl) {
      throw new BadRequestException('Provider userinfo URL not configured');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<OIDCUserInfo>(provider.userInfoUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`UserInfo fetch failed for ${provider.name}:`, error);
      throw new UnauthorizedException('Failed to fetch user information from IdP');
    }
  }

  /**
   * Find existing user or create new one (JIT provisioning)
   */
  private async findOrCreateUser(
    provider: SsoProvider,
    userInfo: OIDCUserInfo,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const email = userInfo.email?.toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Email is required but not provided by IdP');
    }

    // Try to find existing user by email
    let user = await this.userRepo.findOne({ where: { email } });
    let isNewUser = false;

    if (user) {
      // Update user profile if JIT update is enabled
      if (provider.jitUpdateProfile) {
        const updates: Record<string, unknown> = {};

        if (userInfo.name && !user.displayName) {
          updates.displayName = userInfo.name;
        }
        if (userInfo.given_name && !user.firstName) {
          updates.firstName = userInfo.given_name;
        }
        if (userInfo.family_name && !user.lastName) {
          updates.lastName = userInfo.family_name;
        }
        if (userInfo.picture && !user.avatarUrl) {
          updates.avatarUrl = userInfo.picture;
        }
        if (userInfo.locale && !user.locale) {
          updates.locale = userInfo.locale;
        }

        if (Object.keys(updates).length > 0) {
          updates.lastLoginAt = new Date();
          await this.userRepo.update(user.id, updates);
          user = await this.userRepo.findOne({ where: { id: user.id } }) || user;
        } else {
          await this.userRepo.update(user.id, { lastLoginAt: new Date() });
        }
      }
    } else if (provider.jitEnabled) {
      // Create new user via JIT provisioning
      const displayName = userInfo.name ||
        `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() ||
        email.split('@')[0];

      const newUser = this.userRepo.create({
        email,
        displayName,
        firstName: userInfo.given_name,
        lastName: userInfo.family_name,
        username: userInfo.preferred_username || email,
        avatarUrl: userInfo.picture,
        locale: userInfo.locale || 'en-US',
        status: 'active',
        emailVerified: userInfo.email_verified ?? true,
        emailVerifiedAt: userInfo.email_verified ? new Date() : undefined,
        lastLoginAt: new Date(),
        metadata: {
          ssoProviderId: provider.id,
          ssoProviderSlug: provider.slug,
          ssoSubject: userInfo.sub,
        },
      });

      user = await this.userRepo.save(newUser);
      isNewUser = true;

      this.logger.log(`JIT provisioned new user: ${user.email} via ${provider.name}`);

      // TODO: Assign default roles from provider.jitDefaultRoles
    } else {
      throw new UnauthorizedException(
        `User ${email} does not exist and Just-In-Time provisioning is disabled for this SSO provider`
      );
    }

    return { user, isNewUser };
  }

  /**
   * Find provider by slug or ID
   */
  private async findProvider(slugOrId: string): Promise<SsoProvider> {
    const provider = await this.ssoProviderRepo.findOne({
      where: [
        { slug: slugOrId, enabled: true, type: 'oidc' },
        { id: slugOrId, enabled: true, type: 'oidc' },
      ],
    });

    if (!provider) {
      throw new BadRequestException(`OIDC provider "${slugOrId}" not found or not enabled`);
    }

    return provider;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(
    providerSlugOrId: string,
    refreshToken: string,
  ): Promise<OIDCTokenResponse> {
    const provider = await this.findProvider(providerSlugOrId);

    if (!provider.tokenUrl) {
      throw new BadRequestException('Provider token URL not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: provider.clientId!,
    });

    if (provider.clientSecret) {
      params.append('client_secret', provider.clientSecret);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<OIDCTokenResponse>(
          provider.tokenUrl,
          params.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Token refresh failed for ${provider.name}:`, error);
      throw new UnauthorizedException('Failed to refresh tokens');
    }
  }
}
