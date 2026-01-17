import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SsoProvider, User, SAMLAuthState } from '@hubblewave/instance-db';
import * as crypto from 'crypto';
import * as zlib from 'zlib';

export interface SAMLUserInfo {
  nameId: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  groups?: string[];
  attributes?: Record<string, string | string[]>;
}

/**
 * SAML Service - Handles SAML 2.0 authentication flow
 *
 * Supports:
 * - SP-initiated SSO (redirect binding)
 * - Basic SAML response parsing
 * - Just-In-Time user provisioning
 * - Persistent relay state for multi-instance deployments
 */
@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);

  constructor(
    @InjectRepository(SsoProvider)
    private readonly ssoProviderRepo: Repository<SsoProvider>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SAMLAuthState)
    private readonly samlStateRepo: Repository<SAMLAuthState>,
  ) {
    // Schedule cleanup of expired states every 5 minutes
    this.scheduleStateCleanup();
  }

  /**
   * Cleanup expired SAML auth states periodically
   */
  private scheduleStateCleanup(): void {
    setInterval(async () => {
      try {
        const result = await this.samlStateRepo.delete({
          expiresAt: LessThan(new Date()),
        });
        if (result.affected && result.affected > 0) {
          this.logger.debug(`Cleaned up ${result.affected} expired SAML auth states`);
        }
      } catch (error) {
        this.logger.warn('Failed to cleanup expired SAML states:', error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Generate the SAML authentication request URL
   */
  async getAuthUrl(
    providerSlugOrId: string,
    redirectUri: string,
    spEntityId: string,
    acsUrl: string,
  ): Promise<{ url: string; relayState: string }> {
    const provider = await this.findProvider(providerSlugOrId);

    if (!provider.ssoUrl) {
      throw new BadRequestException('Provider SSO URL not configured');
    }

    // Generate relay state for CSRF protection
    const relayState = crypto.randomBytes(32).toString('hex');

    // Store state in database for validation on callback
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const stateEntity = this.samlStateRepo.create({
      providerId: provider.id,
      relayState,
      redirectUri,
      expiresAt,
    });
    await this.samlStateRepo.save(stateEntity);

    // Generate SAML AuthnRequest
    const requestId = `_${crypto.randomBytes(16).toString('hex')}`;
    const issueInstant = new Date().toISOString();

    const authnRequest = `
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${provider.ssoUrl}"
  AssertionConsumerServiceURL="${acsUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${spEntityId}</saml:Issuer>
  <samlp:NameIDPolicy
    Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    AllowCreate="true"/>
</samlp:AuthnRequest>`.trim();

    // Deflate and base64 encode the request
    const deflated = zlib.deflateRawSync(authnRequest);
    const encoded = deflated.toString('base64');

    // Build the SSO URL with query parameters
    const params = new URLSearchParams({
      SAMLRequest: encoded,
      RelayState: relayState,
    });

    const authUrl = `${provider.ssoUrl}?${params.toString()}`;

    this.logger.debug(`Generated SAML auth URL for provider ${provider.name}`);

    return { url: authUrl, relayState };
  }

  /**
   * Process the SAML response from the IdP
   */
  async processResponse(
    providerSlugOrId: string,
    samlResponse: string,
    relayState: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    // Validate relay state from database
    const storedState = await this.samlStateRepo.findOne({
      where: { relayState },
    });
    if (!storedState) {
      throw new UnauthorizedException('Invalid or expired relay state');
    }
    if (storedState.expiresAt < new Date()) {
      await this.samlStateRepo.delete({ id: storedState.id });
      throw new UnauthorizedException('Relay state has expired');
    }
    if (storedState.consumedAt) {
      throw new UnauthorizedException('Relay state has already been used');
    }
    // Mark state as consumed
    await this.samlStateRepo.update(storedState.id, { consumedAt: new Date() });

    const provider = await this.findProvider(providerSlugOrId);

    if (storedState.providerId !== provider.id) {
      throw new UnauthorizedException('State mismatch: provider ID does not match');
    }

    // Decode and parse SAML response
    const userInfo = await this.parseSamlResponse(provider, samlResponse);

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

    this.logger.log(`SAML login successful for user ${user.email} via ${provider.name}`);

    return { user, isNewUser };
  }

  /**
   * Parse SAML response and extract user info
   *
   * Note: This is a simplified parser. For production use,
   * implement proper signature validation using the IdP certificate.
   */
  private async parseSamlResponse(
    provider: SsoProvider,
    samlResponse: string,
  ): Promise<SAMLUserInfo> {
    try {
      // Decode base64 response
      const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');

      // Basic XML parsing (in production, use proper XML parser with signature validation)
      const nameIdMatch = decoded.match(/<(?:saml2?:)?NameID[^>]*>([^<]+)<\/(?:saml2?:)?NameID>/i);
      const emailMatch = decoded.match(/<(?:saml2?:)?Attribute[^>]*Name="(?:email|Email|mail|http:\/\/schemas\.xmlsoap\.org\/ws\/2005\/05\/identity\/claims\/emailaddress)"[^>]*>[\s\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\/(?:saml2?:)?AttributeValue>/i);
      const displayNameMatch = decoded.match(/<(?:saml2?:)?Attribute[^>]*Name="(?:displayName|DisplayName|name|http:\/\/schemas\.microsoft\.com\/identity\/claims\/displayname)"[^>]*>[\s\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\/(?:saml2?:)?AttributeValue>/i);
      const firstNameMatch = decoded.match(/<(?:saml2?:)?Attribute[^>]*Name="(?:firstName|FirstName|givenName|http:\/\/schemas\.xmlsoap\.org\/ws\/2005\/05\/identity\/claims\/givenname)"[^>]*>[\s\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\/(?:saml2?:)?AttributeValue>/i);
      const lastNameMatch = decoded.match(/<(?:saml2?:)?Attribute[^>]*Name="(?:lastName|LastName|surname|sn|http:\/\/schemas\.xmlsoap\.org\/ws\/2005\/05\/identity\/claims\/surname)"[^>]*>[\s\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\/(?:saml2?:)?AttributeValue>/i);

      const nameId = nameIdMatch?.[1];
      if (!nameId) {
        throw new UnauthorizedException('SAML response missing NameID');
      }

      // Use custom attribute mapping if configured
      let email = emailMatch?.[1];
      let displayName = displayNameMatch?.[1];
      let firstName = firstNameMatch?.[1];
      let lastName = lastNameMatch?.[1];

      if (provider.attributeMapping) {
        // Apply custom attribute mappings
        const mapping = provider.attributeMapping;
        if (mapping.email) {
          const customMatch = decoded.match(new RegExp(`<(?:saml2?:)?Attribute[^>]*Name="${mapping.email}"[^>]*>[\\s\\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\\/(?:saml2?:)?AttributeValue>`, 'i'));
          if (customMatch) email = customMatch[1];
        }
        if (mapping.displayName) {
          const customMatch = decoded.match(new RegExp(`<(?:saml2?:)?Attribute[^>]*Name="${mapping.displayName}"[^>]*>[\\s\\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\\/(?:saml2?:)?AttributeValue>`, 'i'));
          if (customMatch) displayName = customMatch[1];
        }
        if (mapping.firstName) {
          const customMatch = decoded.match(new RegExp(`<(?:saml2?:)?Attribute[^>]*Name="${mapping.firstName}"[^>]*>[\\s\\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\\/(?:saml2?:)?AttributeValue>`, 'i'));
          if (customMatch) firstName = customMatch[1];
        }
        if (mapping.lastName) {
          const customMatch = decoded.match(new RegExp(`<(?:saml2?:)?Attribute[^>]*Name="${mapping.lastName}"[^>]*>[\\s\\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\\/(?:saml2?:)?AttributeValue>`, 'i'));
          if (customMatch) lastName = customMatch[1];
        }
      }

      // If email not found in attributes, check if NameID is email format
      if (!email && nameId.includes('@')) {
        email = nameId;
      }

      return {
        nameId,
        email,
        displayName,
        firstName,
        lastName,
        username: email?.split('@')[0],
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Failed to parse SAML response:', error);
      throw new UnauthorizedException('Invalid SAML response');
    }
  }

  /**
   * Find existing user or create new one (JIT provisioning)
   */
  private async findOrCreateUser(
    provider: SsoProvider,
    userInfo: SAMLUserInfo,
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

        if (userInfo.displayName && !user.displayName) {
          updates.displayName = userInfo.displayName;
        }
        if (userInfo.firstName && !user.firstName) {
          updates.firstName = userInfo.firstName;
        }
        if (userInfo.lastName && !user.lastName) {
          updates.lastName = userInfo.lastName;
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
      const displayName = userInfo.displayName ||
        `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() ||
        email.split('@')[0];

      const newUser = this.userRepo.create({
        email,
        displayName,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        username: userInfo.username || email,
        locale: 'en-US',
        status: 'active',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
        metadata: {
          ssoProviderId: provider.id,
          ssoProviderSlug: provider.slug,
          samlNameId: userInfo.nameId,
        },
      });

      user = await this.userRepo.save(newUser);
      isNewUser = true;

      this.logger.log(`JIT provisioned new user: ${user.email} via ${provider.name}`);
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
        { slug: slugOrId, enabled: true, type: 'saml' },
        { id: slugOrId, enabled: true, type: 'saml' },
      ],
    });

    if (!provider) {
      throw new BadRequestException(`SAML provider "${slugOrId}" not found or not enabled`);
    }

    return provider;
  }

  /**
   * Generate SP metadata XML
   */
  generateMetadata(
    spEntityId: string,
    acsUrl: string,
    sloUrl?: string,
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${spEntityId}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="0"
      isDefault="true"/>
    ${sloUrl ? `<md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${sloUrl}"/>` : ''}
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }
}
