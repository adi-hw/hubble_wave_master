import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  SSOConfig,
  SSOSession,
  SSOIdentity,
} from '@hubblewave/instance-db';

export interface SAMLAssertion {
  nameId: string;
  nameIdFormat: string;
  sessionIndex: string;
  attributes: Record<string, string | string[]>;
}

export interface OIDCTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface SSOUserProfile {
  externalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string[];
  department?: string;
  title?: string;
  rawAttributes: Record<string, unknown>;
}

export interface SSOLoginResult {
  success: boolean;
  userId?: string;
  sessionId?: string;
  profile?: SSOUserProfile;
  error?: string;
  isNewUser?: boolean;
}

@Injectable()
export class SSOService {
  private readonly logger = new Logger(SSOService.name);

  /**
   * Get all SSO configurations for a tenant
   */
  async getConfigs(dataSource: DataSource): Promise<SSOConfig[]> {
    const repo = dataSource.getRepository(SSOConfig);
    return repo.find({ order: { name: 'ASC' } });
  }

  /**
   * Get active SSO configuration by ID
   */
  async getConfig(
    dataSource: DataSource,
    configId: string
  ): Promise<SSOConfig | null> {
    const repo = dataSource.getRepository(SSOConfig);
    return repo.findOne({ where: { id: configId } });
  }

  /**
   * Get default SSO configuration
   */
  async getDefaultConfig(dataSource: DataSource): Promise<SSOConfig | null> {
    const repo = dataSource.getRepository(SSOConfig);
    return repo.findOne({ where: { isDefault: true, status: 'active' } });
  }

  /**
   * Create or update SSO configuration
   */
  async saveConfig(
    dataSource: DataSource,
    config: Partial<SSOConfig>
  ): Promise<SSOConfig> {
    const repo = dataSource.getRepository(SSOConfig);

    // If setting as default, unset other defaults
    if (config.isDefault) {
      await repo.update({}, { isDefault: false });
    }

    if (config.id) {
      await repo.update(config.id, config);
      return repo.findOneOrFail({ where: { id: config.id } });
    }

    const newConfig = repo.create(config);
    return repo.save(newConfig);
  }

  /**
   * Generate SAML metadata for SP
   */
  generateSAMLMetadata(
    config: SSOConfig,
    baseUrl: string
  ): string {
    const entityId = `${baseUrl}/sso/saml/${config.id}/metadata`;
    const acsUrl = `${baseUrl}/sso/saml/${config.id}/acs`;
    const sloUrl = `${baseUrl}/sso/saml/${config.id}/slo`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="true"
                   WantAssertionsSigned="true"
                   protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                         Location="${sloUrl}"/>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                              Location="${acsUrl}"
                              index="0"
                              isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  }

