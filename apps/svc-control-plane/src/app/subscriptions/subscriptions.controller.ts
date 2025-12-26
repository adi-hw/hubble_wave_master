import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('subscriptions')
@Roles('operator')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  async list() {
    return this.subscriptionsService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateSubscriptionDto, @CurrentUser('id') userId: string) {
    return this.subscriptionsService.createSubscription(dto, userId);
  }

  @Put(':customerId')
  async update(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.subscriptionsService.updateSubscription(customerId, dto, userId);
  }
}
