import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LLMService } from './llm.service';

/**
 * Upgrade Assistant Service
 * Helps AVA assist tenants before, during, and after platform upgrades.
 *
 * Key responsibilities:
 * 1. Pre-upgrade: Analyze tenant customizations vs upgrade changes
 * 2. During upgrade: Explain what's happening and what to expect
 * 3. Post-upgrade: Help users adapt to new features and resolve issues
 */

export interface UpgradeContext {
  currentVersion: string;
  targetVersion?: string;
  customizationCount: number;
  pendingImpacts: number;
  lastUpgradeDate?: Date;
}

export interface CustomizationSummary {
  configType: string;
  resourceKey: string;
  customizationType: 'override' | 'extension' | 'new';
  description?: string;
  lastModified: Date;
  modifiedBy?: string;
}

export interface UpgradeImpactSummary {
  totalImpacts: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  conflicts: UpgradeConflict[];
  newFeatures: NewFeature[];
  deprecations: DeprecationNotice[];
}

export interface UpgradeConflict {
  id: string;
  configType: string;
  resourceKey: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  tenantValue: string;
  newPlatformValue: string;
  suggestedResolution: string;
}

export interface NewFeature {
  code: string;
  name: string;
  description: string;
  howToEnable?: string;
  benefit: string;
}

export interface DeprecationNotice {
  code: string;
  resource: string;
  message: string;
  removalVersion?: string;
  migration?: string;
}

export interface UpgradeGuidance {
  phase: 'pre' | 'during' | 'post';
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  warnings: string[];
  tips: string[];
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'required' | 'recommended' | 'optional';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  link?: string;
}

@Injectable()
export class UpgradeAssistantService {
  private readonly logger = new Logger(UpgradeAssistantService.name);
  private readonly tenantId = process.env.INSTANCE_ID || 'default-instance';

  constructor(private llmService: LLMService) {}

  /**
   * Get upgrade context for the tenant
   */
  async getUpgradeContext(dataSource: DataSource): Promise<UpgradeContext> {
    try {
      // Get current version from platform config
      const versionResult = await dataSource.query(
        `SELECT value FROM platform_config WHERE key = 'platform_version' LIMIT 1`
      );
      const currentVersion = versionResult[0]?.value || '1.0.0';

      // Count customizations
      const customResult = await dataSource.query(
        `SELECT COUNT(*) as count FROM instance_customizations WHERE is_active = true`,
        [this.tenantId]
      );
      const customizationCount = parseInt(customResult[0]?.count || '0', 10);

      // Count pending upgrade impacts
      const impactResult = await dataSource.query(
        `SELECT COUNT(*) as count FROM tenant_upgrade_impact
         WHERE tenant_id = $1 AND status IN ('pending_analysis', 'analyzed')`,
        [this.tenantId]
      );
      const pendingImpacts = parseInt(impactResult[0]?.count || '0', 10);

      // Get last upgrade date
      const upgradeResult = await dataSource.query(
        `SELECT MAX(completed_at) as last_upgrade FROM upgrade_history WHERE tenant_id = $1`,
        [this.tenantId]
      );

      return {
        currentVersion,
        customizationCount,
        pendingImpacts,
        lastUpgradeDate: upgradeResult[0]?.last_upgrade ? new Date(upgradeResult[0].last_upgrade) : undefined,
      };
    } catch (error) {
      this.logger.debug(`Error getting upgrade context: ${error}`);
      return {
        currentVersion: '1.0.0',
        customizationCount: 0,
        pendingImpacts: 0,
      };
    }
  }

