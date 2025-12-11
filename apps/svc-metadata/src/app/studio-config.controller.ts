import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RequestContext, RolesGuard, Roles } from '@eam-platform/auth-guard';
import {
  TenantDbService,
  PlatformConfig,
  TenantCustomization,
  ConfigChangeHistory,
} from '@eam-platform/tenant-db';
interface CreateCustomizationDto {
  configType: string;
  resourceKey: string;
  customizationType: 'override' | 'extend' | 'new';
  customConfig: Record<string, any>;
  basePlatformVersion?: string;
}

@Controller('studio/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class StudioConfigController {
  constructor(private readonly tenantDb: TenantDbService) {}

  // ========== Platform Config (Read-only for tenants) ==========

  @Get('platform')
  async listPlatformConfigs(
    @Query('type') configType: string,
    @Query('version') platformVersion: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    try {
      const repo = await this.tenantDb.getRepository<PlatformConfig>(ctx.tenantId, PlatformConfig);

      const where: any = {};
      if (configType) where.configType = configType;
      if (platformVersion) where.platformVersion = platformVersion;

      const [configs, total] = await repo.findAndCount({
        where,
        order: { configType: 'ASC', resourceKey: 'ASC' },
      });

      return { data: configs, total };
    } catch (error) {
      // Return empty data if tenant DB is not available
      console.warn('Failed to fetch platform configs:', (error as Error).message);
      return { data: [], total: 0 };
    }
  }

  @Get('platform/types')
  async getConfigTypes(@Req() req: any) {
    const ctx: RequestContext = req.context || req.user;

    try {
      const repo = await this.tenantDb.getRepository<PlatformConfig>(ctx.tenantId, PlatformConfig);
      const result = await repo
        .createQueryBuilder('config')
        .select('DISTINCT config.configType', 'configType')
        .getRawMany();

      return result.map((r: any) => r.configType);
    } catch (error) {
      console.warn('Failed to fetch config types:', (error as Error).message);
      return [];
    }
  }

  @Get('platform/:type/:resourceKey')
  async getPlatformConfig(
    @Param('type') configType: string,
    @Param('resourceKey') resourceKey: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    try {
      const repo = await this.tenantDb.getRepository<PlatformConfig>(ctx.tenantId, PlatformConfig);
      const config = await repo.findOne({
        where: { configType, resourceKey },
        order: { platformVersion: 'DESC' },
      });

      if (!config) {
        throw new NotFoundException('Platform config not found');
      }

      return config;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.warn('Failed to fetch platform config:', (error as Error).message);
      throw new NotFoundException('Platform config not found');
    }
  }

  // ========== Tenant Customizations ==========

  @Get('customizations')
  async listCustomizations(
    @Query('type') configType: string,
    @Query('customizationType') customizationType: string,
    @Query('active') active: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    try {
      const repo = await this.tenantDb.getRepository<TenantCustomization>(
        ctx.tenantId,
        TenantCustomization,
      );

      const where: any = { tenantId: ctx.tenantId };
      if (configType) where.configType = configType;
      if (customizationType) where.customizationType = customizationType;
      if (active !== undefined) where.isActive = active === 'true';

      const [customizations, total] = await repo.findAndCount({
        where,
        order: { configType: 'ASC', resourceKey: 'ASC' },
      });

      return { data: customizations, total };
    } catch (error) {
      // Return empty data if tenant DB is not available
      console.warn('Failed to fetch customizations:', (error as Error).message);
      return { data: [], total: 0 };
    }
  }

  @Get('customizations/history/:type/:resourceKey')
  async getCustomizationVersionHistory(
    @Param('type') configType: string,
    @Param('resourceKey') resourceKey: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;

    const repo = await this.tenantDb.getRepository<TenantCustomization>(
      ctx.tenantId,
      TenantCustomization,
    );

    // Get all versions (including inactive) for this config
    const versions = await repo.find({
      where: {
        tenantId: ctx.tenantId,
        configType,
        resourceKey: decodeURIComponent(resourceKey),
      },
      order: { version: 'DESC' },
    });

    return versions;
  }

  @Get('customizations/:id/compare')
  async compareWithPlatform(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;

    const customRepo = await this.tenantDb.getRepository<TenantCustomization>(
      ctx.tenantId,
      TenantCustomization,
    );
    const customization = await customRepo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!customization) {
      throw new NotFoundException('Customization not found');
    }

    const platformRepo = await this.tenantDb.getRepository<PlatformConfig>(
      ctx.tenantId,
      PlatformConfig,
    );
    const platformConfig = await platformRepo.findOne({
      where: { configType: customization.configType, resourceKey: customization.resourceKey },
      order: { platformVersion: 'DESC' },
    });

    // Generate diff
    const diff = this.generateDiff(platformConfig?.configData, customization.customConfig);

    return {
      customization,
      platformConfig,
      diff,
    };
  }

  @Get('customizations/:id')
  async getCustomization(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<TenantCustomization>(
      ctx.tenantId,
      TenantCustomization,
    );
    const customization = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!customization) {
      throw new NotFoundException('Customization not found');
    }

    return customization;
  }

  @Post('customizations')
  async createCustomization(@Body() body: CreateCustomizationDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<TenantCustomization>(
      ctx.tenantId,
      TenantCustomization,
    );

    // Check for existing customization
    const existing = await repo.findOne({
      where: {
        tenantId: ctx.tenantId,
        configType: body.configType,
        resourceKey: body.resourceKey,
        isActive: true,
      },
    });

    if (existing) {
      throw new ForbiddenException(
        `Customization for ${body.configType}:${body.resourceKey} already exists`,
      );
    }

    // Get base platform config if this is an override/extend
    let baseChecksum: string | undefined;
    if (body.customizationType !== 'new') {
      const platformRepo = await this.tenantDb.getRepository<PlatformConfig>(
        ctx.tenantId,
        PlatformConfig,
      );
      const platformConfig = await platformRepo.findOne({
        where: { configType: body.configType, resourceKey: body.resourceKey },
        order: { platformVersion: 'DESC' },
      });
      if (platformConfig) {
        baseChecksum = platformConfig.checksum;
      }
    }

    const customization = repo.create({
      tenantId: ctx.tenantId,
      configType: body.configType,
      resourceKey: body.resourceKey,
      customizationType: body.customizationType,
      basePlatformVersion: body.basePlatformVersion,
      baseConfigChecksum: baseChecksum,
      customConfig: body.customConfig,
      isActive: true,
      version: 1,
      createdBy: ctx.userId,
    });

    const saved = await repo.save(customization);

    // Log the change
    await this.logChange(ctx, {
      configType: body.configType,
      resourceKey: body.resourceKey,
      changeType: 'create',
      changeSource: 'admin_console',
      newValue: body.customConfig,
    });

    return saved;
  }

  @Patch('customizations/:id')
  async updateCustomization(
    @Param('id') id: string,
    @Body() body: Partial<CreateCustomizationDto>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<TenantCustomization>(
      ctx.tenantId,
      TenantCustomization,
    );
    const customization = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!customization) {
      throw new NotFoundException('Customization not found');
    }

    const previousValue = { ...customization.customConfig };

    // Create new version
    const newVersion = repo.create({
      tenantId: ctx.tenantId,
      configType: customization.configType,
      resourceKey: customization.resourceKey,
      customizationType: body.customizationType || customization.customizationType,
      basePlatformVersion: body.basePlatformVersion || customization.basePlatformVersion,
      baseConfigChecksum: customization.baseConfigChecksum,
      customConfig: body.customConfig || customization.customConfig,
      isActive: true,
      version: customization.version + 1,
      previousVersionId: customization.id,
      createdBy: ctx.userId,
    });

    // Deactivate old version
    customization.isActive = false;
    await repo.save(customization);

    const saved = await repo.save(newVersion);

    // Log the change
    await this.logChange(ctx, {
      configType: customization.configType,
      resourceKey: customization.resourceKey,
      changeType: 'update',
      changeSource: 'admin_console',
      previousValue,
      newValue: saved.customConfig,
    });

    return saved;
  }

  @Delete('customizations/:id')
  async deleteCustomization(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<TenantCustomization>(
      ctx.tenantId,
      TenantCustomization,
    );
    const customization = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!customization) {
      throw new NotFoundException('Customization not found');
    }

    const previousValue = { ...customization.customConfig };

    // Soft delete by deactivating
    customization.isActive = false;
    await repo.save(customization);

    // Log the change
    await this.logChange(ctx, {
      configType: customization.configType,
      resourceKey: customization.resourceKey,
      changeType: 'delete',
      changeSource: 'admin_console',
      previousValue,
    });

    return { success: true };
  }

  // ========== Change History ==========

  @Get('history')
  async listChangeHistory(
    @Query('type') configType: string,
    @Query('resourceKey') resourceKey: string,
    @Query('changeType') changeType: string,
    @Query('changedBy') changedBy: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    try {
      const repo = await this.tenantDb.getRepository<ConfigChangeHistory>(
        ctx.tenantId,
        ConfigChangeHistory,
      );

      const qb = repo.createQueryBuilder('history')
        .where('history.tenantId = :tenantId', { tenantId: ctx.tenantId });

      if (configType) {
        qb.andWhere('history.configType = :configType', { configType });
      }
      if (resourceKey) {
        qb.andWhere('history.resourceKey = :resourceKey', { resourceKey });
      }
      if (changeType) {
        qb.andWhere('history.changeType = :changeType', { changeType });
      }
      if (changedBy) {
        qb.andWhere('history.changedBy = :changedBy', { changedBy });
      }
      if (fromDate) {
        qb.andWhere('history.changedAt >= :fromDate', { fromDate: new Date(fromDate) });
      }
      if (toDate) {
        qb.andWhere('history.changedAt <= :toDate', { toDate: new Date(toDate) });
      }

      qb.orderBy('history.changedAt', 'DESC')
        .take(parseInt(limit, 10) || 50)
        .skip(parseInt(offset, 10) || 0);

      const [changes, total] = await qb.getManyAndCount();

      return { data: changes, total };
    } catch (error) {
      // Return empty data if tenant DB is not available
      console.warn('Failed to fetch change history:', (error as Error).message);
      return { data: [], total: 0 };
    }
  }

  @Get('history/:id')
  async getChangeDetail(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ConfigChangeHistory>(
      ctx.tenantId,
      ConfigChangeHistory,
    );
    const change = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!change) {
      throw new NotFoundException('Change history entry not found');
    }

    return change;
  }

  @Post('history/:id/rollback')
  async rollbackChange(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const historyRepo = await this.tenantDb.getRepository<ConfigChangeHistory>(
      ctx.tenantId,
      ConfigChangeHistory,
    );
    const change = await historyRepo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!change) {
      throw new NotFoundException('Change history entry not found');
    }

    if (!change.isRollbackable) {
      throw new ForbiddenException('This change cannot be rolled back');
    }

    if (!change.previousValue) {
      throw new ForbiddenException('No previous value to rollback to');
    }

    // Find and update the current customization
    const customRepo = await this.tenantDb.getRepository<TenantCustomization>(
      ctx.tenantId,
      TenantCustomization,
    );
    const current = await customRepo.findOne({
      where: {
        tenantId: ctx.tenantId,
        configType: change.configType,
        resourceKey: change.resourceKey,
        isActive: true,
      },
    });

    if (current) {
      // Create rollback version
      const rollbackVersion = customRepo.create({
        tenantId: ctx.tenantId,
        configType: change.configType,
        resourceKey: change.resourceKey,
        customizationType: current.customizationType,
        basePlatformVersion: current.basePlatformVersion,
        baseConfigChecksum: current.baseConfigChecksum,
        customConfig: change.previousValue,
        isActive: true,
        version: current.version + 1,
        previousVersionId: current.id,
        createdBy: ctx.userId,
      });

      current.isActive = false;
      await customRepo.save(current);
      await customRepo.save(rollbackVersion);
    }

    // Mark the change as rolled back
    change.rolledBackAt = new Date();
    change.rolledBackBy = ctx.userId;
    await historyRepo.save(change);

    // Log the rollback
    await this.logChange(ctx, {
      configType: change.configType,
      resourceKey: change.resourceKey,
      changeType: 'rollback',
      changeSource: 'admin_console',
      previousValue: change.newValue,
      newValue: change.previousValue,
      changeReason: body.reason || `Rollback to change ${id}`,
    });

    return { success: true };
  }

  // ========== Helper Methods ==========

  /**
   * Generate RFC 6902 JSON Patch diff between two objects
   */
  private generateDiff(
    oldValue?: Record<string, any>,
    newValue?: Record<string, any>,
  ): Array<{ op: string; path: string; value?: any }> {
    const diff: Array<{ op: string; path: string; value?: any }> = [];

    if (!oldValue && newValue) {
      diff.push({ op: 'add', path: '/', value: newValue });
      return diff;
    }
    if (oldValue && !newValue) {
      diff.push({ op: 'remove', path: '/' });
      return diff;
    }
    if (!oldValue || !newValue) {
      return diff;
    }

    const compareObjects = (oldObj: any, newObj: any, path: string) => {
      const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

      for (const key of allKeys) {
        const currentPath = `${path}/${key}`;
        const oldVal = oldObj?.[key];
        const newVal = newObj?.[key];

        if (!(key in (oldObj || {}))) {
          diff.push({ op: 'add', path: currentPath, value: newVal });
        } else if (!(key in (newObj || {}))) {
          diff.push({ op: 'remove', path: currentPath });
        } else if (
          typeof oldVal === 'object' &&
          typeof newVal === 'object' &&
          oldVal !== null &&
          newVal !== null
        ) {
          if (Array.isArray(oldVal) && Array.isArray(newVal)) {
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
              diff.push({ op: 'replace', path: currentPath, value: newVal });
            }
          } else {
            compareObjects(oldVal, newVal, currentPath);
          }
        } else if (oldVal !== newVal) {
          diff.push({ op: 'replace', path: currentPath, value: newVal });
        }
      }
    };

    compareObjects(oldValue, newValue, '');
    return diff;
  }

  private async logChange(
    ctx: RequestContext,
    data: {
      configType: string;
      resourceKey: string;
      changeType: 'create' | 'update' | 'delete' | 'restore' | 'rollback';
      changeSource: 'admin_console' | 'api' | 'upgrade' | 'import' | 'migration' | 'system';
      previousValue?: Record<string, any>;
      newValue?: Record<string, any>;
      changeReason?: string;
    },
  ) {
    const repo = await this.tenantDb.getRepository<ConfigChangeHistory>(
      ctx.tenantId,
      ConfigChangeHistory,
    );

    const history = repo.create({
      tenantId: ctx.tenantId,
      configType: data.configType,
      resourceKey: data.resourceKey,
      changeType: data.changeType,
      changeSource: data.changeSource,
      previousValue: data.previousValue,
      newValue: data.newValue,
      changeReason: data.changeReason,
      changedBy: ctx.userId,
      isRollbackable: !!data.previousValue,
    });

    await repo.save(history);
  }
}
