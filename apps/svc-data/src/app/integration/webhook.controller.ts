/**
 * Webhook Controller
 * HubbleWave Platform - Phase 5
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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { WebhookService } from './webhook.service';
import { WebhookEvent, WebhookDeliveryStatus } from '@hubblewave/instance-db';

interface CreateWebhookDto {
  name: string;
  endpointUrl: string;
  events: WebhookEvent[];
  collectionId?: string;
  filterConditions?: Record<string, unknown>;
  headers?: Record<string, string>;
  secret?: string;
  retryCount?: number;
  timeoutSeconds?: number;
  verifySsl?: boolean;
}

interface UpdateWebhookDto {
  name?: string;
  endpointUrl?: string;
  events?: WebhookEvent[];
  filterConditions?: Record<string, unknown>;
  headers?: Record<string, string>;
  isActive?: boolean;
  retryCount?: number;
  timeoutSeconds?: number;
}

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new webhook subscription' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  async create(@Body() dto: CreateWebhookDto, @CurrentUser() user: RequestUser) {
    return this.webhookService.create({
      ...dto,
      createdBy: user.id,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all webhook subscriptions' })
  @ApiResponse({ status: 200, description: 'List of webhooks' })
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('collectionId') collectionId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.webhookService.findAll({
      isActive: isActive ? isActive === 'true' : undefined,
      collectionId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook by ID' })
  @ApiResponse({ status: 200, description: 'Webhook details' })
  async findById(@Param('id') id: string) {
    return this.webhookService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update webhook' })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  async update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhookService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  async delete(@Param('id') id: string) {
    await this.webhookService.delete(id);
    return { success: true };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate webhook' })
  @ApiResponse({ status: 200, description: 'Webhook activated' })
  async activate(@Param('id') id: string) {
    return this.webhookService.activate(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deactivated' })
  async deactivate(@Param('id') id: string) {
    return this.webhookService.deactivate(id);
  }

  @Post(':id/regenerate-secret')
  @ApiOperation({ summary: 'Regenerate webhook signing secret' })
  @ApiResponse({ status: 200, description: 'Secret regenerated' })
  async regenerateSecret(@Param('id') id: string) {
    return this.webhookService.regenerateSecret(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send test webhook payload' })
  @ApiResponse({ status: 200, description: 'Test webhook sent' })
  async test(@Param('id') id: string) {
    return this.webhookService.testWebhook(id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get webhook delivery history' })
  @ApiResponse({ status: 200, description: 'Delivery history' })
  async getDeliveries(
    @Param('id') id: string,
    @Query('status') status?: WebhookDeliveryStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.webhookService.getDeliveryHistory(id, {
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Post('deliveries/:deliveryId/retry')
  @ApiOperation({ summary: 'Retry failed webhook delivery' })
  @ApiResponse({ status: 200, description: 'Delivery retried' })
  async retryDelivery(@Param('deliveryId') deliveryId: string) {
    return this.webhookService.retryDelivery(deliveryId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get webhook statistics' })
  @ApiResponse({ status: 200, description: 'Webhook statistics' })
  async getStats(@Query('subscriptionId') subscriptionId?: string) {
    return this.webhookService.getStats(subscriptionId);
  }
}
