import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@eam-platform/auth-guard';
import { CollectionDataService, QueryOptions } from './collection-data.service';

// Query DTOs
interface ListQueryDto {
  page?: string;
  pageSize?: string;
  sort?: string; // JSON string or comma-separated "field:direction"
  filters?: string; // JSON string
  search?: string;
  searchFields?: string; // comma-separated
  viewId?: string;
  groupBy?: string;
}

interface BulkUpdateDto {
  ids: string[];
  data: Record<string, unknown>;
}

interface BulkDeleteDto {
  ids: string[];
}

@Controller('collections')
@UseGuards(JwtAuthGuard)
export class CollectionDataController {
  constructor(private readonly collectionData: CollectionDataService) {}

  private parseQueryOptions(query: ListQueryDto): QueryOptions {
    const options: QueryOptions = {};

    if (query.page) {
      options.page = parseInt(query.page, 10) || 1;
    }

    if (query.pageSize) {
      options.pageSize = parseInt(query.pageSize, 10) || 20;
    }

    if (query.viewId) {
      options.viewId = query.viewId;
    }

    if (query.groupBy) {
      options.groupBy = query.groupBy;
    }

    if (query.search) {
      options.search = query.search;
    }

    if (query.searchFields) {
      options.searchFields = query.searchFields.split(',').map((s) => s.trim());
    }

    // Parse sort
    if (query.sort) {
      try {
        // Try JSON parse first
        options.sort = JSON.parse(query.sort);
      } catch {
        // Fallback: comma-separated "field:direction"
        options.sort = query.sort.split(',').map((s) => {
          const [field, dir] = s.trim().split(':');
          return { field, direction: (dir?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc' };
        });
      }
    }

    // Parse filters
    if (query.filters) {
      try {
        options.filters = JSON.parse(query.filters);
      } catch {
        // Invalid JSON, ignore
      }
    }

    return options;
  }

  // ============ COLLECTION DATA ============

  /**
   * List records from a collection with filtering, sorting, and pagination
   */
  @Get(':collectionCode/data')
  async list(
    @Param('collectionCode') collectionCode: string,
    @Query() query: ListQueryDto,
    @CurrentUser() user: RequestUser
  ) {
    const options = this.parseQueryOptions(query);
    const ctx = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isPlatformAdmin: user.roles.includes('platform_admin'),
      isTenantAdmin: user.roles.includes('tenant_admin'),
    };

    return this.collectionData.list(ctx, collectionCode, options);
  }

  /**
   * Get a single record by ID
   */
  @Get(':collectionCode/data/:id')
  async getOne(
    @Param('collectionCode') collectionCode: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser
  ) {
    const ctx = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isPlatformAdmin: user.roles.includes('platform_admin'),
      isTenantAdmin: user.roles.includes('tenant_admin'),
    };

    return this.collectionData.getOne(ctx, collectionCode, id);
  }

  /**
   * Create a new record
   */
  @Post(':collectionCode/data')
  async create(
    @Param('collectionCode') collectionCode: string,
    @Body() data: Record<string, unknown>,
    @CurrentUser() user: RequestUser
  ) {
    const ctx = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isPlatformAdmin: user.roles.includes('platform_admin'),
      isTenantAdmin: user.roles.includes('tenant_admin'),
    };

    return this.collectionData.create(ctx, collectionCode, data);
  }

  /**
   * Update an existing record
   */
  @Put(':collectionCode/data/:id')
  async update(
    @Param('collectionCode') collectionCode: string,
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
    @CurrentUser() user: RequestUser
  ) {
    const ctx = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isPlatformAdmin: user.roles.includes('platform_admin'),
      isTenantAdmin: user.roles.includes('tenant_admin'),
    };

    return this.collectionData.update(ctx, collectionCode, id, data);
  }

  /**
   * Delete a record
   */
  @Delete(':collectionCode/data/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('collectionCode') collectionCode: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser
  ) {
    const ctx = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isPlatformAdmin: user.roles.includes('platform_admin'),
      isTenantAdmin: user.roles.includes('tenant_admin'),
    };

    await this.collectionData.delete(ctx, collectionCode, id);
  }

  // ============ BULK OPERATIONS ============

  /**
   * Bulk update multiple records
   */
  @Post(':collectionCode/data/bulk-update')
  async bulkUpdate(
    @Param('collectionCode') collectionCode: string,
    @Body() body: BulkUpdateDto,
    @CurrentUser() user: RequestUser
  ) {
    const ctx = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isPlatformAdmin: user.roles.includes('platform_admin'),
      isTenantAdmin: user.roles.includes('tenant_admin'),
    };

    return this.collectionData.bulkUpdate(ctx, collectionCode, body.ids, body.data);
  }

  /**
   * Bulk delete multiple records
   */
  @Post(':collectionCode/data/bulk-delete')
  async bulkDelete(
    @Param('collectionCode') collectionCode: string,
    @Body() body: BulkDeleteDto,
    @CurrentUser() user: RequestUser
  ) {
    const ctx = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isPlatformAdmin: user.roles.includes('platform_admin'),
      isTenantAdmin: user.roles.includes('tenant_admin'),
    };

    return this.collectionData.bulkDelete(ctx, collectionCode, body.ids);
  }

  // ============ REFERENCE DATA ============

  /**
   * Get reference options for dropdowns
   */
  @Get(':collectionCode/references')
  async getReferenceOptions(
    @Param('collectionCode') collectionCode: string,
    @Query('displayField') displayField: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: RequestUser
  ) {
    const ctx = {
      tenantId: user!.tenantId,
      userId: user!.id,
      roles: user!.roles,
      permissions: user!.permissions,
      isPlatformAdmin: user!.roles.includes('platform_admin'),
      isTenantAdmin: user!.roles.includes('tenant_admin'),
    };

    return this.collectionData.getReferenceOptions(
      ctx,
      collectionCode,
      displayField || 'name',
      search,
      limit ? parseInt(limit, 10) : 50
    );
  }

  // ============ COLLECTION METADATA ============

  /**
   * Get collection definition and properties
   */
  @Get(':collectionCode/schema')
  async getSchema(
    @Param('collectionCode') collectionCode: string,
    @CurrentUser() user: RequestUser
  ) {
    const ctx = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isPlatformAdmin: user.roles.includes('platform_admin'),
      isTenantAdmin: user.roles.includes('tenant_admin'),
    };

    const collection = await this.collectionData.getCollection(ctx.tenantId, collectionCode);
    const properties = await this.collectionData.getProperties(ctx.tenantId, collection.id);

    return {
      collection,
      properties,
    };
  }
}
