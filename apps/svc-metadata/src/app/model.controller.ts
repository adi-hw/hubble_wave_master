import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RequestContext } from '@eam-platform/auth-guard';
import { AuthorizationService } from '@eam-platform/authorization';
import { ModelRegistryService } from './model-registry.service';

/**
 * Legacy-compatible model endpoints
 *
 * These mirror the older /models/* routes expected by the web client:
 * - GET /models/:tableName
 * - GET /models/:tableName/fields
 * - GET /models/:tableName/layout
 */
@Controller('models')
@UseGuards(JwtAuthGuard)
export class ModelController {
  constructor(
    private readonly modelRegistry: ModelRegistryService,
    private readonly authz: AuthorizationService,
  ) {}

  @Get(':tableName')
  async getModel(@Param('tableName') tableName: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    const table = await this.modelRegistry.getTable(tableName, ctx.tenantId);
    if (!table) {
      throw new NotFoundException();
    }

    await this.authz.ensureTableAccess(ctx, table.storageTable, 'read');

    return {
      id: table.tableName,
      code: table.tableName,
      label: table.label,
      category: table.category,
      flags: {},
    };
  }

  @Get(':tableName/fields')
  async getModelFields(@Param('tableName') tableName: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Will throw if table not found or not authorized
    const table = await this.modelRegistry.getTable(tableName, ctx.tenantId);
    await this.authz.ensureTableAccess(ctx, table.storageTable, 'read');
    const fields = await this.modelRegistry.getFields(tableName, ctx.tenantId, ctx.roles);
    return fields;
  }

  @Get(':tableName/layout')
  async getModelLayout(@Param('tableName') tableName: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Validate access; layout is currently dynamic/null
    const table = await this.modelRegistry.getTable(tableName, ctx.tenantId);
    await this.authz.ensureTableAccess(ctx, table.storageTable, 'read');
    const layout = await this.modelRegistry.getLayout(tableName, ctx.tenantId);
    return layout ?? {};
  }
}
