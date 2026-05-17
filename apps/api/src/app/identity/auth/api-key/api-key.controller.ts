import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsDateString, MinLength, MaxLength, ArrayMaxSize } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import {
  InstanceRequest,
  RequirePermission,
  assertUserContext,
} from '@hubblewave/auth-guard';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SkipAbac } from '../../abac/abac.guard';

// DTOs with validation
class CreateApiKeyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @IsOptional()
  scopes?: string[];

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

class UpdateApiKeyScopesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  scopes!: string[];
}

/**
 * Canon §28 / §29.7 / W2 Stream 3 — platform-admin API key
 * administration (NOT user-owned keys; the user-owned key surface
 * lives in `apps/api/src/app/data/integration/api-key.controller.ts`).
 * Each handler mutates the platform's authentication boundary and is
 * gated by `system:configure`. `@Req()` is narrowed to
 * `InstanceRequest` and the `UserRequestContext` is asserted at the
 * top of every handler so service tokens cannot reach this surface.
 */
@ApiTags('API Keys')
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
@SkipAbac()
@ApiBearerAuth()
@RequirePermission('system:configure')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 keys per minute
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created successfully. The key value is only shown once.' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires `system:configure`' })
  async create(@Req() req: InstanceRequest, @Body() body: CreateApiKeyDto) {
    const ctx = assertUserContext(req.context);
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    const { key, apiKey } = await this.apiKeyService.createKey(
      ctx.userId,
      body.name,
      body.scopes || [],
      expiresAt,
    );

    return {
      id: apiKey.id,
      name: apiKey.name,
      key, // Only returned on creation — store securely.
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      message: 'Store this key securely. It will not be shown again.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all API keys for the instance' })
  @ApiResponse({ status: 200, description: 'List of API keys (without key hashes)' })
  async list(@Req() req: InstanceRequest) {
    const ctx = assertUserContext(req.context);
    const keys = await this.apiKeyService.listKeys(ctx.userId);
    return { items: keys, total: keys.length };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get API key details' })
  @ApiResponse({ status: 200, description: 'API key details' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async get(@Req() req: InstanceRequest, @Param('id') id: string) {
    const ctx = assertUserContext(req.context);
    const key = await this.apiKeyService.getKey(id, ctx.userId);
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    return key;
  }

  @Patch(':id/scopes')
  @ApiOperation({ summary: 'Update API key scopes' })
  @ApiResponse({ status: 200, description: 'Scopes updated successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async updateScopes(
    @Req() req: InstanceRequest,
    @Param('id') id: string,
    @Body() body: UpdateApiKeyScopesDto,
  ) {
    const ctx = assertUserContext(req.context);
    const updated = await this.apiKeyService.updateScopes(id, ctx.userId, body.scopes);
    if (!updated) {
      throw new NotFoundException('API key not found');
    }
    return { success: true, message: 'Scopes updated successfully' };
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke (disable) an API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revoke(@Req() req: InstanceRequest, @Param('id') id: string) {
    const ctx = assertUserContext(req.context);
    const revoked = await this.apiKeyService.revokeKey(id, ctx.userId);
    if (!revoked) {
      throw new NotFoundException('API key not found');
    }
    return { success: true, message: 'API key revoked successfully' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete an API key' })
  @ApiResponse({ status: 200, description: 'API key deleted' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async delete(@Req() req: InstanceRequest, @Param('id') id: string) {
    const ctx = assertUserContext(req.context);
    const deleted = await this.apiKeyService.deleteKey(id, ctx.userId);
    if (!deleted) {
      throw new NotFoundException('API key not found');
    }
    return { success: true, message: 'API key deleted permanently' };
  }
}
