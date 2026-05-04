import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequestUser,
  RequirePermission,
} from '@hubblewave/auth-guard';
import { DependentReviewQueueService } from './dependent-review-queue.service';

/**
 * ADR-17 dependent-review queue endpoints. All methods require the
 * `metadata.policies.edit` slug — the queue is the artifact that
 * surfaces "this publish needs follow-up review", which is editorial
 * authority over policies and rules. Acknowledge / dismiss share the
 * same slug since both are policy decisions about whether the
 * dependent is OK or needs work.
 *
 * The admin role bypass is implemented inside PermissionsGuard (it
 * short-circuits when `userRoles.includes('admin')`), so we don't
 * also pair this with @Roles('admin') + RolesGuard. Stacking both
 * would AND them — a non-admin user with only the dedicated slug
 * would get denied by RolesGuard before PermissionsGuard ever
 * checked their permissions.
 */
@Controller('dependent-review-queue')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DependentReviewQueueController {
  constructor(private readonly service: DependentReviewQueueService) {}

  @Get()
  @RequirePermission('metadata.policies.edit')
  list(
    @Query('collectionId') collectionId?: string,
    @Query('status') status?: 'needs_review' | 'acknowledged' | 'dismissed' | 'open',
    @Query('limit') limit?: string,
  ) {
    return this.service.list({
      collectionId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** Open count — for the Studio dashboard badge. */
  @Get('count')
  @RequirePermission('metadata.policies.edit')
  count(@Query('collectionId') collectionId?: string) {
    return this.service.countOpen(collectionId).then((open) => ({ open }));
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('metadata.policies.edit')
  async acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { note?: string },
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    return this.service.acknowledge(id, user.id, body?.note);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('metadata.policies.edit')
  async dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { note?: string },
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    return this.service.dismiss(id, user.id, body?.note);
  }
}