  /**
   * Get tenant customizations summary
   */
  async getCustomizationsSummary(dataSource: DataSource): Promise<CustomizationSummary[]> {
    try {
      const tenantId = this.tenantId;
      const rows = await dataSource.query(
        `SELECT
          config_type,
          resource_key,
          customization_type,
          description,
          updated_at,
          updated_by
        FROM instance_customizations
        WHERE tenant_id = $1 AND is_active = true
        ORDER BY updated_at DESC
        LIMIT 100`,
        [tenantId]
      );

      return rows.map((r: Record<string, unknown>) => ({
        configType: r['config_type'] as string,
        resourceKey: r['resource_key'] as string,
        customizationType: r['customization_type'] as 'override' | 'extension' | 'new',
        description: r['description'] as string,
        lastModified: new Date(r['updated_at'] as string),
        modifiedBy: r['updated_by'] as string,
      }));
    } catch (error) {
      this.logger.debug(`Error getting customizations: ${error}`);
      return [];
    }
  }

  /**
   * Get upgrade impact summary for pending upgrades
   */
  async getUpgradeImpactSummary(
    dataSource: DataSource,
    upgradeManifestId?: string
  ): Promise<UpgradeImpactSummary> {
    const tenantId = this.tenantId;
    const summary: UpgradeImpactSummary = {
      totalImpacts: 0,
      bySeverity: {},
      byType: {},
      conflicts: [],
      newFeatures: [],
      deprecations: [],
    };

    try {
      // Build query based on whether we're looking at a specific upgrade
      let whereClause = 'tenant_id = $1';
      const params: unknown[] = [tenantId];

      if (upgradeManifestId) {
        whereClause += ' AND upgrade_manifest_id = $2';
        params.push(upgradeManifestId);
      }

      // Get impact counts by severity
      const severityRows = await dataSource.query(
        `SELECT impact_severity, COUNT(*) as count
         FROM tenant_upgrade_impact
         WHERE ${whereClause}
         GROUP BY impact_severity`,
        params
      );

      for (const row of severityRows) {
        summary.bySeverity[row.impact_severity] = parseInt(row.count, 10);
        summary.totalImpacts += parseInt(row.count, 10);
      }

      // Get impact counts by type
      const typeRows = await dataSource.query(
        `SELECT impact_type, COUNT(*) as count
         FROM tenant_upgrade_impact
         WHERE ${whereClause}
         GROUP BY impact_type`,
        params
      );

      for (const row of typeRows) {
        summary.byType[row.impact_type] = parseInt(row.count, 10);
      }

      // Get conflicts (high/critical severity)
      const conflictRows = await dataSource.query(
        `SELECT
          id, config_type, resource_key, impact_severity, description,
          current_tenant_value, new_platform_value, suggested_resolution
         FROM tenant_upgrade_impact
         WHERE ${whereClause}
           AND impact_type = 'conflict'
           AND impact_severity IN ('high', 'critical')
         ORDER BY impact_severity DESC
         LIMIT 10`,
        params
      );

      summary.conflicts = conflictRows.map((r: Record<string, unknown>) => ({
        id: r['id'] as string,
        configType: r['config_type'] as string,
        resourceKey: r['resource_key'] as string,
        severity: r['impact_severity'] as 'low' | 'medium' | 'high' | 'critical',
        description: r['description'] as string || 'Conflict detected between your customization and platform update',
        tenantValue: JSON.stringify(r['current_tenant_value']),
        newPlatformValue: JSON.stringify(r['new_platform_value']),
        suggestedResolution: r['suggested_resolution'] as string || 'Review and merge changes manually',
      }));

      // Get new features
      const featureRows = await dataSource.query(
        `SELECT DISTINCT
          i.config_type, i.resource_key, i.description,
          m.release_notes
         FROM tenant_upgrade_impact i
         JOIN upgrade_manifest m ON m.id = i.upgrade_manifest_id
         WHERE i.tenant_id = $1
           AND i.impact_type = 'new_available'
         LIMIT 10`,
        [tenantId]
      );

      summary.newFeatures = featureRows.map((r: Record<string, unknown>) => ({
        code: r['resource_key'] as string,
        name: (r['resource_key'] as string).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        description: r['description'] as string || 'New feature available in this upgrade',
        benefit: 'Enhances your platform capabilities',
      }));

      // Get deprecations
      if (upgradeManifestId) {
        const deprecationRows = await dataSource.query(
          `SELECT deprecations FROM upgrade_manifest WHERE id = $1`,
          [upgradeManifestId]
        );

        if (deprecationRows[0]?.deprecations) {
          summary.deprecations = deprecationRows[0].deprecations.map((d: Record<string, unknown>) => ({
            code: d['code'] as string,
            resource: d['resource'] as string,
            message: d['message'] as string,
            removalVersion: d['removalVersion'] as string,
            migration: d['replacement'] as string,
          }));
        }
      }
    } catch (error) {
      this.logger.debug(`Error getting upgrade impact summary: ${error}`);
    }

    return summary;
  }

