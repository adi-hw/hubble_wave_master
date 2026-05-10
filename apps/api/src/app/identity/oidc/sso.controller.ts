import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SsoProvider } from '@hubblewave/instance-db';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface SsoProviderDto {
  name: string;
  provider: 'saml' | 'oidc';
  enabled?: boolean;
  // SAML fields
  entityId?: string;
  ssoUrl?: string;
  sloUrl?: string;
  certificate?: string;
  // OIDC fields
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  jwksUrl?: string;
  scopes?: string;
  // JIT provisioning
  jitEnabled?: boolean;
  jitDefaultRoles?: string[];
  jitGroupMapping?: Record<string, string>;
  jitUpdateProfile?: boolean;
  // Attribute mapping
  attributeMapping?: Record<string, string>;
  // UI
  buttonText?: string;
  buttonIconUrl?: string;
  displayOrder?: number;
  // Domains
  allowedDomains?: string[];
  logoutRedirectUrl?: string;
}

interface ProviderType {
  type: string;
  name: string;
  description: string;
  icon: string;
}

interface TestResult {
  success: boolean;
  provider: string;
  message: string;
  errors?: string[];
  details?: Record<string, unknown>;
}

@Controller('admin/auth/sso')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SsoAdminController {
  private readonly logger = new Logger(SsoAdminController.name);

  constructor(
    @InjectRepository(SsoProvider) private readonly ssoProviderRepo: Repository<SsoProvider>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Get all SSO providers
   */
  @Get()
  async getProviders() {
    const providers = await this.ssoProviderRepo.find({
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
    });

    // Sanitize sensitive fields
    return {
      data: providers.map(p => this.sanitizeProvider(p)),
      total: providers.length,
    };
  }

  /**
   * Get available provider types
   */
  @Get('providers')
  getProviderTypes() {
    const types: ProviderType[] = [
      {
        type: 'saml',
        name: 'SAML 2.0',
        description: 'Security Assertion Markup Language - Used by many enterprise identity providers',
        icon: 'shield',
      },
      {
        type: 'oidc',
        name: 'OpenID Connect',
        description: 'Modern OAuth 2.0-based authentication protocol',
        icon: 'key',
      },
    ];

    return { data: types };
  }

  /**
   * Get a single provider by ID
   */
  @Get(':providerId')
  async getProvider(@Param('providerId') providerId: string) {
    const provider = await this.ssoProviderRepo.findOne({ where: { id: providerId } });
    if (!provider) {
      throw new NotFoundException('SSO provider not found');
    }
    return this.sanitizeProvider(provider);
  }

  /**
   * Create a new SSO provider
   */
  @Post()
  async createProvider(@Body() dto: SsoProviderDto) {
    // Generate slug from name
    const slug = this.generateSlug(dto.name);

    // Check if slug already exists
    const existing = await this.ssoProviderRepo.findOne({ where: { slug } });
    if (existing) {
      throw new BadRequestException(`A provider with slug "${slug}" already exists`);
    }

    // Map frontend field names to entity field names
    const provider = this.ssoProviderRepo.create({
      name: dto.name,
      slug,
      type: dto.provider,
      enabled: dto.enabled ?? false,
      // SAML
      entityId: dto.entityId,
      ssoUrl: dto.ssoUrl,
      sloUrl: dto.sloUrl,
      certificate: dto.certificate,
      // OIDC
      clientId: dto.clientId,
      clientSecret: dto.clientSecret,
      authorizationUrl: dto.authorizationUrl,
      tokenUrl: dto.tokenUrl,
      userInfoUrl: dto.userinfoUrl,
      jwksUrl: dto.jwksUrl,
      scopes: dto.scopes || 'openid profile email',
      issuer: dto.entityId || dto.authorizationUrl, // Use entityId for SAML, auth URL for OIDC
      // JIT
      jitEnabled: dto.jitEnabled ?? false,
      jitDefaultRoles: dto.jitDefaultRoles,
      jitGroupMapping: dto.jitGroupMapping,
      jitUpdateProfile: dto.jitUpdateProfile ?? true,
      // Attribute mapping
      attributeMapping: dto.attributeMapping,
      // UI
      buttonText: dto.buttonText,
      buttonIconUrl: dto.buttonIconUrl,
      displayOrder: dto.displayOrder ?? 0,
      // Domains
      allowedDomains: dto.allowedDomains,
      logoutRedirectUrl: dto.logoutRedirectUrl,
    });

    const saved = await this.ssoProviderRepo.save(provider);
    this.logger.log(`Created SSO provider: ${saved.name} (${saved.type})`);

    return this.sanitizeProvider(saved);
  }

  /**
   * Update an existing SSO provider
   */
  @Put(':providerId')
  async updateProvider(
    @Param('providerId') providerId: string,
    @Body() dto: Partial<SsoProviderDto>,
  ) {
    const existing = await this.ssoProviderRepo.findOne({ where: { id: providerId } });
    if (!existing) {
      throw new NotFoundException('SSO provider not found');
    }

    // Map frontend field names to entity field names
    const updates: Partial<SsoProvider> = {};

    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.enabled !== undefined) updates.enabled = dto.enabled;
    if (dto.entityId !== undefined) updates.entityId = dto.entityId;
    if (dto.ssoUrl !== undefined) updates.ssoUrl = dto.ssoUrl;
    if (dto.sloUrl !== undefined) updates.sloUrl = dto.sloUrl;
    if (dto.certificate !== undefined && dto.certificate !== '') {
      updates.certificate = dto.certificate;
    }
    if (dto.clientId !== undefined) updates.clientId = dto.clientId;
    if (dto.clientSecret !== undefined && dto.clientSecret !== '') {
      updates.clientSecret = dto.clientSecret;
    }
    if (dto.authorizationUrl !== undefined) updates.authorizationUrl = dto.authorizationUrl;
    if (dto.tokenUrl !== undefined) updates.tokenUrl = dto.tokenUrl;
    if (dto.userinfoUrl !== undefined) updates.userInfoUrl = dto.userinfoUrl;
    if (dto.jwksUrl !== undefined) updates.jwksUrl = dto.jwksUrl;
    if (dto.scopes !== undefined) updates.scopes = dto.scopes;
    if (dto.jitEnabled !== undefined) updates.jitEnabled = dto.jitEnabled;
    if (dto.jitDefaultRoles !== undefined) updates.jitDefaultRoles = dto.jitDefaultRoles;
    if (dto.jitGroupMapping !== undefined) updates.jitGroupMapping = dto.jitGroupMapping;
    if (dto.jitUpdateProfile !== undefined) updates.jitUpdateProfile = dto.jitUpdateProfile;
    if (dto.attributeMapping !== undefined) updates.attributeMapping = dto.attributeMapping;
    if (dto.buttonText !== undefined) updates.buttonText = dto.buttonText;
    if (dto.buttonIconUrl !== undefined) updates.buttonIconUrl = dto.buttonIconUrl;
    if (dto.displayOrder !== undefined) updates.displayOrder = dto.displayOrder;
    if (dto.allowedDomains !== undefined) updates.allowedDomains = dto.allowedDomains;
    if (dto.logoutRedirectUrl !== undefined) updates.logoutRedirectUrl = dto.logoutRedirectUrl;

    await this.ssoProviderRepo.update(providerId, updates);
    const updated = await this.ssoProviderRepo.findOne({ where: { id: providerId } });

    this.logger.log(`Updated SSO provider: ${updated?.name}`);

    return this.sanitizeProvider(updated!);
  }

  /**
   * Delete an SSO provider
   */
  @Delete(':providerId')
  async deleteProvider(@Param('providerId') providerId: string) {
    const provider = await this.ssoProviderRepo.findOne({ where: { id: providerId } });
    if (!provider) {
      throw new NotFoundException('SSO provider not found');
    }

    await this.ssoProviderRepo.softDelete(providerId);
    this.logger.log(`Deleted SSO provider: ${provider.name}`);

    return { success: true };
  }

  /**
   * Enable an SSO provider
   */
  @Post(':providerId/enable')
  @HttpCode(HttpStatus.OK)
  async enableProvider(@Param('providerId') providerId: string) {
    const provider = await this.ssoProviderRepo.findOne({ where: { id: providerId } });
    if (!provider) {
      throw new NotFoundException('SSO provider not found');
    }

    await this.ssoProviderRepo.update(providerId, { enabled: true });
    this.logger.log(`Enabled SSO provider: ${provider.name}`);

    return { success: true, enabled: true };
  }

  /**
   * Disable an SSO provider
   */
  @Post(':providerId/disable')
  @HttpCode(HttpStatus.OK)
  async disableProvider(@Param('providerId') providerId: string) {
    const provider = await this.ssoProviderRepo.findOne({ where: { id: providerId } });
    if (!provider) {
      throw new NotFoundException('SSO provider not found');
    }

    await this.ssoProviderRepo.update(providerId, { enabled: false });
    this.logger.log(`Disabled SSO provider: ${provider.name}`);

    return { success: true, enabled: false };
  }

  /**
   * Test SSO provider configuration
   */
  @Post(':providerId/test')
  @HttpCode(HttpStatus.OK)
  async testProvider(@Param('providerId') providerId: string): Promise<{ data: TestResult }> {
    const provider = await this.ssoProviderRepo.findOne({ where: { id: providerId } });
    if (!provider) {
      throw new NotFoundException('SSO provider not found');
    }

    const errors: string[] = [];
    const details: Record<string, unknown> = {};

    try {
      if (provider.type === 'oidc') {
        // Test OIDC configuration
        if (!provider.authorizationUrl) {
          errors.push('Authorization URL is required');
        }
        if (!provider.clientId) {
          errors.push('Client ID is required');
        }

        // Try to fetch OIDC discovery document if issuer is provided
        if (provider.issuer && !errors.length) {
          try {
            const discoveryUrl = provider.issuer.endsWith('/')
              ? `${provider.issuer}.well-known/openid-configuration`
              : `${provider.issuer}/.well-known/openid-configuration`;

            const response = await firstValueFrom(
              this.httpService.get(discoveryUrl, { timeout: 5000 })
            );
            details.discoveryDocument = {
              issuer: response.data.issuer,
              authorization_endpoint: response.data.authorization_endpoint,
              token_endpoint: response.data.token_endpoint,
              userinfo_endpoint: response.data.userinfo_endpoint,
            };
          } catch (err) {
            // Discovery is optional, just log it
            this.logger.debug(`OIDC discovery failed for ${provider.name}: ${err}`);
            details.discoveryStatus = 'Not available (optional)';
          }
        }

        // Test authorization URL is reachable
        if (provider.authorizationUrl) {
          try {
            await firstValueFrom(
              this.httpService.head(provider.authorizationUrl, { timeout: 5000 })
            );
            details.authorizationUrlReachable = true;
          } catch {
            // Some IdPs don't respond to HEAD, try GET
            try {
              await firstValueFrom(
                this.httpService.get(provider.authorizationUrl, {
                  timeout: 5000,
                  maxRedirects: 0,
                  validateStatus: (status) => status < 500,
                })
              );
              details.authorizationUrlReachable = true;
            } catch {
              errors.push('Authorization URL is not reachable');
              details.authorizationUrlReachable = false;
            }
          }
        }
      } else if (provider.type === 'saml') {
        // Test SAML configuration
        if (!provider.ssoUrl) {
          errors.push('SSO URL is required');
        }
        if (!provider.certificate) {
          errors.push('IdP Certificate is required');
        }

        // Test SSO URL is reachable
        if (provider.ssoUrl) {
          try {
            await firstValueFrom(
              this.httpService.get(provider.ssoUrl, {
                timeout: 5000,
                maxRedirects: 0,
                validateStatus: (status) => status < 500,
              })
            );
            details.ssoUrlReachable = true;
          } catch {
            errors.push('SSO URL is not reachable');
            details.ssoUrlReachable = false;
          }
        }

        // Validate certificate format
        if (provider.certificate) {
          const certContent = provider.certificate.trim();
          if (
            !certContent.includes('-----BEGIN CERTIFICATE-----') ||
            !certContent.includes('-----END CERTIFICATE-----')
          ) {
            errors.push('Certificate must be in PEM format (BEGIN CERTIFICATE / END CERTIFICATE)');
          } else {
            details.certificateValid = true;
          }
        }
      }

      if (errors.length > 0) {
        return {
          data: {
            success: false,
            provider: provider.type,
            message: 'Configuration validation failed',
            errors,
            details,
          },
        };
      }

      return {
        data: {
          success: true,
          provider: provider.type,
          message: `${provider.type.toUpperCase()} configuration is valid`,
          details,
        },
      };
    } catch (err) {
      this.logger.error(`SSO test failed for ${provider.name}:`, err);
      return {
        data: {
          success: false,
          provider: provider.type,
          message: 'Test failed due to an unexpected error',
          errors: [err instanceof Error ? err.message : 'Unknown error'],
        },
      };
    }
  }

  /**
   * Generate a URL-safe slug from a name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Sanitize provider for API response (hide secrets)
   */
  private sanitizeProvider(provider: SsoProvider) {
    return {
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      description: provider.description,
      provider: provider.type, // Frontend expects 'provider' not 'type'
      enabled: provider.enabled,
      // SAML
      entityId: provider.entityId,
      ssoUrl: provider.ssoUrl,
      sloUrl: provider.sloUrl,
      certificate: provider.certificate ? '*** Certificate Configured ***' : undefined,
      // OIDC
      clientId: provider.clientId,
      hasClientSecret: !!provider.clientSecret,
      authorizationUrl: provider.authorizationUrl,
      tokenUrl: provider.tokenUrl,
      userinfoUrl: provider.userInfoUrl,
      jwksUrl: provider.jwksUrl,
      scopes: provider.scopes,
      // JIT
      jitEnabled: provider.jitEnabled,
      jitDefaultRoles: provider.jitDefaultRoles,
      jitGroupMapping: provider.jitGroupMapping,
      jitUpdateProfile: provider.jitUpdateProfile,
      // Attribute mapping
      attributeMapping: provider.attributeMapping,
      // UI
      buttonText: provider.buttonText,
      buttonIconUrl: provider.buttonIconUrl,
      displayOrder: provider.displayOrder,
      // Domains
      allowedDomains: provider.allowedDomains,
      logoutRedirectUrl: provider.logoutRedirectUrl,
      // Timestamps
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }
}
