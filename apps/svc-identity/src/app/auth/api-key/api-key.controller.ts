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
import { ApiKeyService } from './api-key.service';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

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

@ApiTags('API Keys')
@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @Roles('admin')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 keys per minute
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created successfully. The key value is only shown once.' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  async create(@Req() req: any, @Body() body: CreateApiKeyDto) {
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    const { key, apiKey } = await this.apiKeyService.createKey(
      req.user.userId,
      body.name,
      body.scopes || [],
      expiresAt,
    );

    return {
      id: apiKey.id,
      name: apiKey.name,
      key, // Only returned on creation - store securely!
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      message: 'Store this key securely. It will not be shown again.',
    };
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all API keys for the tenant' })
  @ApiResponse({ status: 200, description: 'List of API keys (without key hashes)' })
  async list(@Req() req: any) {
    const keys = await this.apiKeyService.listKeys(req.user.userId);
    return { items: keys, total: keys.length };
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get API key details' })
  @ApiResponse({ status: 200, description: 'API key details' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async get(@Req() req: any, @Param('id') id: string) {
    const key = await this.apiKeyService.getKey(id, req.user.userId);
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    return key;
  }

  @Patch(':id/scopes')
  @Roles('admin')
  @ApiOperation({ summary: 'Update API key scopes' })
  @ApiResponse({ status: 200, description: 'Scopes updated successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async updateScopes(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateApiKeyScopesDto,
  ) {
    const updated = await this.apiKeyService.updateScopes(id, req.user.userId, body.scopes);
    if (!updated) {
      throw new NotFoundException('API key not found');
    }
    return { success: true, message: 'Scopes updated successfully' };
  }

  @Post(':id/revoke')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke (disable) an API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revoke(@Req() req: any, @Param('id') id: string) {
    const revoked = await this.apiKeyService.revokeKey(id, req.user.userId);
    if (!revoked) {
      throw new NotFoundException('API key not found');
    }
    return { success: true, message: 'API key revoked successfully' };
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete an API key' })
  @ApiResponse({ status: 200, description: 'API key deleted' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async delete(@Req() req: any, @Param('id') id: string) {
    const deleted = await this.apiKeyService.deleteKey(id, req.user.userId);
    if (!deleted) {
      throw new NotFoundException('API key not found');
    }
    return { success: true, message: 'API key deleted permanently' };
  }
}
