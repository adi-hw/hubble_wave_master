import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  BadRequestException,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { CollectionDataService, QueryOptions } from './collection-data.service';

// Query DTOs
interface ListQueryDto {
  page?: string;
  pageSize?: string;
  sort?: string; // JSON string or comma-separated "property:direction"
  filters?: string; // JSON string
  search?: string;
  searchFields?: string; // comma-separated property codes
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

@Controller('data/collections')
@UseGuards(JwtAuthGuard)
export class CollectionDataController {
  private readonly logger = new Logger(CollectionDataController.name);

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
      options.searchProperties = query.searchFields.split(',').map((s) => s.trim());
    }

    // Parse sort. JSON is preferred; the comma-separated form is the fallback
    // for older clients. Anything that is neither is rejected so the caller
    // gets explicit feedback instead of silently dropping the sort.
    if (query.sort) {
      const trimmed = query.sort.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          options.sort = JSON.parse(trimmed);
        } catch (e) {
          throw new BadRequestException(
            `Invalid sort JSON: ${(e as Error).message}`,
          );
        }
      } else {
        options.sort = trimmed.split(',').map((s) => {
          const [property, dir] = s.trim().split(':');
          if (!property) {
            throw new BadRequestException(`Invalid sort entry: '${s}'`);
          }
          return { property, direction: (dir?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc' };
        });
      }
    }

    // Parse filters. Must be valid JSON; an unparseable value is an error so
    // callers cannot accidentally bypass filtering and pull the full table.
    if (query.filters) {
      try {
        options.filters = JSON.parse(query.filters);
      } catch (e) {
        throw new BadRequestException(
          `Invalid filter JSON: ${(e as Error).message}`,
        );
      }
    }

    return options;
  }

  private buildContext(user: RequestUser) {
    return {
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isAdmin: user.roles.includes('admin'),
    };
  }

  // ============ COLLECTION METADATA ============
  // NOTE: Schema route MUST come before data routes to avoid route matching issues

  /**
   * Get collection definition and properties
   */
  @Get(':collectionCode/schema')
  async getSchema(
    @Param('collectionCode') collectionCode: string,
    @CurrentUser() _user: RequestUser
  ) {
    const collection = await this.collectionData.getCollection(collectionCode);
    const properties = await this.collectionData.getProperties(collection.id);

    // Enrich properties with reference collection codes for navigation
    const enrichedProperties = await this.collectionData.enrichPropertiesWithReferences(properties);

    return {
      collection,
      properties: enrichedProperties,
    };
  }

  // ============ GROUPED QUERIES ============
  // NOTE: These routes MUST come before the generic :collectionCode/data routes
  // because NestJS matches routes in order and :collectionCode/data would match first

  /**
   * List records grouped by a property - returns group summaries with counts
   * Optimized for large datasets - only returns group headers, not all data
   */
  @Get(':collectionCode/data/grouped')
  async listGrouped(
    @Param('collectionCode') collectionCode: string,
    @Query('groupBy') groupBy: string,
    @Query() query: ListQueryDto,
    @CurrentUser() user: RequestUser
  ) {
    if (!groupBy) {
      return { error: 'groupBy parameter is required' };
    }

    const ctx = this.buildContext(user);
    const options = this.parseQueryOptions(query);
    // Remove pagination options - grouped query returns all groups
    delete (options as Record<string, unknown>).page;
    delete (options as Record<string, unknown>).pageSize;

    return this.collectionData.listGrouped(ctx, collectionCode, groupBy, options);
  }

  /**
   * Get paginated children within a group
   */
  @Get(':collectionCode/data/group-children')
  async getGroupChildren(
    @Param('collectionCode') collectionCode: string,
    @Query('groupBy') groupBy: string,
    @Query('groupValue') groupValue: string,
    @Query() query: ListQueryDto,
    @CurrentUser() user: RequestUser
  ) {
    this.logger.debug(`[group-children] Request: ${JSON.stringify({ collectionCode, groupBy, groupValue, query })}`);

    if (!groupBy) {
      return { error: 'groupBy parameter is required' };
    }

    const ctx = this.buildContext(user);
    const options = this.parseQueryOptions(query);

    // Parse groupValue - handle null/undefined specially
    let parsedGroupValue: unknown = groupValue;
    if (groupValue === 'null' || groupValue === undefined) {
      parsedGroupValue = null;
    } else {
      // Try to parse as JSON for complex values, otherwise use as string
      try {
        parsedGroupValue = JSON.parse(groupValue);
      } catch {
        // Keep as string
      }
    }

    this.logger.debug(`[group-children] Parsed groupValue: ${parsedGroupValue}, type: ${typeof parsedGroupValue}`);

    try {
      const result = await this.collectionData.getGroupChildren(ctx, collectionCode, groupBy, parsedGroupValue, options);
      this.logger.debug(`[group-children] Success, returning ${result.data.length} records`);
      return result;
    } catch (error) {
      this.logger.error('[group-children] Error:', error);
      throw error;
    }
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
    try {
      const options = this.parseQueryOptions(query);
      const ctx = this.buildContext(user);

      return await this.collectionData.list(ctx, collectionCode, options);
    } catch (error) {
      this.logger.error(`Error in list endpoint - Collection: ${collectionCode}, Query: ${JSON.stringify(query)}`, error);
      throw error;
    }
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
    const ctx = this.buildContext(user);

    return this.collectionData.getOne(ctx, collectionCode, id);
  }

  /**
   * Phase 5 §10.2 — list audit-log entries for a single record.
   * Backs the Workspace ActivityFeedPanel.
   */
  @Get(':collectionCode/data/:id/audit-log')
  async listAuditLog(
    @Param('collectionCode') collectionCode: string,
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const ctx = this.buildContext(user);
    return this.collectionData.listAuditLog(ctx, collectionCode, id, {
      limit: limit ? parseInt(limit, 10) : undefined,
    });
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
    const ctx = this.buildContext(user);

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
    const ctx = this.buildContext(user);

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
    const ctx = this.buildContext(user);

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
    const ctx = this.buildContext(user);

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
    const ctx = this.buildContext(user);

    return this.collectionData.bulkDelete(ctx, collectionCode, body.ids);
  }

  // ============ REFERENCE DATA ============

  /**
   * Get reference options for dropdowns
   */
  @Get(':collectionCode/references')
  async getReferenceOptions(
    @Param('collectionCode') collectionCode: string,
    @Query('displayProperty') displayProperty: string,
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('limit') limit?: string
  ) {
    const ctx = this.buildContext(user);

    return this.collectionData.getReferenceOptions(
      ctx,
      collectionCode,
      displayProperty || 'name',
      search,
      limit ? parseInt(limit, 10) : 50
    );
  }

}
