/**
 * OAuth2 Service
 * HubbleWave Platform - Phase 5
 *
 * OAuth2/OIDC authorization server implementation.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import {
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthAccessToken,
  OAuthRefreshToken,
  OAuthGrantType,
} from '@hubblewave/instance-db';

interface CreateOAuthClientDto {
  name: string;
  description?: string;
  redirectUris: string[];
  allowedScopes?: string[];
  allowedGrantTypes?: OAuthGrantType[];
  accessTokenLifetimeSeconds?: number;
  refreshTokenLifetimeSeconds?: number;
  requirePkce?: boolean;
  logoUrl?: string;
  termsUrl?: string;
  privacyUrl?: string;
  createdBy?: string;
}

interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  userId: string;
}

interface TokenRequest {
  grantType: OAuthGrantType;
  clientId: string;
  clientSecret?: string;
  code?: string;
  redirectUri?: string;
  refreshToken?: string;
  codeVerifier?: string;
}

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope: string;
  idToken?: string;
}

@Injectable()
export class OAuth2Service {
  private readonly jwtSecret: string;

  constructor(
    @InjectRepository(OAuthClient)
    private readonly clientRepo: Repository<OAuthClient>,
    @InjectRepository(OAuthAuthorizationCode)
    private readonly authCodeRepo: Repository<OAuthAuthorizationCode>,
    @InjectRepository(OAuthAccessToken)
    private readonly accessTokenRepo: Repository<OAuthAccessToken>,
    @InjectRepository(OAuthRefreshToken)
    private readonly refreshTokenRepo: Repository<OAuthRefreshToken>,
  ) {
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  }

  // Client Management

  async createClient(dto: CreateOAuthClientDto): Promise<{ client: OAuthClient; clientSecret: string }> {
    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();
    const clientSecretHash = this.hashSecret(clientSecret);

    const client = this.clientRepo.create({
      clientId,
      clientSecretHash,
      name: dto.name,
      description: dto.description,
      redirectUris: dto.redirectUris,
      allowedScopes: dto.allowedScopes || ['read', 'write'],
      allowedGrantTypes: dto.allowedGrantTypes || ['authorization_code', 'refresh_token'],
      accessTokenLifetimeSeconds: dto.accessTokenLifetimeSeconds || 3600,
      refreshTokenLifetimeSeconds: dto.refreshTokenLifetimeSeconds || 2592000,
      requirePkce: dto.requirePkce || false,
      logoUrl: dto.logoUrl,
      termsUrl: dto.termsUrl,
      privacyUrl: dto.privacyUrl,
      createdBy: dto.createdBy,
      isActive: true,
    });

    const savedClient = await this.clientRepo.save(client);

    return { client: savedClient, clientSecret };
  }

  private generateClientId(): string {
    return `hw_${crypto.randomBytes(16).toString('hex')}`;
  }

  private generateClientSecret(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  async findClientById(id: string): Promise<OAuthClient | null> {
    return this.clientRepo.findOne({ where: { id } });
  }

  async findClientByClientId(clientId: string): Promise<OAuthClient | null> {
    return this.clientRepo.findOne({ where: { clientId } });
  }

  async validateClient(clientId: string, clientSecret: string): Promise<OAuthClient | null> {
    const client = await this.findClientByClientId(clientId);
    if (!client || !client.isActive) return null;

    const secretHash = this.hashSecret(clientSecret);
    if (client.clientSecretHash !== secretHash) return null;

    return client;
  }

  async updateClient(id: string, dto: Partial<CreateOAuthClientDto>): Promise<OAuthClient> {
    await this.clientRepo.update(id, dto);
    const client = await this.findClientById(id);
    if (!client) throw new Error('OAuth client not found');
    return client;
  }

  async deleteClient(id: string): Promise<void> {
    await this.clientRepo.delete(id);
  }

  async regenerateClientSecret(id: string): Promise<{ client: OAuthClient; clientSecret: string }> {
    const clientSecret = this.generateClientSecret();
    const clientSecretHash = this.hashSecret(clientSecret);

    await this.clientRepo.update(id, { clientSecretHash });

    const client = await this.findClientById(id);
    if (!client) throw new Error('OAuth client not found');

    return { client, clientSecret };
  }

  async findAllClients(params: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: OAuthClient[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const [items, total] = await this.clientRepo.findAndCount({
      where,
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  // Authorization Flow

  async createAuthorizationCode(request: AuthorizationRequest): Promise<OAuthAuthorizationCode> {
    const client = await this.findClientByClientId(request.clientId);
    if (!client || !client.isActive) {
      throw new Error('Invalid client');
    }

    if (!client.redirectUris.includes(request.redirectUri)) {
      throw new Error('Invalid redirect URI');
    }

    const requestedScopes = request.scope.split(' ');
    const invalidScopes = requestedScopes.filter(s => !client.allowedScopes.includes(s));
    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    if (client.requirePkce && !request.codeChallenge) {
      throw new Error('PKCE required for this client');
    }

    const code = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 600000);

    const authCode = this.authCodeRepo.create({
      code,
      oauthClientId: client.id,
      userId: request.userId,
      redirectUri: request.redirectUri,
      scope: request.scope,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod,
      state: request.state,
      expiresAt,
      used: false,
    });

    return this.authCodeRepo.save(authCode);
  }

  async exchangeAuthorizationCode(request: TokenRequest): Promise<TokenResponse> {
    if (!request.code || !request.redirectUri) {
      throw new Error('Code and redirect_uri are required');
    }

    const authCode = await this.authCodeRepo.findOne({
      where: { code: request.code },
      relations: ['client'],
    });

    if (!authCode || authCode.used || authCode.expiresAt < new Date()) {
      throw new Error('Invalid or expired authorization code');
    }

    if (authCode.client.clientId !== request.clientId) {
      throw new Error('Client mismatch');
    }

    if (authCode.redirectUri !== request.redirectUri) {
      throw new Error('Redirect URI mismatch');
    }

    if (authCode.codeChallenge) {
      if (!request.codeVerifier) {
        throw new Error('Code verifier required');
      }

      const expectedChallenge = this.generateCodeChallenge(request.codeVerifier, authCode.codeChallengeMethod);
      if (expectedChallenge !== authCode.codeChallenge) {
        throw new Error('Invalid code verifier');
      }
    }

    await this.authCodeRepo.update(authCode.id, { used: true });

    return this.generateTokens(authCode.client, authCode.userId, authCode.scope || '');
  }

  private generateCodeChallenge(verifier: string, method?: string): string {
    if (method === 'S256') {
      return crypto.createHash('sha256').update(verifier).digest('base64url');
    }
    return verifier;
  }

  async refreshAccessToken(request: TokenRequest): Promise<TokenResponse> {
    if (!request.refreshToken) {
      throw new Error('Refresh token required');
    }

    const refreshToken = await this.refreshTokenRepo.findOne({
      where: { refreshToken: request.refreshToken },
      relations: ['client'],
    });

    if (!refreshToken || refreshToken.revoked || refreshToken.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    if (refreshToken.client.clientId !== request.clientId) {
      throw new Error('Client mismatch');
    }

    await this.refreshTokenRepo.update(refreshToken.id, { revoked: true, revokedAt: new Date() });

    return this.generateTokens(refreshToken.client, refreshToken.userId, refreshToken.scope || '');
  }

  private async generateTokens(client: OAuthClient, userId: string | undefined, scope: string): Promise<TokenResponse> {
    const accessTokenValue = this.generateAccessToken(client.id, userId, scope, client.accessTokenLifetimeSeconds);
    const refreshTokenValue = crypto.randomBytes(32).toString('base64url');

    const accessTokenExpiry = new Date(Date.now() + client.accessTokenLifetimeSeconds * 1000);
    const refreshTokenExpiry = new Date(Date.now() + client.refreshTokenLifetimeSeconds * 1000);

    const accessToken = this.accessTokenRepo.create({
      accessToken: accessTokenValue,
      oauthClientId: client.id,
      userId,
      scope,
      expiresAt: accessTokenExpiry,
      revoked: false,
    });

    const savedAccessToken = await this.accessTokenRepo.save(accessToken);

    const refreshToken = this.refreshTokenRepo.create({
      refreshToken: refreshTokenValue,
      accessTokenId: savedAccessToken.id,
      oauthClientId: client.id,
      userId,
      scope,
      expiresAt: refreshTokenExpiry,
      revoked: false,
    });

    await this.refreshTokenRepo.save(refreshToken);

    return {
      accessToken: accessTokenValue,
      tokenType: 'Bearer',
      expiresIn: client.accessTokenLifetimeSeconds,
      refreshToken: refreshTokenValue,
      scope,
    };
  }

  private generateAccessToken(clientId: string, userId: string | undefined, scope: string, expiresIn: number): string {
    const payload = {
      client_id: clientId,
      sub: userId,
      scope,
      type: 'access',
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  async validateAccessToken(token: string): Promise<{
    valid: boolean;
    clientId?: string;
    userId?: string;
    scope?: string;
    error?: string;
  }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as {
        client_id: string;
        sub?: string;
        scope: string;
      };

      const accessToken = await this.accessTokenRepo.findOne({
        where: { accessToken: token },
      });

      if (!accessToken || accessToken.revoked || accessToken.expiresAt < new Date()) {
        return { valid: false, error: 'Token revoked or expired' };
      }

      return {
        valid: true,
        clientId: decoded.client_id,
        userId: decoded.sub,
        scope: decoded.scope,
      };
    } catch (error) {
      return { valid: false, error: 'Invalid token' };
    }
  }

  async revokeToken(token: string, tokenType: 'access' | 'refresh'): Promise<void> {
    if (tokenType === 'access') {
      await this.accessTokenRepo.update(
        { accessToken: token },
        { revoked: true, revokedAt: new Date() },
      );
    } else {
      await this.refreshTokenRepo.update(
        { refreshToken: token },
        { revoked: true, revokedAt: new Date() },
      );
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.accessTokenRepo.update(
      { userId },
      { revoked: true, revokedAt: new Date() },
    );
    await this.refreshTokenRepo.update(
      { userId },
      { revoked: true, revokedAt: new Date() },
    );
  }

  async revokeAllClientTokens(clientId: string): Promise<void> {
    const client = await this.findClientByClientId(clientId);
    if (!client) return;

    await this.accessTokenRepo.update(
      { oauthClientId: client.id },
      { revoked: true, revokedAt: new Date() },
    );
    await this.refreshTokenRepo.update(
      { oauthClientId: client.id },
      { revoked: true, revokedAt: new Date() },
    );
  }

  // Token Introspection (RFC 7662)

  async introspectToken(token: string): Promise<{
    active: boolean;
    client_id?: string;
    username?: string;
    scope?: string;
    exp?: number;
    iat?: number;
    token_type?: string;
  }> {
    const accessToken = await this.accessTokenRepo.findOne({
      where: { accessToken: token },
      relations: ['client'],
    });

    if (!accessToken || accessToken.revoked || accessToken.expiresAt < new Date()) {
      return { active: false };
    }

    return {
      active: true,
      client_id: accessToken.client.clientId,
      scope: accessToken.scope || undefined,
      exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
      iat: Math.floor(accessToken.createdAt.getTime() / 1000),
      token_type: 'Bearer',
    };
  }

  // Cleanup

  async cleanupExpiredTokens(): Promise<{ accessTokens: number; refreshTokens: number; authCodes: number }> {
    const now = new Date();

    const accessTokenResult = await this.accessTokenRepo.delete({
      expiresAt: LessThan(now),
    });

    const refreshTokenResult = await this.refreshTokenRepo.delete({
      expiresAt: LessThan(now),
    });

    const authCodeResult = await this.authCodeRepo.delete({
      expiresAt: LessThan(now),
    });

    return {
      accessTokens: accessTokenResult.affected || 0,
      refreshTokens: refreshTokenResult.affected || 0,
      authCodes: authCodeResult.affected || 0,
    };
  }

  // OIDC Discovery

  getDiscoveryDocument(issuer: string): Record<string, unknown> {
    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      jwks_uri: `${issuer}/oauth/.well-known/jwks.json`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      introspection_endpoint: `${issuer}/oauth/introspect`,
      scopes_supported: ['openid', 'profile', 'email', 'read', 'write', 'admin'],
      response_types_supported: ['code', 'token'],
      grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256', 'HS256'],
      code_challenge_methods_supported: ['plain', 'S256'],
    };
  }
}
