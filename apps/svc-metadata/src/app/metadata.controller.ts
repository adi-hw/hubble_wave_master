import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { ModelRegistryService } from './model-registry.service';

/**
 * Provides Collection and Property metadata for runtime data access.
 * Uses database-first approach via information_schema.
 */
@Controller('metadata/collections')
@UseGuards(JwtAuthGuard)
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
