import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Instance Context Service
 * Builds instance-specific context for AVA to understand the instance's unique setup
 * This makes AVA evolve with each instance's data, configuration, and customizations
 */

export interface InstanceProfile {
  // Basic info
  instanceName: string;
  industry?: string;
  timezone?: string;

  // Schema context - what collections exist
  collections: CollectionContext[];

  // Application modules enabled
  modules: ModuleContext[];

  // Terminology customizations
  terminology: Record<string, string>;

  // Business rules summary
  businessRules: BusinessRuleContext[];

  // Key metrics
  metrics: InstanceMetrics;

  // Last updated
  lastUpdated: Date;
}

export interface CollectionContext {
  code: string;
  label: string;
  pluralLabel: string;
  description?: string;
  recordCount: number;
  propertyCount: number;
  hasAttachments: boolean;
  hasComments: boolean;
  isSearchable: boolean;
}

export interface ModuleContext {
  code: string;
  label: string;
  isEnabled: boolean;
  description?: string;
}

export interface BusinessRuleContext {
  name: string;
  collection: string;
  triggerEvent: string;
  description: string;
}

export interface InstanceMetrics {
  totalRecords: number;
  activeUsers: number;
  knowledgeArticles: number;
  catalogItems: number;
  incidentsLastMonth?: number;
  requestsLastMonth?: number;
}

export interface UserProfile {
  userId: string;
  userName: string;
  email: string;
  role: string;
  department?: string;
  location?: string;

  // User's collections access
  accessibleCollections: string[];

  // Recent activity patterns
  recentCollections: string[];
  frequentActions: string[];

  // Preferences
  preferences: Record<string, unknown>;
}

@Injectable()
export class InstanceContextService {
  private readonly logger = new Logger(InstanceContextService.name);
  private readonly instanceId = process.env['INSTANCE_ID'] || 'default-instance';

  // Cache instance profiles (refresh periodically)
  private profileCache: Map<string, { profile: InstanceProfile; cachedAt: Date }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get instance profile for AVA context
   */
  async getInstanceProfile(dataSource: DataSource): Promise<InstanceProfile> {
    // Check cache
    const cached = this.profileCache.get(this.instanceId);
    if (cached && Date.now() - cached.cachedAt.getTime() < this.CACHE_TTL_MS) {
      return cached.profile;
    }

    // Build fresh profile
    const profile = await this.buildInstanceProfile(dataSource);

    // Cache it
    this.profileCache.set(this.instanceId, { profile, cachedAt: new Date() });

    return profile;
  }

  /**
   * @deprecated Use getInstanceProfile instead
   */
  async getTenantProfile(dataSource: DataSource): Promise<InstanceProfile> {
    return this.getInstanceProfile(dataSource);
  }

