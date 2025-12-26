import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
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
  constructor(private readonly modelRegistry: ModelRegistryService) {}

  @Get(':tableName')
  async getModel(@Param('tableName') tableName: string) {
    const table = await this.modelRegistry.getTable(tableName);
    return {
      id: table.tableName,
      code: table.tableName,
      label: table.label,
      category: table.category,
      flags: {},
    };
  }

  @Get(':tableName/fields')
  async getModelFields(@Param('tableName') tableName: string) {
    await this.modelRegistry.getTable(tableName);
    return this.modelRegistry.getFields(tableName);
  }

  @Get(':tableName/layout')
  async getModelLayout(@Param('tableName') tableName: string) {
    await this.modelRegistry.getTable(tableName);
    const layout = await this.modelRegistry.getLayout(tableName);
    return layout ?? {};
  }
}
