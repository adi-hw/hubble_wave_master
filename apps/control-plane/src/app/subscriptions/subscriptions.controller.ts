import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Canon §28 / W2 Stream 3 — customer subscription records. Read by
 * `control_plane:subscription:read`; create / update by
 * `control_plane:subscription:manage`.
 */
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @RequirePermission('control_plane:subscription:read')
  async list() {
    return this.subscriptionsService.findAll();
  }

  @Post()
  @RequirePermission('control_plane:subscription:manage')
  async create(@Body() dto: CreateSubscriptionDto, @CurrentUser('id') userId: string) {
    return this.subscriptionsService.createSubscription(dto, userId);
  }

  @Put(':customerId')
  @RequirePermission('control_plane:subscription:manage')
  async update(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.subscriptionsService.updateSubscription(customerId, dto, userId);
  }
}
