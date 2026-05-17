/**
 * API Key Controller
 * HubbleWave Platform - Phase 5
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  ForbiddenException,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { ApiKeyService } from './api-key.service';
import { ApiScope } from '@hubblewave/instance-db';

interface CreateApiKeyDto {
  name: string;
  description?: string;
  scopes: ApiScope[];
  rateLimitPerMinute?: number;
  allowedIps?: string[];
  expiresAt?: string;
}

interface UpdateApiKeyDto {
  name?: string;
  description?: string;
  scopes?: ApiScope[];
  rateLimitPerMinute?: number;
  allowedIps?: string[];
  isActive?: boolean;
}

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Confirm the caller owns the API key (or is an admin). Returns the entity
   * for downstream use. Throws NotFound when the id is unknown so we don't
   * leak existence to other tenants/users; throws Forbidden when the key
   * exists but belongs to someone else.
   */
  private async assertOwnership(id: string, user: RequestUser) {
    const apiKey = await this.apiKeyService.findById(id);
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }
    const isAdmin = user.roleCodes?.includes('admin');
    if (!isAdmin && apiKey.createdBy !== user.id) {
      throw new ForbiddenException('Not the owner of this API key');
    }
    return apiKey;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created' })
  async create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: RequestUser) {
    return this.apiKeyService.create({
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      createdBy: user.id,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all API keys for current user' })
  @ApiResponse({ status: 200, description: 'List of API keys' })
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.apiKeyService.findAll({
      isActive: isActive ? isActive === 'true' : undefined,
      createdBy: user?.id,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get API key by ID' })
  @ApiResponse({ status: 200, description: 'API key details' })
  async findById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.assertOwnership(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update API key' })
  @ApiResponse({ status: 200, description: 'API key updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.assertOwnership(id, user);
    return this.apiKeyService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete API key' })
  @ApiResponse({ status: 200, description: 'API key deleted' })
  async delete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertOwnership(id, user);
    await this.apiKeyService.delete(id);
    return { success: true };
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  async revoke(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertOwnership(id, user);
    return this.apiKeyService.revoke(id, user.id);
  }

  @Post(':id/roll')
  @ApiOperation({ summary: 'Roll API key (generate new key value)' })
  @ApiResponse({ status: 200, description: 'API key rolled' })
  async roll(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertOwnership(id, user);
    return this.apiKeyService.rollKey(id);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate an API key' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validate(@Body() body: { apiKey: string; ipAddress?: string }) {
    if (body.ipAddress) {
      return this.apiKeyService.validateWithIp(body.apiKey, body.ipAddress);
    }
    return this.apiKeyService.validate(body.apiKey);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get API key request logs' })
  @ApiResponse({ status: 200, description: 'Request logs' })
  async getLogs(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.assertOwnership(id, user);
    return this.apiKeyService.getRequestLogs(id, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get API key usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics' })
  async getStats(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Query('days') days?: string,
  ) {
    await this.assertOwnership(id, user);
    return this.apiKeyService.getUsageStats(id, days ? parseInt(days) : 30);
  }
}
