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
  ForbiddenException,
  NotFoundException,
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

  /**
   * Confirm the caller created this webhook (or is an admin). Returns the
   * entity for downstream use; throws NotFound when the id is unknown to avoid
   * leaking existence, Forbidden when the row is owned by someone else.
   */
  private async assertWebhookOwnership(id: string, user: RequestUser) {
    const subscription = await this.webhookService.findById(id);
    if (!subscription) {
      throw new NotFoundException('Webhook not found');
    }
    const isAdmin = user.isAdmin;
    if (!isAdmin && subscription.createdBy !== user.id) {
      throw new ForbiddenException('Not the owner of this webhook');
    }
    return subscription;
  }

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
  async findById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.assertWebhookOwnership(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update webhook' })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.assertWebhookOwnership(id, user);
    return this.webhookService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  async delete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertWebhookOwnership(id, user);
    await this.webhookService.delete(id);
    return { success: true };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate webhook' })
  @ApiResponse({ status: 200, description: 'Webhook activated' })
  async activate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertWebhookOwnership(id, user);
    return this.webhookService.activate(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deactivated' })
  async deactivate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertWebhookOwnership(id, user);
    return this.webhookService.deactivate(id);
  }

  @Post(':id/regenerate-secret')
  @ApiOperation({ summary: 'Regenerate webhook signing secret' })
  @ApiResponse({ status: 200, description: 'Secret regenerated' })
  async regenerateSecret(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertWebhookOwnership(id, user);
    return this.webhookService.regenerateSecret(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send test webhook payload' })
  @ApiResponse({ status: 200, description: 'Test webhook sent' })
  async test(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertWebhookOwnership(id, user);
    return this.webhookService.testWebhook(id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get webhook delivery history' })
  @ApiResponse({ status: 200, description: 'Delivery history' })
  async getDeliveries(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Query('status') status?: WebhookDeliveryStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    await this.assertWebhookOwnership(id, user);
    return this.webhookService.getDeliveryHistory(id, {
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Post('deliveries/:deliveryId/retry')
  @ApiOperation({ summary: 'Retry failed webhook delivery' })
  @ApiResponse({ status: 200, description: 'Delivery retried' })
  async retryDelivery(
    @Param('deliveryId') deliveryId: string,
    @CurrentUser() user: RequestUser,
  ) {
    // Resolve the delivery -> owning subscription, then enforce ownership.
    const delivery = await this.webhookService.findDeliveryById(deliveryId);
    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }
    await this.assertWebhookOwnership(delivery.subscriptionId, user);
    return this.webhookService.retryDelivery(deliveryId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get webhook statistics' })
  @ApiResponse({ status: 200, description: 'Webhook statistics' })
  async getStats(
    @CurrentUser() user: RequestUser,
    @Query('subscriptionId') subscriptionId?: string,
  ) {
    // Per-subscription stats: enforce ownership. Aggregate stats (no
    // subscriptionId) require admin — exposing platform-wide stats to any
    // authenticated user would leak operational data.
    if (subscriptionId) {
      await this.assertWebhookOwnership(subscriptionId, user);
      return this.webhookService.getStats(subscriptionId);
    }
    if (!user.isAdmin) {
      throw new ForbiddenException('Aggregate webhook stats require admin');
    }
    return this.webhookService.getStats();
  }
}
