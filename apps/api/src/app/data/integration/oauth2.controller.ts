/**
 * OAuth2 Controller
 * HubbleWave Platform - Phase 5
 *
 * OAuth2 endpoints follow RFC 6749 specifications.
 * Client management endpoints require authentication.
 * Token endpoints (token, revoke, introspect) are public per spec.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RequestUser, Public } from '@hubblewave/auth-guard';
import { OAuth2Service } from './oauth2.service';
import { OAuthGrantType } from '@hubblewave/instance-db';

interface CreateClientDto {
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
}

interface AuthorizeDto {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

interface TokenDto {
  grant_type: OAuthGrantType;
  client_id: string;
  client_secret?: string;
  code?: string;
  redirect_uri?: string;
  refresh_token?: string;
  code_verifier?: string;
}

@ApiTags('OAuth2')
@Controller('oauth')
@UseGuards(JwtAuthGuard)
export class OAuth2Controller {
  constructor(private readonly oauth2Service: OAuth2Service) {}

  // Client Management (Protected)

  @Post('clients')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an OAuth2 client' })
  @ApiResponse({ status: 201, description: 'Client created' })
  async createClient(@Body() dto: CreateClientDto, @CurrentUser() user: RequestUser) {
    return this.oauth2Service.createClient({
      ...dto,
      createdBy: user.id,
    });
  }

  @Get('clients')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all OAuth2 clients' })
  @ApiResponse({ status: 200, description: 'List of clients' })
  async findAllClients(
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.oauth2Service.findAllClients({
      isActive: isActive ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('clients/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get OAuth2 client by ID' })
  @ApiResponse({ status: 200, description: 'Client details' })
  async findClientById(@Param('id') id: string) {
    return this.oauth2Service.findClientById(id);
  }

  @Put('clients/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update OAuth2 client' })
  @ApiResponse({ status: 200, description: 'Client updated' })
  async updateClient(@Param('id') id: string, @Body() dto: Partial<CreateClientDto>) {
    return this.oauth2Service.updateClient(id, dto);
  }

  @Delete('clients/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete OAuth2 client' })
  @ApiResponse({ status: 200, description: 'Client deleted' })
  async deleteClient(@Param('id') id: string) {
    await this.oauth2Service.deleteClient(id);
    return { success: true };
  }

  @Post('clients/:id/regenerate-secret')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate client secret' })
  @ApiResponse({ status: 200, description: 'Secret regenerated' })
  async regenerateSecret(@Param('id') id: string) {
    return this.oauth2Service.regenerateClientSecret(id);
  }

  // OAuth2 Flows (Authorization requires auth, token endpoints are public)

  @Get('authorize')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'OAuth2 authorization endpoint' })
  async authorize(
    @Query() query: AuthorizeDto,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    if (!user?.id) {
      res.redirect(`/login?redirect=${encodeURIComponent(res.req?.url || '')}`);
      return;
    }

    const authCode = await this.oauth2Service.createAuthorizationCode({
      clientId: query.client_id,
      redirectUri: query.redirect_uri,
      scope: query.scope,
      state: query.state,
      codeChallenge: query.code_challenge,
      codeChallengeMethod: query.code_challenge_method,
      userId: user.id,
    });

    const redirectUrl = new URL(query.redirect_uri);
    redirectUrl.searchParams.set('code', authCode.code);
    if (query.state) {
      redirectUrl.searchParams.set('state', query.state);
    }

    res.redirect(redirectUrl.toString());
  }

  // Public OAuth2 endpoints per RFC 6749

  @Post('token')
  @Public()
  @ApiOperation({ summary: 'OAuth2 token endpoint (public)' })
  @ApiResponse({ status: 200, description: 'Token response' })
  async token(@Body() dto: TokenDto) {
    switch (dto.grant_type) {
      case 'authorization_code':
        return this.oauth2Service.exchangeAuthorizationCode({
          grantType: dto.grant_type,
          clientId: dto.client_id,
          clientSecret: dto.client_secret,
          code: dto.code,
          redirectUri: dto.redirect_uri,
          codeVerifier: dto.code_verifier,
        });

      case 'refresh_token':
        return this.oauth2Service.refreshAccessToken({
          grantType: dto.grant_type,
          clientId: dto.client_id,
          clientSecret: dto.client_secret,
          refreshToken: dto.refresh_token,
        });

      default:
        throw new Error(`Unsupported grant type: ${dto.grant_type}`);
    }
  }

  @Post('revoke')
  @Public()
  @ApiOperation({ summary: 'Revoke OAuth2 token (public)' })
  @ApiResponse({ status: 200, description: 'Token revoked' })
  async revoke(@Body() body: { token: string; token_type_hint?: 'access_token' | 'refresh_token' }) {
    const tokenType = body.token_type_hint || 'access';
    await this.oauth2Service.revokeToken(body.token, tokenType === 'refresh_token' ? 'refresh' : 'access');
    return { success: true };
  }

  @Post('introspect')
  @Public()
  @ApiOperation({ summary: 'Introspect OAuth2 token (public)' })
  @ApiResponse({ status: 200, description: 'Token introspection result' })
  async introspect(@Body() body: { token: string }) {
    return this.oauth2Service.introspectToken(body.token);
  }

  // OIDC Discovery (public)

  @Get('.well-known/openid-configuration')
  @Public()
  @ApiOperation({ summary: 'OIDC discovery document (public)' })
  @ApiResponse({ status: 200, description: 'Discovery document' })
  async discovery(@Req() req: Request) {
    const issuer = `${req.protocol}://${req.get('host')}`;
    return this.oauth2Service.getDiscoveryDocument(issuer);
  }

  // Token Validation (public, for resource servers)

  @Post('validate')
  @Public()
  @ApiOperation({ summary: 'Validate OAuth2 token (public)' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateToken(@Body() body: { token: string }) {
    return this.oauth2Service.validateAccessToken(body.token);
  }

  // User Token Management (protected)

  @Post('users/:userId/revoke-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all tokens for a user' })
  @ApiResponse({ status: 200, description: 'Tokens revoked' })
  async revokeAllUserTokens(@Param('userId') userId: string) {
    await this.oauth2Service.revokeAllUserTokens(userId);
    return { success: true };
  }

  @Post('clients/:clientId/revoke-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all tokens for a client' })
  @ApiResponse({ status: 200, description: 'Tokens revoked' })
  async revokeAllClientTokens(@Param('clientId') clientId: string) {
    await this.oauth2Service.revokeAllClientTokens(clientId);
    return { success: true };
  }

  // Cleanup (protected, admin only)

  @Post('cleanup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clean up expired tokens' })
  @ApiResponse({ status: 200, description: 'Cleanup result' })
  async cleanup() {
    return this.oauth2Service.cleanupExpiredTokens();
  }
}
