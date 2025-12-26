import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { ModelRegistryService } from './model-registry.service';

/**
 * Provides table and field metadata for runtime data access.
 * Uses database-first approach via information_schema.
 */
@Controller('metadata/tables')
@UseGuards(JwtAuthGuard)
export class MetadataController {
  constructor(private readonly modelRegistry: ModelRegistryService) {}

  @Get(':tableName')
  async getTable(@Param('tableName') tableName: string) {
    const table = await this.modelRegistry.getTable(tableName);
    const fields = await this.modelRegistry.getFields(tableName);

    return {
      table: {
        code: table.tableName,
        dbTableName: table.storageTable,
        label: table.label,
      },
      fields,
    };
  }
}