  /**
   * Process SAML assertion and create/update user
   */
  async processSAMLAssertion(
    dataSource: DataSource,
    configId: string,
    assertion: SAMLAssertion,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SSOLoginResult> {
    const config = await this.getConfig(dataSource, configId);
    if (!config || config.status !== 'active') {
      return { success: false, error: 'SSO configuration not found or inactive' };
    }

    try {
      // Map attributes to user profile
      const profile = this.mapAttributesToProfile(config, assertion.attributes);

      // Check domain restrictions
      if (config.allowedDomains?.length) {
        const domain = profile.email.split('@')[1];
        if (!config.allowedDomains.includes(domain)) {
          return { success: false, error: 'Email domain not allowed' };
        }
      }

      // Find or create SSO identity
      const identityRepo = dataSource.getRepository(SSOIdentity);
      let identity = await identityRepo.findOne({
        where: { ssoConfigId: configId, externalId: assertion.nameId },
      });

      let isNewUser = false;
      let userId: string;

      if (identity) {
        // Update existing identity
        userId = identity.userId;
        identity.email = profile.email;
        identity.profile = {
          firstName: profile.firstName,
          lastName: profile.lastName,
          displayName: profile.displayName,
          groups: profile.groups,
          department: profile.department,
          title: profile.title,
        };
        identity.rawAttributes = profile.rawAttributes as Record<string, unknown>;
        identity.lastLoginAt = new Date();
        identity.loginCount = identity.loginCount + 1;
        await identityRepo.save(identity);
      } else if (config.autoProvisionUsers) {
        // Auto-provision new user
        // Note: This would typically call a user service to create the user
        // For now, we'll just create the identity linking
        isNewUser = true;
        userId = crypto.randomUUID(); // Placeholder - should be actual user creation

        identity = identityRepo.create({
          ssoConfigId: configId,
          userId,
          externalId: assertion.nameId,
          email: profile.email,
          profile: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            displayName: profile.displayName,
            groups: profile.groups,
            department: profile.department,
            title: profile.title,
          },
          rawAttributes: profile.rawAttributes,
          lastLoginAt: new Date(),
          loginCount: 1,
        });
        await identityRepo.save(identity);
      } else {
        return { success: false, error: 'User not found and auto-provisioning is disabled' };
      }

      // Create SSO session
      const sessionRepo = dataSource.getRepository(SSOSession);
      const session = sessionRepo.create({
        ssoConfigId: configId,
        userId,
        sessionId: assertion.sessionIndex || crypto.randomUUID(),
        nameId: assertion.nameId,
        nameIdFormat: assertion.nameIdFormat,
        attributes: profile.rawAttributes,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + config.sessionDurationSeconds * 1000),
      });
      await sessionRepo.save(session);

      // Update config stats
      const configRepo = dataSource.getRepository(SSOConfig);
      await configRepo
        .createQueryBuilder()
        .update(SSOConfig)
        .set({
          lastUsedAt: new Date(),
          lastError: undefined,
          lastErrorAt: undefined,
        })
        .where('id = :id', { id: configId })
        .execute();

      // Increment login count separately
      await configRepo.increment({ id: configId }, 'loginCount', 1);

      return {
        success: true,
        userId,
        sessionId: session.sessionId,
        profile,
        isNewUser,
      };
    } catch (error) {
      this.logger.error('SAML assertion processing failed', error);

      // Record error
      const configRepo = dataSource.getRepository(SSOConfig);
      await configRepo.update(configId, {
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastErrorAt: new Date(),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Terminate SSO session (single logout)
   */
  async terminateSession(
    dataSource: DataSource,
    sessionId: string,
    reason: string = 'user_logout'
  ): Promise<boolean> {
    const repo = dataSource.getRepository(SSOSession);
    const result = await repo.update(
      { sessionId, isActive: true },
      {
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: reason,
      }
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(
    dataSource: DataSource,
    userId: string
  ): Promise<SSOSession[]> {
    const repo = dataSource.getRepository(SSOSession);
    return repo.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllUserSessions(
    dataSource: DataSource,
    userId: string
  ): Promise<number> {
    const repo = dataSource.getRepository(SSOSession);
    const result = await repo.update(
      { userId, isActive: true },
      {
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: 'admin_revoke',
      }
    );
    return result.affected ?? 0;
  }

  /**
   * Map SSO attributes to user profile using config mapping
   */
  private mapAttributesToProfile(
    config: SSOConfig,
    attributes: Record<string, string | string[]>
  ): SSOUserProfile {
    const mapping = config.attributeMapping || {};

    const getValue = (key?: string): string | undefined => {
      if (!key) return undefined;
      const value = attributes[key];
      return Array.isArray(value) ? value[0] : value;
    };

    const getArrayValue = (key?: string): string[] | undefined => {
      if (!key) return undefined;
      const value = attributes[key];
      return Array.isArray(value) ? value : value ? [value] : undefined;
    };

    return {
      externalId: getValue('nameId') || getValue(mapping.email) || '',
      email: getValue(mapping.email) || '',
      firstName: getValue(mapping.firstName),
      lastName: getValue(mapping.lastName),
      displayName: getValue(mapping.displayName),
      groups: getArrayValue(mapping.groups),
      department: getValue(mapping.department),
      title: getValue(mapping.title),
      rawAttributes: attributes,
    };
  }
}
