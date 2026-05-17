import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedOnly,
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequestUser,
  RequirePermission,
  extractContext,
  InstanceRequest,
} from '@hubblewave/auth-guard';
import { FilterCondition, FacetConfig } from '@hubblewave/search-typesense';
import { SearchQueryService } from './search-query.service';
import { SearchExperienceService } from './search-experience.service';
import { SearchReindexService, SearchReindexRequest } from './search-reindex.service';

/**
 * Canon §28 / §11 / W2 Stream 3 — universal search surface. The user
 * search experiences + query endpoints are `@AuthenticatedOnly` (per-
 * record ACLs apply inside the search-authz emitter, canon §28); the
 * reindex trigger consumes platform compute and is gated by
 * `ava:admin`. The pre-W2 `RolesGuard` + bare `@Roles('admin')` are
 * retired.
 */
@Controller('search')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SearchController {
  constructor(
    private readonly searchQuery: SearchQueryService,
    private readonly experienceService: SearchExperienceService,
    private readonly reindexService: SearchReindexService,
  ) {}

  @Get('experiences')
  @AuthenticatedOnly()
  async listExperiences(@Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.experienceService.listForContext(context);
  }

  @Get('query')
  @AuthenticatedOnly()
  async query(
    @Query('q') q: string,
    @Query('experience_code') experienceCode?: string,
    @Query('sources') sources?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('filters') filters?: string,
    @Query('facets') facets?: string,
    @Query('sort_by') sortBy?: string,
    @Query('query_by') queryBy?: string,
    @Query('mode') mode?: string,
    @Query('semantic_limit') semanticLimit?: string,
    @Query('semantic_threshold') semanticThreshold?: string,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    const parsedSemanticLimit = semanticLimit ? parseInt(semanticLimit, 10) : undefined;
    const parsedSemanticThreshold = semanticThreshold ? Number(semanticThreshold) : undefined;

    return this.searchQuery.query({
      q,
      context,
      experienceCode,
      sourceCodes: sources ? sources.split(',').map((value) => value.trim()).filter(Boolean) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      filters: this.parseJsonArray<FilterCondition>(filters),
      facets: this.parseJsonArray<FacetConfig>(facets),
      sortBy: sortBy || undefined,
      queryBy: queryBy ? queryBy.split(',').map((value) => value.trim()).filter(Boolean) : undefined,
      mode: mode === 'semantic' || mode === 'hybrid' ? mode : mode === 'lexical' ? mode : undefined,
      semanticLimit: Number.isFinite(parsedSemanticLimit ?? NaN) ? parsedSemanticLimit : undefined,
      semanticThreshold: Number.isFinite(parsedSemanticThreshold ?? NaN) ? parsedSemanticThreshold : undefined,
    });
  }

  @Post('reindex')
  @RequirePermission('ava:admin')
  async reindex(@Body() body: SearchReindexRequest, @CurrentUser() user?: RequestUser) {
    return this.reindexService.reindex(body, user?.id);
  }

  private parseJsonArray<T>(value?: string): T[] | undefined {
    if (!value) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : undefined;
    } catch {
      return undefined;
    }
  }
}
