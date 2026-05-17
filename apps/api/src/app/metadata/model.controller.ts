import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, PermissionsGuard, RequirePermission } from '@hubblewave/auth-guard';
import { ModelRegistryService } from './model-registry.service';

/**
 * Canon §28 / W2 Stream 3 — collection model + properties + layout
 * read surface. Gated by `metadata:collection:read`.
 */
@Controller('models')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('metadata:collection:read')
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
