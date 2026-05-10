import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { ModelRegistryService } from './model-registry.service';

/**
 * Model endpoints for collection metadata
 *
 * Provides collection/model information:
 * - GET /models/:collectionCode - Get collection metadata
 * - GET /models/:collectionCode/properties - Get collection properties
 * - GET /models/:collectionCode/layout - Get collection layout
 */
@Controller('models')
@UseGuards(JwtAuthGuard)
export class ModelController {
  constructor(private readonly modelRegistry: ModelRegistryService) {}

  @Get(':collectionCode')
  async getModel(@Param('collectionCode') collectionCode: string) {
    const collection = await this.modelRegistry.getCollection(collectionCode);
    return {
      id: collection.collectionCode,
      code: collection.collectionCode,
      label: collection.label,
      category: collection.category,
      flags: {},
    };
  }

  @Get(':collectionCode/properties')
  async getModelProperties(@Param('collectionCode') collectionCode: string) {
    await this.modelRegistry.getCollection(collectionCode);
    return this.modelRegistry.getProperties(collectionCode);
  }

  @Get(':collectionCode/layout')
  async getModelLayout(@Param('collectionCode') collectionCode: string) {
    await this.modelRegistry.getCollection(collectionCode);
    const layout = await this.modelRegistry.getLayout(collectionCode);
    return layout ?? {};
  }
}