  /**
   * Generate upgrade guidance for AVA to share with users
   */
  async generateUpgradeGuidance(
    dataSource: DataSource,
    phase: 'pre' | 'during' | 'post'
  ): Promise<UpgradeGuidance> {
    const context = await this.getUpgradeContext(dataSource);
    const customizations = await this.getCustomizationsSummary(dataSource);
    const impacts = await this.getUpgradeImpactSummary(dataSource);

    const guidance: UpgradeGuidance = {
      phase,
      summary: '',
      keyPoints: [],
      actionItems: [],
      warnings: [],
      tips: [],
    };

    switch (phase) {
      case 'pre':
        guidance.summary = this.generatePreUpgradeSummary(context, customizations, impacts);
        guidance.keyPoints = this.generatePreUpgradeKeyPoints(context, customizations, impacts);
        guidance.actionItems = this.generatePreUpgradeActions(context, impacts);
        guidance.warnings = this.generatePreUpgradeWarnings(impacts);
        guidance.tips = [
          'Back up any custom scripts or integrations before upgrading',
          'Review the release notes for new features that might benefit your organization',
          'Schedule the upgrade during low-usage hours if possible',
          'Communicate the upgrade schedule to your team in advance',
        ];
        break;

      case 'during':
        guidance.summary = 'The upgrade is in progress. The platform may be unavailable for a short period.';
        guidance.keyPoints = [
          'System is being upgraded to the latest version',
          'Most upgrades complete within minutes',
          'Your data and customizations are preserved',
        ];
        guidance.tips = [
          'Avoid making changes during the upgrade window',
          'If you encounter issues, wait a few minutes and refresh',
        ];
        break;

      case 'post':
        guidance.summary = this.generatePostUpgradeSummary(context, impacts);
        guidance.keyPoints = this.generatePostUpgradeKeyPoints(impacts);
        guidance.actionItems = this.generatePostUpgradeActions(impacts);
        guidance.tips = [
          'Explore new features introduced in this upgrade',
          'Check that your customizations work as expected',
          'Report any issues to your platform administrator',
          'Review deprecation notices for future planning',
        ];
        break;
    }

    return guidance;
  }

  /**
   * Ask AVA about a specific upgrade topic
   */
  async askAboutUpgrade(
    dataSource: DataSource,
    question: string
  ): Promise<string> {
    const context = await this.getUpgradeContext(dataSource);
    const customizations = await this.getCustomizationsSummary(dataSource);
    const impacts = await this.getUpgradeImpactSummary(dataSource);

    // Build context for the LLM
    const upgradeContext = `
Tenant Upgrade Context:
- Current Version: ${context.currentVersion}
- Target Version: ${context.targetVersion || 'No upgrade pending'}
- Customizations: ${context.customizationCount}
- Pending Impacts: ${context.pendingImpacts}
- Last Upgrade: ${context.lastUpgradeDate?.toISOString() || 'Never'}

Customization Summary:
${customizations.slice(0, 10).map((c) => `- ${c.configType}/${c.resourceKey} (${c.customizationType})`).join('\n')}

Upgrade Impact Summary:
- Total Impacts: ${impacts.totalImpacts}
- Critical: ${impacts.bySeverity['critical'] || 0}
- High: ${impacts.bySeverity['high'] || 0}
- Medium: ${impacts.bySeverity['medium'] || 0}
- Low: ${impacts.bySeverity['low'] || 0}
- Conflicts: ${impacts.conflicts.length}
- New Features: ${impacts.newFeatures.length}
- Deprecations: ${impacts.deprecations.length}
`;

    const prompt = `You are AVA, the AI assistant for HubbleWave. Based on the following upgrade context, answer the user's question helpfully.

${upgradeContext}

User Question: ${question}

Provide a helpful, concise answer. If there are specific conflicts or issues, explain them clearly. If the user needs to take action, provide clear steps.`;

    return this.llmService.complete(prompt, 'You are AVA, a helpful upgrade assistant for HubbleWave platform.');
  }