  /**
   * Get user profile for personalized AVA responses
   */
  async getUserProfile(
    dataSource: DataSource,
    userId: string
  ): Promise<UserProfile | null> {
    try {
      // Get basic user info with primary role from user_roles junction
      const userRows = await dataSource.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.department, u.location,
                COALESCE(r.code, 'user') as role,
                up.language, up.timezone, up.date_format, up.ava_enabled
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         LEFT JOIN user_preferences up ON up.user_id = u.id
         WHERE u.id = $1
         ORDER BY r.hierarchy_level ASC NULLS LAST
         LIMIT 1`,
        [userId]
      );

      if (userRows.length === 0) return null;

      const user = userRows[0];

      // Get accessible collections based on role
      const accessibleCollections = await this.getAccessibleCollections(
        dataSource,
        user.role
      );

      // Get recent activity
      const recentActivity = await this.getRecentActivity(dataSource, userId);

      return {
        userId: user.id,
        userName: `${user.first_name} ${user.last_name}`.trim() || user.email,
        email: user.email,
        role: user.role,
        department: user.department,
        location: user.location,
        accessibleCollections,
        recentCollections: recentActivity.collections,
        frequentActions: recentActivity.actions,
        preferences: {
          language: user.language,
          timezone: user.timezone,
          dateFormat: user.date_format,
          avaEnabled: user.ava_enabled,
        },
      };
    } catch (error) {
      this.logger.debug(`Error getting user profile: ${error}`);
      return null;
    }
  }

  /**
   * Build system prompt context from instance profile
   */
  buildContextPrompt(profile: InstanceProfile, userProfile?: UserProfile): string {
    let context = `\n## Instance Environment`;
    context += `\nOrganization: ${profile.instanceName}`;
    if (profile.industry) context += `\nIndustry: ${profile.industry}`;

    // Collections
    context += `\n\n### Available Collections`;
    for (const coll of profile.collections.slice(0, 10)) {
      context += `\n- ${coll.label} (${coll.code}): ${coll.recordCount} records`;
      if (coll.description) context += ` - ${coll.description}`;
    }

    // Modules
    const enabledModules = profile.modules.filter((m) => m.isEnabled);
    if (enabledModules.length > 0) {
      context += `\n\n### Enabled Modules`;
      for (const mod of enabledModules) {
        context += `\n- ${mod.label}`;
      }
    }

    // Terminology (so AVA uses customer's language)
    if (Object.keys(profile.terminology).length > 0) {
      context += `\n\n### Terminology`;
      context += `\nThis organization uses specific terminology:`;
      for (const [standard, custom] of Object.entries(profile.terminology)) {
        context += `\n- "${custom}" instead of "${standard}"`;
      }
    }

    // User context
    if (userProfile) {
      context += `\n\n### User Context`;
      context += `\nUser: ${userProfile.userName}`;
      context += `\nRole: ${userProfile.role}`;
      if (userProfile.department) context += `\nDepartment: ${userProfile.department}`;

      if (userProfile.recentCollections.length > 0) {
        context += `\nRecent work: ${userProfile.recentCollections.slice(0, 3).join(', ')}`;
      }

      // Access restrictions
      if (userProfile.accessibleCollections.length > 0) {
        context += `\nUser can access: ${userProfile.accessibleCollections.join(', ')}`;
      }
    }

    return context;
  }

  /**
   * Get collection-specific context for focused queries
   */
  async getCollectionContext(
    dataSource: DataSource,
    collectionCode: string
  ): Promise<string> {
    try {
      // Get collection definition
      const collRows = await dataSource.query(
        `SELECT code, label, plural_label, description, icon
         FROM collection_definitions WHERE code = $1`,
        [collectionCode]
      );

      if (collRows.length === 0) return '';

      const collection = collRows[0];

      // Get properties
      const propRows = await dataSource.query(
        `SELECT code, label, property_type, is_required, description
         FROM property_definitions
         WHERE collection_id = (SELECT id FROM collection_definitions WHERE code = $1)
         ORDER BY display_order`,
        [collectionCode]
      );

      let context = `\n\n### Collection: ${collection.label}`;
      if (collection.description) context += `\n${collection.description}`;

      context += `\n\nProperties:`;
      for (const prop of propRows) {
        context += `\n- ${prop.label} (${prop.code}): ${prop.property_type}`;
        if (prop.is_required) context += ' [required]';
      }

      return context;
    } catch (error) {
      this.logger.debug(`Error getting collection context: ${error}`);
      return '';
    }
  }

  /**
   * Build full instance profile from database
   */
  private async buildInstanceProfile(
    dataSource: DataSource
  ): Promise<InstanceProfile> {
    const profile: InstanceProfile = {
      instanceName: 'Organization', // Default
      collections: [],
      modules: [],
      terminology: {},
      businessRules: [],
      metrics: {
        totalRecords: 0,
        activeUsers: 0,
        knowledgeArticles: 0,
        catalogItems: 0,
      },
      lastUpdated: new Date(),
    };

    try {
      // Get collections
      profile.collections = await this.getCollections(dataSource);

      // Get modules
      profile.modules = await this.getModules(dataSource);

      // Get terminology customizations
      profile.terminology = await this.getTerminology(dataSource);

      // Get business rules summary
      profile.businessRules = await this.getBusinessRulesSummary(dataSource);

      // Get metrics
      profile.metrics = await this.getMetrics(dataSource);
    } catch (error) {
      this.logger.warn(`Error building instance profile: ${error}`);
    }

    return profile;
  }

  private async getCollections(dataSource: DataSource): Promise<CollectionContext[]> {
    try {
      const rows = await dataSource.query(`
        SELECT
          cd.code,
          cd.label,
          cd.plural_label,
          cd.description,
          cd.settings->>'hasAttachments' as has_attachments,
          cd.settings->>'hasComments' as has_comments,
          cd.settings->>'isSearchable' as is_searchable,
          (SELECT COUNT(*) FROM property_definitions pd WHERE pd.collection_id = cd.id) as property_count
        FROM collection_definitions cd
        WHERE cd.is_active = true
        ORDER BY cd.label
      `);

      return rows.map((row: Record<string, unknown>) => ({
        code: row['code'] as string,
        label: row['label'] as string,
        pluralLabel: (row['plural_label'] as string) || (row['label'] as string) + 's',
        description: row['description'] as string,
        recordCount: 0, // Would need dynamic counting
        propertyCount: parseInt(row['property_count'] as string, 10) || 0,
        hasAttachments: row['has_attachments'] === 'true',
        hasComments: row['has_comments'] === 'true',
        isSearchable: row['is_searchable'] !== 'false',
      }));
    } catch {
      return [];
    }
  }

  private async getModules(dataSource: DataSource): Promise<ModuleContext[]> {
    try {
      const rows = await dataSource.query(`
        SELECT code, label, description, is_enabled
        FROM application_modules
        ORDER BY display_order
      `);

      return rows.map((row: Record<string, unknown>) => ({
        code: row['code'] as string,
        label: row['label'] as string,
        description: row['description'] as string,
        isEnabled: row['is_enabled'] as boolean,
      }));
    } catch {
      return [];
    }
  }

  private async getTerminology(dataSource: DataSource): Promise<Record<string, string>> {
    try {
      const rows = await dataSource.query(`
        SELECT standard_term, custom_term
        FROM terminology_overrides
        WHERE is_active = true
      `);

      const terminology: Record<string, string> = {};
      for (const row of rows) {
        terminology[row.standard_term] = row.custom_term;
      }
      return terminology;
    } catch {
      return {};
    }
  }

  private async getBusinessRulesSummary(dataSource: DataSource): Promise<BusinessRuleContext[]> {
    try {
      const rows = await dataSource.query(`
        SELECT name, collection_code, trigger_event, description
        FROM business_rules
        WHERE is_active = true
        LIMIT 20
      `);

      return rows.map((row: Record<string, unknown>) => ({
        name: row['name'] as string,
        collection: row['collection_code'] as string,
        triggerEvent: row['trigger_event'] as string,
        description: row['description'] as string || '',
      }));
    } catch {
      return [];
    }
  }

  private async getMetrics(dataSource: DataSource): Promise<InstanceMetrics> {
    const metrics: InstanceMetrics = {
      totalRecords: 0,
      activeUsers: 0,
      knowledgeArticles: 0,
      catalogItems: 0,
    };

    try {
      // Count active users
      const userCount = await dataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE is_active = true`
      );
      metrics.activeUsers = parseInt(userCount[0]?.count || '0', 10);

      // Count knowledge articles
      const kbCount = await dataSource.query(
        `SELECT COUNT(*) as count FROM document_chunks WHERE source_type = 'knowledge_article'`
      );
      metrics.knowledgeArticles = parseInt(kbCount[0]?.count || '0', 10);

      // Count catalog items
      const catCount = await dataSource.query(
        `SELECT COUNT(*) as count FROM document_chunks WHERE source_type = 'catalog_item'`
      );
      metrics.catalogItems = parseInt(catCount[0]?.count || '0', 10);
    } catch {
      // Ignore errors
    }

    return metrics;
  }

  private async getAccessibleCollections(
    dataSource: DataSource,
    role: string
  ): Promise<string[]> {
    try {
      // Get collections this role can access
      const rows = await dataSource.query(`
        SELECT DISTINCT cd.code
        FROM collection_definitions cd
        LEFT JOIN role_permissions rp ON rp.collection_code = cd.code
        WHERE cd.is_active = true
          AND (rp.role = $1 OR rp.role IS NULL)
          AND (rp.can_read = true OR rp.can_read IS NULL)
      `, [role]);

      return rows.map((r: { code: string }) => r.code);
    } catch {
      return [];
    }
  }

  private async getRecentActivity(
    dataSource: DataSource,
    userId: string
  ): Promise<{ collections: string[]; actions: string[] }> {
    try {
      // Get recent AVA actions
      const rows = await dataSource.query(`
        SELECT target_collection, action_type, COUNT(*) as count
        FROM ava_audit_trail
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY target_collection, action_type
        ORDER BY count DESC
        LIMIT 10
      `, [userId]);

      const collections = [...new Set(rows.map((r: { target_collection: string }) => r.target_collection).filter(Boolean))];
      const actions = [...new Set(rows.map((r: { action_type: string }) => r.action_type))];

      return { collections: collections as string[], actions: actions as string[] };
    } catch {
      return { collections: [], actions: [] };
    }
  }

  /**
   * Clear cached profile for the instance
   */
  invalidateCache(): void {
    this.profileCache.delete(this.instanceId);
  }
}

// Re-export with deprecated alias for backward compatibility
export { InstanceContextService as TenantContextService };
export { InstanceProfile as TenantProfile };
export { InstanceMetrics as TenantMetrics };
