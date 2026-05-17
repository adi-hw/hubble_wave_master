import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, PermissionsGuard, RequirePermission } from '@hubblewave/auth-guard';
import { ModelRegistryService } from './model-registry.service';

/**
 * Canon §28 / W2 Stream 3 — runtime collection metadata read surface.
 * Gated by `metadata:collection:read`; the UI reads this every page
 * load to render typed forms and grids.
 */
@Controller('metadata/collections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('metadata:collection:read')
export class MetadataController {
  constructor(private readonly modelRegistry: ModelRegistryService) {}

  @Get(':collectionCode')
  async getCollectionMetadata(@Param('collectionCode') collectionCode: string) {
    const collection = await this.modelRegistry.getCollection(collectionCode);
    const properties = await this.modelRegistry.getProperties(collectionCode);

    return {
      collection: {
        code: collection.collectionCode,
        storageTable: collection.storageTable,
        label: collection.label,
      },
      properties,
    };
  }
}