  /**
   * Generate customization-aware context for AVA
   */
  async buildUpgradeContextForAVA(dataSource: DataSource): Promise<string> {
    const context = await this.getUpgradeContext(dataSource);
    const impacts = await this.getUpgradeImpactSummary(dataSource);

    let upgradeInfo = `\n\n## Upgrade Status`;
    upgradeInfo += `\n- Current Platform Version: ${context.currentVersion}`;

    if (context.customizationCount > 0) {
      upgradeInfo += `\n- Tenant Customizations: ${context.customizationCount}`;
    }

    if (context.pendingImpacts > 0) {
      upgradeInfo += `\n- Pending Upgrade Impacts: ${context.pendingImpacts}`;
      if (impacts.conflicts.length > 0) {
        upgradeInfo += ` (${impacts.conflicts.length} conflicts requiring review)`;
      }
    }

    if (context.lastUpgradeDate) {
      const daysSinceUpgrade = Math.floor(
        (Date.now() - context.lastUpgradeDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      upgradeInfo += `\n- Last Upgrade: ${daysSinceUpgrade} days ago`;
    }

    if (impacts.newFeatures.length > 0) {
      upgradeInfo += `\n\n### New Features Available`;
      for (const feature of impacts.newFeatures.slice(0, 3)) {
        upgradeInfo += `\n- ${feature.name}: ${feature.description}`;
      }
    }

    if (impacts.deprecations.length > 0) {
      upgradeInfo += `\n\n### Deprecation Notices`;
      for (const dep of impacts.deprecations.slice(0, 3)) {
        upgradeInfo += `\n- ${dep.resource}: ${dep.message}`;
      }
    }

    return upgradeInfo;
  }

  // Private helper methods

  private generatePreUpgradeSummary(
    _context: UpgradeContext,
    customizations: CustomizationSummary[],
    impacts: UpgradeImpactSummary
  ): string {
    if (impacts.totalImpacts === 0) {
      return `Your organization has ${customizations.length} customization(s). Based on initial analysis, this upgrade should apply smoothly with no conflicts.`;
    }

    const criticalCount = impacts.bySeverity['critical'] || 0;
    const highCount = impacts.bySeverity['high'] || 0;

    if (criticalCount > 0) {
      return `This upgrade will affect ${impacts.totalImpacts} of your customizations, including ${criticalCount} critical conflict(s) that require your review before proceeding.`;
    }

    if (highCount > 0) {
      return `This upgrade will affect ${impacts.totalImpacts} of your customizations, with ${highCount} requiring your attention. Most changes can be merged automatically.`;
    }

    return `This upgrade will affect ${impacts.totalImpacts} of your customizations. Most impacts are minor and can be handled automatically.`;
  }

  private generatePreUpgradeKeyPoints(
    context: UpgradeContext,
    customizations: CustomizationSummary[],
    impacts: UpgradeImpactSummary
  ): string[] {
    const points: string[] = [];

    points.push(`You're upgrading from version ${context.currentVersion}`);
    points.push(`${customizations.length} customization(s) will be analyzed`);

    if (impacts.conflicts.length > 0) {
      points.push(`${impacts.conflicts.length} conflict(s) need manual resolution`);
    }

    if (impacts.newFeatures.length > 0) {
      points.push(`${impacts.newFeatures.length} new feature(s) will be available`);
    }

    if (impacts.deprecations.length > 0) {
      points.push(`${impacts.deprecations.length} feature(s) are deprecated and will need migration`);
    }

    return points;
  }

  private generatePreUpgradeActions(
    _context: UpgradeContext,
    impacts: UpgradeImpactSummary
  ): ActionItem[] {
    const actions: ActionItem[] = [];

    if (impacts.conflicts.length > 0) {
      actions.push({
        id: 'review-conflicts',
        title: 'Review Upgrade Conflicts',
        description: `Review and resolve ${impacts.conflicts.length} conflict(s) before upgrading`,
        priority: 'required',
        status: 'pending',
        link: '/admin/upgrade/impacts?filter=conflict',
      });
    }

    actions.push({
      id: 'backup-customizations',
      title: 'Backup Customizations',
      description: 'Export your current customizations as a backup',
      priority: 'recommended',
      status: 'pending',
      link: '/admin/import-export/export',
    });

    actions.push({
      id: 'review-release-notes',
      title: 'Review Release Notes',
      description: 'Read the release notes for new features and changes',
      priority: 'recommended',
      status: 'pending',
      link: '/admin/upgrade/release-notes',
    });

    if (impacts.deprecations.length > 0) {
      actions.push({
        id: 'plan-migrations',
        title: 'Plan Deprecation Migrations',
        description: `Plan migration for ${impacts.deprecations.length} deprecated feature(s)`,
        priority: 'optional',
        status: 'pending',
        link: '/admin/upgrade/deprecations',
      });
    }

    return actions;
  }

  private generatePreUpgradeWarnings(impacts: UpgradeImpactSummary): string[] {
    const warnings: string[] = [];

    const criticalCount = impacts.bySeverity['critical'] || 0;
    if (criticalCount > 0) {
      warnings.push(`${criticalCount} critical conflict(s) must be resolved before upgrading`);
    }

    if (impacts.deprecations.some((d) => d.removalVersion)) {
      warnings.push('Some deprecated features will be removed in future versions');
    }

    return warnings;
  }

  private generatePostUpgradeSummary(
    _context: UpgradeContext,
    impacts: UpgradeImpactSummary
  ): string {
    if (impacts.newFeatures.length > 0) {
      return `Upgrade complete! ${impacts.newFeatures.length} new feature(s) are now available. Your customizations have been preserved.`;
    }

    return 'Upgrade complete! Your platform is now running the latest version with all your customizations preserved.';
  }

  private generatePostUpgradeKeyPoints(impacts: UpgradeImpactSummary): string[] {
    const points: string[] = [
      'All your data has been preserved',
      'Customizations have been merged with new platform updates',
    ];

    if (impacts.newFeatures.length > 0) {
      points.push(`${impacts.newFeatures.length} new feature(s) are available to explore`);
    }

    return points;
  }

  private generatePostUpgradeActions(impacts: UpgradeImpactSummary): ActionItem[] {
    const actions: ActionItem[] = [];

    actions.push({
      id: 'verify-customizations',
      title: 'Verify Customizations',
      description: 'Verify that your customizations work as expected',
      priority: 'recommended',
      status: 'pending',
      link: '/admin/customizations',
    });

    if (impacts.newFeatures.length > 0) {
      actions.push({
        id: 'explore-features',
        title: 'Explore New Features',
        description: `Explore ${impacts.newFeatures.length} new feature(s) in this release`,
        priority: 'optional',
        status: 'pending',
        link: '/admin/upgrade/new-features',
      });
    }

    actions.push({
      id: 'report-issues',
      title: 'Report Issues',
      description: 'Report any issues you encounter after the upgrade',
      priority: 'optional',
      status: 'pending',
      link: '/support',
    });

    return actions;
  }
}
