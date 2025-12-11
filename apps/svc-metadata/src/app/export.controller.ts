import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard, RequestContext, RolesGuard, Roles } from '@eam-platform/auth-guard';
import {
  TenantDbService,
  TenantCustomization,
  ConfigChangeHistory,
  PlatformScript,
  WorkflowDefinition,
  ApprovalType,
  NotificationTemplate,
  EventDefinition,
} from '@eam-platform/tenant-db';

interface ExportOptions {
  includeCustomizations?: boolean;
  includeScripts?: boolean;
  includeWorkflows?: boolean;
  includeApprovals?: boolean;
  includeNotifications?: boolean;
  includeEvents?: boolean;
  includeBusinessRules?: boolean;
  format?: 'json' | 'yaml';
}

interface ExportPackage {
  exportedAt: string;
  exportedBy: string;
  tenantId: string;
  version: string;
  contents: {
    customizations?: any[];
    scripts?: any[];
    workflows?: any[];
    approvals?: any[];
    notifications?: any[];
    events?: any[];
    businessRules?: any[];
  };
  metadata: {
    totalItems: number;
    itemCounts: Record<string, number>;
  };
}

@Controller('admin/export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class ExportController {
  constructor(private readonly tenantDb: TenantDbService) {}

  // ========== Export ==========

  @Post()
  async createExport(@Body() options: ExportOptions, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const exportPackage: ExportPackage = {
      exportedAt: new Date().toISOString(),
      exportedBy: ctx.userId || 'unknown',
      tenantId: ctx.tenantId || 'unknown',
      version: '1.0.0',
      contents: {},
      metadata: {
        totalItems: 0,
        itemCounts: {},
      },
    };

    // Export customizations
    if (options.includeCustomizations !== false) {
      const repo = await this.tenantDb.getRepository<TenantCustomization>(
        ctx.tenantId,
        TenantCustomization,
      );
      const items = await repo.find({
        where: { tenantId: ctx.tenantId, isActive: true },
      });
      exportPackage.contents.customizations = items.map((i) => this.sanitizeForExport(i));
      exportPackage.metadata.itemCounts['customizations'] = items.length;
      exportPackage.metadata.totalItems += items.length;
    }

    // Export scripts
    if (options.includeScripts !== false) {
      const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
      const items = await repo.find({
        where: { tenantId: ctx.tenantId, source: 'tenant' },
      });
      exportPackage.contents.scripts = items.map((i) => this.sanitizeForExport(i));
      exportPackage.metadata.itemCounts['scripts'] = items.length;
      exportPackage.metadata.totalItems += items.length;
    }

    // Export workflows
    if (options.includeWorkflows !== false) {
      const repo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);
      const items = await repo.find({
        where: { tenantId: ctx.tenantId, source: 'tenant' },
      });
      exportPackage.contents.workflows = items.map((i) => this.sanitizeForExport(i));
      exportPackage.metadata.itemCounts['workflows'] = items.length;
      exportPackage.metadata.totalItems += items.length;
    }

    // Export approval types
    if (options.includeApprovals !== false) {
      const repo = await this.tenantDb.getRepository<ApprovalType>(ctx.tenantId, ApprovalType);
      const items = await repo.find({
        where: { source: 'tenant' },
      });
      exportPackage.contents.approvals = items.map((i) => this.sanitizeForExport(i));
      exportPackage.metadata.itemCounts['approvals'] = items.length;
      exportPackage.metadata.totalItems += items.length;
    }

    // Export notification templates
    if (options.includeNotifications !== false) {
      const repo = await this.tenantDb.getRepository<NotificationTemplate>(
        ctx.tenantId,
        NotificationTemplate,
      );
      const items = await repo.find({
        where: { source: 'tenant' },
      });
      exportPackage.contents.notifications = items.map((i) => this.sanitizeForExport(i));
      exportPackage.metadata.itemCounts['notifications'] = items.length;
      exportPackage.metadata.totalItems += items.length;
    }

    // Export events
    if (options.includeEvents !== false) {
      const repo = await this.tenantDb.getRepository<EventDefinition>(
        ctx.tenantId,
        EventDefinition,
      );
      const items = await repo.find({
        where: { isSystem: false },
      });
      exportPackage.contents.events = items.map((i) => this.sanitizeForExport(i));
      exportPackage.metadata.itemCounts['events'] = items.length;
      exportPackage.metadata.totalItems += items.length;
    }

    // Export business rules (stored as PlatformScript with scriptType='business_rule')
    if (options.includeBusinessRules !== false) {
      const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
      const items = await repo.find({
        where: { tenantId: ctx.tenantId, source: 'tenant', scriptType: 'business_rule' },
      });
      exportPackage.contents.businessRules = items.map((i) => this.sanitizeForExport(i));
      exportPackage.metadata.itemCounts['businessRules'] = items.length;
      exportPackage.metadata.totalItems += items.length;
    }

    return exportPackage;
  }

  @Get('download')
  async downloadExport(
    @Query('format') format: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    // Create full export
    const exportPackage = await this.createExport({}, req);

    const filename = `config-export-${ctx.tenantId}-${new Date().toISOString().split('T')[0]}`;

    if (format === 'yaml') {
      // Simple YAML-like output (basic implementation)
      const yamlContent = this.toYaml(exportPackage);
      res.set({
        'Content-Type': 'text/yaml',
        'Content-Disposition': `attachment; filename="${filename}.yaml"`,
      });
      return yamlContent;
    } else {
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      });
      return JSON.stringify(exportPackage, null, 2);
    }
  }

  // ========== Import ==========

  @Post('import')
  async importConfig(
    @Body()
    body: {
      package: ExportPackage;
      options?: {
        overwriteExisting?: boolean;
        skipConflicts?: boolean;
        dryRun?: boolean;
      };
    },
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const { package: importPackage, options = {} } = body;
    const results: {
      success: boolean;
      imported: { type: string; code: string }[];
      skipped: { type: string; code: string; reason: string }[];
      errors: { type: string; code: string; error: string }[];
    } = {
      success: true,
      imported: [],
      skipped: [],
      errors: [],
    };

    // Import customizations
    if (importPackage.contents.customizations) {
      const repo = await this.tenantDb.getRepository<TenantCustomization>(
        ctx.tenantId,
        TenantCustomization,
      );
      for (const item of importPackage.contents.customizations) {
        try {
          const existing = await repo.findOne({
            where: {
              tenantId: ctx.tenantId,
              configType: item.configType,
              resourceKey: item.resourceKey,
              isActive: true,
            },
          });

          if (existing && !options.overwriteExisting) {
            results.skipped.push({
              type: 'customization',
              code: `${item.configType}:${item.resourceKey}`,
              reason: 'Already exists',
            });
            continue;
          }

          if (!options.dryRun) {
            if (existing) {
              existing.isActive = false;
              await repo.save(existing);
            }

            const newItem = repo.create({
              ...item,
              id: undefined,
              tenantId: ctx.tenantId,
              isActive: true,
              createdBy: ctx.userId,
            });
            await repo.save(newItem);
          }

          results.imported.push({
            type: 'customization',
            code: `${item.configType}:${item.resourceKey}`,
          });
        } catch (err: any) {
          results.errors.push({
            type: 'customization',
            code: `${item.configType}:${item.resourceKey}`,
            error: err.message,
          });
          results.success = false;
        }
      }
    }

    // Import scripts
    if (importPackage.contents.scripts) {
      const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
      for (const item of importPackage.contents.scripts) {
        try {
          const existing = await repo.findOne({
            where: { code: item.code, tenantId: ctx.tenantId },
          });

          if (existing && !options.overwriteExisting) {
            results.skipped.push({
              type: 'script',
              code: item.code,
              reason: 'Already exists',
            });
            continue;
          }

          if (!options.dryRun) {
            if (existing) {
              await repo.remove(existing);
            }

            const newItem = repo.create({
              ...item,
              id: undefined,
              tenantId: ctx.tenantId,
              source: 'tenant',
              createdBy: ctx.userId,
            });
            await repo.save(newItem);
          }

          results.imported.push({ type: 'script', code: item.code });
        } catch (err: any) {
          results.errors.push({ type: 'script', code: item.code, error: err.message });
          results.success = false;
        }
      }
    }

    // Import workflows
    if (importPackage.contents.workflows) {
      const repo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);
      for (const item of importPackage.contents.workflows) {
        try {
          const existing = await repo.findOne({
            where: { code: item.code, tenantId: ctx.tenantId },
          });

          if (existing && !options.overwriteExisting) {
            results.skipped.push({
              type: 'workflow',
              code: item.code,
              reason: 'Already exists',
            });
            continue;
          }

          if (!options.dryRun) {
            if (existing) {
              await repo.remove(existing);
            }

            const newItem = repo.create({
              ...item,
              id: undefined,
              tenantId: ctx.tenantId,
              source: 'tenant',
              createdBy: ctx.userId,
            });
            await repo.save(newItem);
          }

          results.imported.push({ type: 'workflow', code: item.code });
        } catch (err: any) {
          results.errors.push({ type: 'workflow', code: item.code, error: err.message });
          results.success = false;
        }
      }
    }

    // Import business rules (stored as PlatformScript with scriptType='business_rule')
    if (importPackage.contents.businessRules) {
      const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
      for (const item of importPackage.contents.businessRules) {
        try {
          const existing = await repo.findOne({
            where: { code: item.code, tenantId: ctx.tenantId, scriptType: 'business_rule' },
          });

          if (existing && !options.overwriteExisting) {
            results.skipped.push({
              type: 'businessRule',
              code: item.code,
              reason: 'Already exists',
            });
            continue;
          }

          if (!options.dryRun) {
            if (existing) {
              await repo.remove(existing);
            }

            const newItem = repo.create({
              ...item,
              id: undefined,
              tenantId: ctx.tenantId,
              source: 'tenant',
              scriptType: 'business_rule',
              createdBy: ctx.userId,
            });
            await repo.save(newItem);
          }

          results.imported.push({ type: 'businessRule', code: item.code });
        } catch (err: any) {
          results.errors.push({ type: 'businessRule', code: item.code, error: err.message });
          results.success = false;
        }
      }
    }

    return results;
  }

  @Post('import/validate')
  async validateImport(@Body() body: { package: ExportPackage }, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const { package: importPackage } = body;
    const validation: {
      valid: boolean;
      errors: string[];
      warnings: string[];
      conflicts: { type: string; code: string }[];
    } = {
      valid: true,
      errors: [],
      warnings: [],
      conflicts: [],
    };

    // Validate structure
    if (!importPackage.version) {
      validation.errors.push('Missing version in export package');
      validation.valid = false;
    }

    if (!importPackage.contents) {
      validation.errors.push('Missing contents in export package');
      validation.valid = false;
    }

    // Check for conflicts
    if (importPackage.contents.scripts) {
      const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
      for (const item of importPackage.contents.scripts) {
        const existing = await repo.findOne({
          where: { code: item.code, tenantId: ctx.tenantId },
        });
        if (existing) {
          validation.conflicts.push({ type: 'script', code: item.code });
        }
      }
    }

    if (importPackage.contents.workflows) {
      const repo = await this.tenantDb.getRepository<WorkflowDefinition>(ctx.tenantId, WorkflowDefinition);
      for (const item of importPackage.contents.workflows) {
        const existing = await repo.findOne({ where: { code: item.code, tenantId: ctx.tenantId } });
        if (existing) {
          validation.conflicts.push({ type: 'workflow', code: item.code });
        }
      }
    }

    if (validation.conflicts.length > 0) {
      validation.warnings.push(
        `${validation.conflicts.length} items already exist and will be skipped unless overwrite is enabled`,
      );
    }

    return validation;
  }

  // ========== History Export ==========

  @Get('history')
  async exportHistory(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('configType') configType: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ConfigChangeHistory>(
      ctx.tenantId,
      ConfigChangeHistory,
    );

    const queryBuilder = repo
      .createQueryBuilder('history')
      .where('history.tenantId = :tenantId', { tenantId: ctx.tenantId });

    if (from) {
      queryBuilder.andWhere('history.changedAt >= :from', { from: new Date(from) });
    }
    if (to) {
      queryBuilder.andWhere('history.changedAt <= :to', { to: new Date(to) });
    }
    if (configType) {
      queryBuilder.andWhere('history.configType = :configType', { configType });
    }

    queryBuilder.orderBy('history.changedAt', 'DESC');

    const history = await queryBuilder.getMany();

    return {
      exportedAt: new Date().toISOString(),
      tenantId: ctx.tenantId,
      filters: { from, to, configType },
      totalChanges: history.length,
      changes: history,
    };
  }

  // ========== Helper Methods ==========

  private sanitizeForExport(item: any): any {
    const sanitized = { ...item };
    // Remove internal fields
    delete sanitized.id;
    delete sanitized.tenantId;
    delete sanitized.createdBy;
    delete sanitized.updatedBy;
    delete sanitized.createdAt;
    delete sanitized.updatedAt;
    return sanitized;
  }

  private toYaml(obj: any, indent = 0): string {
    const lines: string[] = [];
    const prefix = '  '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        lines.push(`${prefix}${key}: null`);
      } else if (Array.isArray(value)) {
        lines.push(`${prefix}${key}:`);
        for (const item of value) {
          if (typeof item === 'object') {
            lines.push(`${prefix}  -`);
            lines.push(this.toYaml(item, indent + 2));
          } else {
            lines.push(`${prefix}  - ${item}`);
          }
        }
      } else if (typeof value === 'object') {
        lines.push(`${prefix}${key}:`);
        lines.push(this.toYaml(value, indent + 1));
      } else if (typeof value === 'string' && value.includes('\n')) {
        lines.push(`${prefix}${key}: |`);
        for (const line of value.split('\n')) {
          lines.push(`${prefix}  ${line}`);
        }
      } else {
        lines.push(`${prefix}${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }
}
