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
  PropertyService,
  CreatePropertyDto,
  UpdatePropertyDto,
  CreateDependencyDto,
} from './property.service';
import { ChoiceOption } from '@eam-platform/tenant-db';

@Controller('properties')
@UseGuards(JwtAuthGuard)
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  /**
   * List properties by collection
   */
  @Get('by-collection/:collectionId')
  listByCollection(
    @TenantId() tenantId: string,
    @Param('collectionId') collectionId: string,
    @Query('grouped') grouped?: string
  ) {
    return this.propertyService.listProperties(tenantId, collectionId, grouped === 'true');
  }

  /**
   * Get a single property by ID
   */
  @Get(':id')
  getById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.propertyService.getProperty(tenantId, id);
  }

  /**
   * Get property by collection and code
   */
  @Get('by-code/:collectionId/:code')
  getByCode(
    @TenantId() tenantId: string,
    @Param('collectionId') collectionId: string,
    @Param('code') code: string
  ) {
    return this.propertyService.getPropertyByCode(tenantId, collectionId, code);
  }

  /**
   * Get dependencies for a property
   */
  @Get(':id/dependencies')
  getDependencies(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.propertyService.getPropertyDependencies(tenantId, id);
  }

  /**
   * Create a new property
   */
  @Post()
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.propertyService.createProperty(tenantId, dto, user?.id);
  }

  /**
   * Update a property
   */
  @Put(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.propertyService.updateProperty(tenantId, id, dto, user?.id);
  }

  /**
   * Delete a property (soft delete)
   */
  @Delete(':id')
  delete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.propertyService.deleteProperty(tenantId, id, user?.id);
  }

  /**
   * Deprecate a property
   */
  @Post(':id/deprecate')
  deprecate(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { message: string },
    @CurrentUser() user: RequestUser
  ) {
    return this.propertyService.deprecateProperty(tenantId, id, body.message, user?.id);
  }

  /**
   * Reorder properties within a collection
   */
  @Put('by-collection/:collectionId/reorder')
  reorder(
    @TenantId() tenantId: string,
    @Param('collectionId') collectionId: string,
    @Body() body: { orders: { id: string; sortOrder: number }[] }
  ) {
    return this.propertyService.reorderProperties(tenantId, collectionId, body.orders);
  }

  /**
   * Update choice list for a property
   */
  @Put(':id/choices')
  updateChoices(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { choices: ChoiceOption[] },
    @CurrentUser() user: RequestUser
  ) {
    return this.propertyService.updateChoiceList(tenantId, id, body.choices, user?.id);
  }

  /**
   * Clone a property to another collection
   */
  @Post(':id/clone')
  clone(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { targetCollectionId: string; newCode?: string },
    @CurrentUser() user: RequestUser
  ) {
    return this.propertyService.cloneProperty(
      tenantId,
      id,
      body.targetCollectionId,
      body.newCode,
      user?.id
    );
  }

  /**
   * Create a property dependency
   */
  @Post('dependencies')
  createDependency(@TenantId() tenantId: string, @Body() dto: CreateDependencyDto) {
    return this.propertyService.createDependency(tenantId, dto);
  }

  /**
   * Delete a property dependency
   */
  @Delete('dependencies/:id')
  deleteDependency(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.propertyService.deleteDependency(tenantId, id);
  }
}
