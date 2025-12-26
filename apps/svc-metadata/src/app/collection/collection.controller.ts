/**
 * Sprint 1.1: Collections — Enhanced Collection Controller
 *
 * This controller exposes the Collection API endpoints including:
 * - CRUD operations (list, get, create, update, delete)
 * - Lifecycle operations (publish, deprecate, restore)
 * - AVA integration (suggestions, analysis)
 * - Audit and statistics
 *
 * All endpoints enforce:
 * - JWT authentication via JwtAuthGuard
 * - User attribution via @CurrentUser decorator
 *
 * @module CollectionController
 */

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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
// Removed TenantId decorator
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import {
  CollectionService,
  CreateCollectionDto,
  UpdateCollectionDto,
  CollectionQueryOptions,
} from './collection.service';

import { CollectionAccessGuard } from '../access/guards/collection-access.guard';
import { PropertyAccessInterceptor } from '../access/interceptors/property-access.interceptor';

@Controller('collections')
@UseGuards(JwtAuthGuard, CollectionAccessGuard)
@UseInterceptors(PropertyAccessInterceptor)
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  // --------------------------------------------------------------------------
  // Query Endpoints
  // --------------------------------------------------------------------------

  /**
   * List all collections with optional filtering, sorting, and pagination
   */
  @Get()
  list(
    @Query('moduleId') moduleId?: string,
    @Query('category') category?: string,
    @Query('ownerType') ownerType?: 'system' | 'platform' | 'custom',
    @Query('status') status?: 'draft' | 'published' | 'deprecated',
    @Query('includeSystem') includeSystem?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('includeStats') includeStats?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'label' | 'code' | 'createdAt' | 'updatedAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const options: CollectionQueryOptions = {
      moduleId,
      category,
      ownerType,
      status,
      includeSystem: includeSystem === 'true',
      includeDeleted: includeDeleted === 'true',
      includeStats: includeStats === 'true',
      search,
      sortBy,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.collectionService.listCollections(options);
  }

  /**
   * Get available property types
   */
  @Get('property-types')
  getPropertyTypes() {
    return this.collectionService.getPropertyTypes();
  }

  /**
   * Get all collection categories
   */
  @Get('categories')
  getCategories() {
    return this.collectionService.getCategories();
  }

  /**
   * Check if a collection code is available
   */
  @Get('check-code/:code')
  async checkCode(@Param('code') code: string) {
    const isAvailable = await this.collectionService.isCodeAvailable(code);
    return { code, isAvailable };
  }

  /**
   * Get a single collection by ID
   */
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.collectionService.getCollection(id);
  }

  /**
   * Get collection by code
   */
  @Get('by-code/:code')
  getByCode(@Param('code') code: string) {
    return this.collectionService.getCollectionByCode(code);
  }

  /**
   * Get collection with all its properties
   */
  @Get(':id/full')
  getWithProperties(@Param('id', ParseUUIDPipe) id: string) {
    return this.collectionService.getCollectionWithProperties(id);
  }

  /**
   * Get properties for a collection
   */
  @Get(':id/properties')
  getProperties(@Param('id', ParseUUIDPipe) id: string) {
    return this.collectionService.getCollectionProperties(id);
  }

  /**
   * Get relationships for a collection
   */
  @Get(':id/relationships')
  getRelationships(@Param('id', ParseUUIDPipe) id: string) {
    return this.collectionService.getCollectionRelationships(id);
  }

  /**
   * Get collection statistics
   */
  // Stats endpoint disabled (no backing fields in single-instance model)

  /**
   * Get audit history for a collection
   */
  @Get(':id/audit')
  getAuditLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.collectionService.getAuditLog(id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // --------------------------------------------------------------------------
  // Mutation Endpoints
  // --------------------------------------------------------------------------

  /**
   * Create a new collection with automatic storage provisioning
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateCollectionDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request
  ) {
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.collectionService.createCollection(dto, user?.id, context);
  }

  /**
   * Update a collection
   */
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request
  ) {
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.collectionService.updateCollection(id, dto, user?.id, context);
  }

  /**
   * Delete a collection (soft delete)
   */
  @Delete(':id')
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request
  ) {
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.collectionService.deleteCollection(id, user?.id, context);
  }

  // --------------------------------------------------------------------------
  // Lifecycle Endpoints
  // --------------------------------------------------------------------------

  /**
   * Publish a draft collection
   */
  @Post(':id/publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request
  ) {
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.collectionService.publishCollection(id, user?.id, context);
  }

  /**
   * Deprecate a published collection
   */
  @Post(':id/deprecate')
  deprecate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { message: string; replacementCollectionId?: string },
    @CurrentUser() user: RequestUser,
    @Req() request: Request
  ) {
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.collectionService.deprecateCollection(
      id,
      body.message,
      body.replacementCollectionId,
      user?.id,
      context
    );
  }

  /**
   * Restore a soft-deleted collection
   */
  @Post(':id/restore')
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request
  ) {
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.collectionService.restoreCollection(id, user?.id, context);
  }

  /**
   * Clone a collection
   */
  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  clone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { code: string; label: string },
    @CurrentUser() user: RequestUser
  ) {
    return this.collectionService.cloneCollection(id, body.code, body.label, user?.id);
  }

  // --------------------------------------------------------------------------
  // AVA Integration Endpoints
  // --------------------------------------------------------------------------

  /**
   * Get AVA suggestions for collection naming (simplified endpoint)
   */
  @Post('suggest')
  suggest(@Body() body: { input: string }) {
    return this.collectionService.getSuggestions(body.input);
  }

  /**
   * Analyze imported data for schema suggestions (simplified endpoint)
   */
  @Post('analyze-import')
  analyzeImportSimple(
    @Body()
    body: {
      headers: string[];
      rows: Record<string, unknown>[];
      filename?: string;
    }
  ) {
    // Detect source type from filename if provided
    const source = body.filename?.toLowerCase().endsWith('.xlsx')
      ? 'xlsx'
      : body.filename?.toLowerCase().endsWith('.json')
        ? 'json'
        : 'csv';

    return this.collectionService.analyzeImport(source, body.headers, body.rows);
  }

  /**
   * Get AVA suggestions for collection naming (legacy endpoint)
   */
  @Post('ava/suggest/naming')
  suggestNaming(@Body() body: { input: string }) {
    return this.collectionService.getSuggestions(body.input);
  }

  /**
   * Analyze imported data for schema suggestions (legacy endpoint)
   */
  @Post('ava/analyze-import')
  analyzeImport(
    @Body()
    body: {
      source: 'csv' | 'json' | 'xlsx';
      headers: string[];
      sampleRows: Record<string, unknown>[];
    }
  ) {
    return this.collectionService.analyzeImport(
      body.source,
      body.headers,
      body.sampleRows
    );
  }

  /**
   * Ask AVA a natural language question about collections
   */
  @Post('ava/query')
  askAva(@Body() body: { question: string }) {
    return this.collectionService.askAva(body.question);
  }
}
