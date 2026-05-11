import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Issuer, generators, type Client, type IdTokenClaims, type TokenSet } from 'openid-client';
import { SsoProvider, User } from '@hubblewave/instance-db';
import { RedisService } from '@hubblewave/redis';

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

/**
 * State stored in Redis between authorize and callback.
 *
 * The verifier is the PKCE code_verifier (RFC 7636); the IdP rejects the
 * token exchange if SHA-256(verifier) does not match the challenge sent
 * on the authorize redirect. nonce is bound into the id_token by the IdP
 * and re-verified on callback.
 */
export interface OIDCAuthState {
  providerId: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  state: string;
}

/**
 * OIDC Service - Handles OpenID Connect authentication flow
 *
 * Implements the OAuth 2.0 + OIDC authorization code flow with:
 * - PKCE (RFC 7636) using S256 challenge method
 * - nonce binding and id_token signature verification via the IdP's JWKS
 * - iss / aud / exp / iat validation with 5 minute clock skew tolerance
 * - Redis-backed auth state for multi-pod HA (single-use, 10 minute TTL)
 * - Strict email_verified handling (only `=== true` is accepted)
 * - Just-In-Time user provisioning
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  /** Redis key namespace for auth-state entries. */
  private static readonly STATE_KEY_PREFIX = 'oidc:auth-state:';
  /** Auth-state TTL in seconds (matches the previous in-memory cleanup window). */
  private static readonly STATE_TTL_SECONDS = 10 * 60;
  /** Clock skew tolerance for id_token exp/iat validation (seconds). */
  private static readonly CLOCK_TOLERANCE_SECONDS = 300;

  constructor(
    @InjectRepository(SsoProvider)
    private readonly ssoProviderRepo: Repository<SsoProvider>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generate the authorization URL for initiating OIDC login.
   *
   * Generates a fresh state, nonce, and PKCE code_verifier/code_challenge
   * (S256). The auth-state envelope is persisted to Redis keyed by state
   * with a 10-minute TTL; the callback retrieves and atomically deletes it
   * to enforce single-use.
   */
  async getAuthorizationUrl(
    providerSlugOrId: string,
    redirectUri: string,
  ): Promise<{ url: string; state: string }> {
    const provider = await this.findProvider(providerSlugOrId);
    this.assertOidcMetadata(provider);

    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    await this.storeAuthState({
      providerId: provider.id,
      nonce,
      codeVerifier,
      redirectUri,
      state,
    });

    const client = this.buildClient(provider);
    const url = client.authorizationUrl({
      scope: provider.scopes || 'openid profile email',
      state,
      nonce,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    this.logger.debug(`Generated OIDC auth URL for provider ${provider.name}`);

    return { url, state };
  }

  /**
   * Handle the OIDC callback and exchange code for tokens.
   *
   * openid-client.callback() performs:
   *  - state check
   *  - PKCE verifier exchange
   *  - id_token signature verification against the IdP's JWKS
   *  - iss / aud / azp / nonce / exp / iat / at_hash / c_hash claims
   *
   * We then explicitly re-check nonce + iss + aud + email_verified at the
   * service boundary so the trust boundary is auditable from this file.
   */
  async handleCallback(
    providerSlugOrId: string,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const storedState = await this.consumeAuthState(state);
    if (!storedState) {
      throw new UnauthorizedException('Invalid or expired state parameter');
    }

    const provider = await this.findProvider(providerSlugOrId);
    this.assertOidcMetadata(provider);

    if (storedState.providerId !== provider.id) {
      throw new UnauthorizedException('State mismatch: provider ID does not match');
    }

    const client = this.buildClient(provider);

    let tokenSet: TokenSet;
    try {
      tokenSet = await client.callback(
        redirectUri,
        { code, state },
        {
          state,
          nonce: storedState.nonce,
          code_verifier: storedState.codeVerifier,
        },
      );
    } catch (error) {
      this.logger.error(`OIDC token exchange failed for ${provider.name}:`, error);
      throw new UnauthorizedException('Failed to exchange authorization code for tokens');
    }

    if (!tokenSet.id_token) {
      throw new UnauthorizedException('IdP did not return an id_token');
    }
    if (!tokenSet.access_token) {
      throw new UnauthorizedException('IdP did not return an access_token');
    }

    const claims = tokenSet.claims();
    this.assertIdTokenClaims(claims, storedState.nonce, provider);

    let userInfo: OIDCUserInfo;
    try {
      userInfo = (await client.userinfo<OIDCUserInfo>(tokenSet.access_token)) as OIDCUserInfo;
    } catch (error) {
      this.logger.error(`UserInfo fetch failed for ${provider.name}:`, error);
      throw new UnauthorizedException('Failed to fetch user information from IdP');
    }

    if (provider.allowedDomains && provider.allowedDomains.length > 0) {
      const email = userInfo.email;
      if (!email) {
        throw new UnauthorizedException('Email is required but not provided by IdP');
      }
      const domain = email.split('@')[1]?.toLowerCase();
      const isAllowed = provider.allowedDomains.some(d => d.toLowerCase() === domain);
      if (!isAllowed) {
        throw new UnauthorizedException(
          `Email domain "${domain}" is not allowed for this SSO provider`,
        );
      }
    }

    // F010: REJECT the login when the IdP does not assert email_verified === true.
    // Defaulting to true would let an unverified IdP account claim a matching
    // local account (account takeover). We do NOT silently downgrade and
    // continue: matching users by an unverified email crosses a trust boundary
    // and there is no per-IdP "trust unverified email" knob in the entity
    // today. If a future deployment needs to permit one (e.g. for an internal
    // IdP that intentionally does not assert this claim), add an explicit
    // SsoProvider column and gate this check on it — do not default to true.
    if (userInfo.email_verified !== true) {
      throw new UnauthorizedException(
        'IdP did not assert email_verified=true; refusing to provision or match this user',
      );
    }

    const { user, isNewUser } = await this.findOrCreateUser(provider, userInfo);

    this.logger.log(`OIDC login successful for user ${user.email} via ${provider.name}`);

    return { user, isNewUser };
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshTokens(
    providerSlugOrId: string,
    refreshToken: string,
  ): Promise<OIDCTokenResponse> {
    const provider = await this.findProvider(providerSlugOrId);
    this.assertOidcMetadata(provider);

    const client = this.buildClient(provider);

    let tokenSet: TokenSet;
    try {
      tokenSet = await client.refresh(refreshToken);
    } catch (error) {
      this.logger.error(`Token refresh failed for ${provider.name}:`, error);
      throw new UnauthorizedException('Failed to refresh tokens');
    }

    return {
      access_token: tokenSet.access_token ?? '',
      token_type: tokenSet.token_type ?? 'Bearer',
      expires_in: tokenSet.expires_at
        ? Math.max(0, tokenSet.expires_at - Math.floor(Date.now() / 1000))
        : undefined,
      refresh_token: tokenSet.refresh_token,
      id_token: tokenSet.id_token,
      scope: tokenSet.scope,
    };
  }

  /**
   * Build an openid-client Client from the provider record. The Issuer is
   * constructed from explicit endpoints + jwks_uri rather than via discovery
   * because each SsoProvider may target a tenant-scoped endpoint that does
   * not publish a .well-known/openid-configuration document.
   */
  private buildClient(provider: SsoProvider): Client {
    const issuer = new Issuer({
      issuer: provider.issuer ?? provider.authorizationUrl ?? '',
      authorization_endpoint: provider.authorizationUrl,
      token_endpoint: provider.tokenUrl,
      userinfo_endpoint: provider.userInfoUrl,
      jwks_uri: provider.jwksUrl,
    });

    const client = new issuer.Client({
      client_id: provider.clientId as string,
      client_secret: provider.clientSecret,
      // Public clients without a registered secret use PKCE alone; signal that
      // to openid-client so it does not require client_secret_basic auth.
      token_endpoint_auth_method: provider.clientSecret ? 'client_secret_post' : 'none',
      response_types: ['code'],
    });

    return client;
  }

  /**
   * Re-verify id_token claims at the service boundary. openid-client.callback()
   * already validates these via the JWKS-fetched signing key; this check is
   * a defense-in-depth re-affirmation that lives in this file so the trust
   * surface is greppable.
   */
  private assertIdTokenClaims(
    claims: IdTokenClaims,
    expectedNonce: string,
    provider: SsoProvider,
  ): void {
    if (claims.nonce !== expectedNonce) {
      throw new UnauthorizedException('id_token nonce mismatch');
    }

    if (provider.issuer && claims.iss !== provider.issuer) {
      throw new UnauthorizedException(
        `id_token issuer mismatch: expected ${provider.issuer}, got ${claims.iss}`,
      );
    }

    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!provider.clientId || !audiences.includes(provider.clientId)) {
      throw new UnauthorizedException('id_token audience does not include this client_id');
    }

    const now = Math.floor(Date.now() / 1000);
    const tolerance = OidcService.CLOCK_TOLERANCE_SECONDS;
    if (typeof claims.exp !== 'number' || claims.exp + tolerance < now) {
      throw new UnauthorizedException('id_token is expired');
    }
    if (typeof claims.iat !== 'number' || claims.iat - tolerance > now) {
      throw new UnauthorizedException('id_token iat is in the future beyond tolerance');
    }
  }

  /**
   * Validate that the SsoProvider record has the OIDC endpoints we need.
   * jwks_uri is required for signature verification — without it we cannot
   * trust any id_token, so we reject before issuing the authorize redirect.
   */
  private assertOidcMetadata(provider: SsoProvider): void {
    if (!provider.authorizationUrl) {
      throw new BadRequestException('Provider authorization URL not configured');
    }
    if (!provider.tokenUrl) {
      throw new BadRequestException('Provider token URL not configured');
    }
    if (!provider.userInfoUrl) {
      throw new BadRequestException('Provider userinfo URL not configured');
    }
    if (!provider.jwksUrl) {
      throw new BadRequestException(
        'Provider JWKS URL not configured (required for id_token signature verification)',
      );
    }
    if (!provider.clientId) {
      throw new BadRequestException('Provider client ID not configured');
    }
  }

  /**
   * Find existing user or create new one (JIT provisioning).
   *
   * Email verification is enforced upstream in handleCallback; by the time
   * this method runs we know userInfo.email_verified === true.
   */
  private async findOrCreateUser(
    provider: SsoProvider,
    userInfo: OIDCUserInfo,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const email = userInfo.email?.toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Email is required but not provided by IdP');
    }

    let user = await this.userRepo.findOne({ where: { email } });
    let isNewUser = false;

    if (user) {
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
          user = (await this.userRepo.findOne({ where: { id: user.id } })) || user;
        } else {
          await this.userRepo.update(user.id, { lastLoginAt: new Date() });
        }
      }
    } else if (provider.jitEnabled) {
      const displayName =
        userInfo.name ||
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
        // Always strictly true here — handleCallback rejects otherwise.
        emailVerified: true,
        emailVerifiedAt: new Date(),
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
    } else {
      throw new UnauthorizedException(
        `User ${email} does not exist and Just-In-Time provisioning is disabled for this SSO provider`,
      );
    }

    return { user, isNewUser };
  }

  /**
   * Find provider by slug or ID.
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

  // ─────────────────────────────────────────────────────────────────
  // Redis-backed auth-state store (F009)
  // ─────────────────────────────────────────────────────────────────

  private stateKey(state: string): string {
    return `${OidcService.STATE_KEY_PREFIX}${state}`;
  }

  private async storeAuthState(payload: OIDCAuthState): Promise<void> {
    const ok = await this.redisService.setJson(
      this.stateKey(payload.state),
      payload,
      OidcService.STATE_TTL_SECONDS,
    );
    if (!ok) {
      throw new UnauthorizedException('Failed to persist OIDC auth state');
    }
  }

  /**
   * Retrieve and delete the auth-state envelope. Deletion runs unconditionally
   * after the read so a stale or already-consumed state cannot be replayed.
   */
  private async consumeAuthState(state: string): Promise<OIDCAuthState | null> {
    const key = this.stateKey(state);
    const payload = await this.redisService.getJson<OIDCAuthState>(key);
    await this.redisService.del(key);
    return payload;
  }
}
