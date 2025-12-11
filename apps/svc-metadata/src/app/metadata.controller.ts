import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RequestContext } from '@eam-platform/auth-guard';
import { AuthorizationService } from '@eam-platform/authorization';
import { ModelRegistryService } from './model-registry.service';

/**
 * Provides table and field metadata for runtime data access.
 * Uses database-first approach via information_schema.
 */
@Controller('metadata/tables')
@UseGuards(JwtAuthGuard)
export class MetadataController {
  constructor(
    private readonly modelRegistry: ModelRegistryService,
    private readonly authz: AuthorizationService,
  ) {}

  @Get(':tableName')
  async getTable(@Param('tableName') tableName: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    const table = await this.modelRegistry.getTable(tableName, ctx.tenantId);
    if (!table) {
      throw new NotFoundException();
    }

    await this.authz.ensureTableAccess(ctx, table.storageTable, 'read');

    const allFields = await this.modelRegistry.getFields(tableName, ctx.tenantId, ctx.roles);
    const authorizedFields = await this.authz.getAuthorizedFields(ctx, table.storageTable, allFields);

    return {
      table: {
        code: table.tableName,
        dbTableName: table.storageTable,
        label: table.label,
      },
      fields: authorizedFields,
    };
  }
}
