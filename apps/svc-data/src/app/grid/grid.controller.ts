/**
 * GridController - REST API endpoints for HubbleDataGrid SSRM
 *
 * Endpoints:
 * - POST /api/grid/query - Query data with pagination, filtering, sorting
 * - POST /api/grid/count - Get filtered row count
 * - POST /api/grid/grouped - Query grouped data with aggregations
 */

import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard, RequestContext, TenantRequest } from '@hubblewave/auth-guard';
import {
  GridQueryService,
  GridQueryRequest,
  GridCountRequest,
  GridQueryResponse,
} from './grid-query.service';

// =============================================================================
// DTOs
// =============================================================================

class GridQueryDto implements GridQueryRequest {
  collection!: string;
  startRow!: number;
  endRow!: number;
  sorting?: { column: string; direction: 'asc' | 'desc' }[];
  filters?: {
    column: string;
    operator:
      | 'equals'
      | 'notEquals'
      | 'contains'
      | 'notContains'
      | 'startsWith'
      | 'endsWith'
      | 'greaterThan'
      | 'greaterThanOrEqual'
      | 'lessThan'
      | 'lessThanOrEqual'
      | 'between'
      | 'inList'
      | 'notInList'
      | 'isNull'
      | 'isNotNull'
      | 'isEmpty'
      | 'isNotEmpty';
    value: unknown;
    value2?: unknown;
  }[];
  grouping?: {
    columns: string[];
    aggregations?: {
      column: string;
      function: 'sum' | 'avg' | 'min' | 'max' | 'count';
      alias?: string;
    }[];
  };
  globalFilter?: string;
}

class GridCountDto implements GridCountRequest {
  collection!: string;
  filters?: GridQueryDto['filters'];
  grouping?: GridQueryDto['grouping'];
  globalFilter?: string;
}

// =============================================================================
// CONTROLLER
// =============================================================================

@Controller('api/grid')
@UseGuards(JwtAuthGuard)
export class GridController {
  constructor(private readonly gridQueryService: GridQueryService) {}

  /**
   * Query grid data with pagination, filtering, and sorting
   *
   * @example
   * POST /api/grid/query
   * {
   *   "collection": "work_orders",
   *   "startRow": 0,
   *   "endRow": 100,
   *   "sorting": [{ "column": "created_at", "direction": "desc" }],
   *   "filters": [
   *     { "column": "status", "operator": "equals", "value": "open" }
   *   ],
   *   "globalFilter": "pump"
   * }
   */
  @Post('query')
  @HttpCode(HttpStatus.OK)
  async query(
    @Req() req: TenantRequest,
    @Body() dto: GridQueryDto,
  ): Promise<GridQueryResponse> {
    const ctx: RequestContext = req.context;
    return this.gridQueryService.query(ctx, {
      collection: dto.collection,
      startRow: dto.startRow,
      endRow: dto.endRow,
      sorting: dto.sorting,
      filters: dto.filters,
      grouping: dto.grouping,
      globalFilter: dto.globalFilter,
    });
  }

  /**
   * Get row count for a collection with optional filters
   *
   * @example
   * POST /api/grid/count
   * {
   *   "collection": "work_orders",
   *   "filters": [
   *     { "column": "status", "operator": "equals", "value": "open" }
   *   ]
   * }
   */
  @Post('count')
  @HttpCode(HttpStatus.OK)
  async count(
    @Req() req: TenantRequest,
    @Body() dto: GridCountDto,
  ): Promise<{ count: number }> {
    const ctx: RequestContext = req.context;
    const count = await this.gridQueryService.count(ctx, {
      collection: dto.collection,
      filters: dto.filters,
      grouping: dto.grouping,
      globalFilter: dto.globalFilter,
    });

    return { count };
  }

  /**
   * Query grouped data with aggregations
   *
   * @example
   * POST /api/grid/grouped
   * {
   *   "collection": "work_orders",
   *   "startRow": 0,
   *   "endRow": 50,
   *   "grouping": {
   *     "columns": ["status", "priority"],
   *     "aggregations": [
   *       { "column": "estimated_hours", "function": "sum", "alias": "total_hours" }
   *     ]
   *   }
   * }
   */
  @Post('grouped')
  @HttpCode(HttpStatus.OK)
  async queryGrouped(
    @Req() req: TenantRequest,
    @Body() dto: GridQueryDto,
  ): Promise<GridQueryResponse> {
    const ctx: RequestContext = req.context;
    return this.gridQueryService.queryGrouped(ctx, {
      collection: dto.collection,
      startRow: dto.startRow,
      endRow: dto.endRow,
      sorting: dto.sorting,
      filters: dto.filters,
      grouping: dto.grouping,
      globalFilter: dto.globalFilter,
    });
  }
}
