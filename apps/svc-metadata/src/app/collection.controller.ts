import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, TenantId, CurrentUser, RequestUser } from '@eam-platform/auth-guard';
import {
  CollectionService,
  CreateCollectionDto,
  UpdateCollectionDto,
  CollectionQueryOptions,
} from './collection.service';

@Controller('collections')
@UseGuards(JwtAuthGuard)
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  /**
   * List all collections with optional filtering
   */
  @Get()
  list(
    @TenantId() tenantId: string,
    @Query('moduleId') moduleId?: string,
    @Query('category') category?: string,
    @Query('includeSystem') includeSystem?: string,
    @Query('search') search?: string
  ) {
    const options: CollectionQueryOptions = {
      moduleId,
      category,
      includeSystem: includeSystem === 'true',
      search,
    };
    return this.collectionService.listCollections(tenantId, options);
  }

  /**
   * Get available property types
   */
  @Get('property-types')
  getPropertyTypes(@TenantId() tenantId: string) {
    return this.collectionService.getPropertyTypes(tenantId);
  }

  /**
   * Get all collection categories
   */
  @Get('categories')
  getCategories(@TenantId() tenantId: string) {
    return this.collectionService.getCategories(tenantId);
  }

  /**
   * Get a single collection by ID
   */
  @Get(':id')
  getById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.collectionService.getCollection(tenantId, id);
  }

  /**
   * Get collection by code
   */
  @Get('by-code/:code')
  getByCode(@TenantId() tenantId: string, @Param('code') code: string) {
    return this.collectionService.getCollectionByCode(tenantId, code);
  }

  /**
   * Get collection with all its properties
   */
  @Get(':id/full')
  getWithProperties(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.collectionService.getCollectionWithProperties(tenantId, id);
  }

  /**
   * Get properties for a collection
   */
  @Get(':id/properties')
  getProperties(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.collectionService.getCollectionProperties(tenantId, id);
  }

  /**
   * Get relationships for a collection
   */
  @Get(':id/relationships')
  getRelationships(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.collectionService.getCollectionRelationships(tenantId, id);
  }

  /**
   * Create a new collection
   */
  @Post()
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateCollectionDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.collectionService.createCollection(tenantId, dto, user?.id);
  }

  /**
   * Update a collection
   */
  @Put(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.collectionService.updateCollection(tenantId, id, dto, user?.id);
  }

  /**
   * Delete a collection (soft delete)
   */
  @Delete(':id')
  delete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.collectionService.deleteCollection(tenantId, id, user?.id);
  }

  /**
   * Publish a collection
   */
  @Post(':id/publish')
  publish(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.collectionService.publishCollection(tenantId, id, user?.id);
  }

  /**
   * Clone a collection
   */
  @Post(':id/clone')
  clone(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { code: string; label: string },
    @CurrentUser() user: RequestUser
  ) {
    return this.collectionService.cloneCollection(tenantId, id, body.code, body.label, user?.id);
  }
}
