import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { DisplayRuleDto, DisplayRuleService } from './display-rule.service';

/**
 * Plan §7.3 endpoints. All write operations require the
 * `metadata.policies.edit` slug per ADR-12. Read is gated by
 * `collection.read` so end-user form runtimes can fetch the active
 * rule set when rendering — Display Rules are visible to anyone who
 * can read the collection.
 *
 * The admin role bypasses both via PermissionsGuard's internal
 * short-circuit (line 99 of permissions.guard.ts). We do not pair
 * with @Roles('admin') because that would AND the slug — see the
 * DependentReviewQueueController doc for the full reasoning.
 */
@Controller('collections/:collectionId/display-rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DisplayRuleController {
  constructor(private readonly service: DisplayRuleService) {}

  /**
   * List rules. `includeDrafts=true` is intended for the editor
   * surface only and requires the policy-edit slug; runtime readers
   * (form renderer, public APIs) get only published rules so the
   * publish lifecycle holds.
   */
  @Get()
  @RequirePermission(['collection.read', 'metadata.policies.edit'], 'any')
  async list(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @CurrentUser() user: RequestUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('includeDrafts') includeDrafts?: string,
  ) {
    const wantsDrafts = includeDrafts === 'true';
    if (wantsDrafts) {
      const userPerms: string[] = Array.isArray(user?.permissionCodes) ? user.permissionCodes : [];
      const userRoles: string[] = Array.isArray(user?.roleCodes) ? user.roleCodes : [];
      const allowed =
        userRoles.includes('admin') ||
        userPerms.includes('metadata.policies.edit');
      if (!allowed) {
        throw new ForbiddenException(
          "Permission 'metadata.policies.edit' required to read draft Display Rules",
        );
      }
    }
    const rules = await this.service.list(
      collectionId,
      includeInactive === 'true',
      wantsDrafts,
    );
    return { data: rules };
  }

  @Get(':id')
  @RequirePermission('collection.read')
  async get(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const rule = await this.service.get(id);
    this.assertCollectionScope(rule.collectionId, collectionId);
    return rule;
  }

  @Post()
  @RequirePermission('metadata.policies.edit')
  async create(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: DisplayRuleDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    return this.service.create(collectionId, dto, user.id);
  }

  @Put(':id')
  @RequirePermission('metadata.policies.edit')
  async update(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<DisplayRuleDto>,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    const existing = await this.service.get(id);
    this.assertCollectionScope(existing.collectionId, collectionId);
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/publish')
  @RequirePermission('metadata.policies.edit')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    const existing = await this.service.get(id);
    this.assertCollectionScope(existing.collectionId, collectionId);
    return this.service.publish(id, user.id);
  }

  @Delete(':id')
  @RequirePermission('metadata.policies.edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const existing = await this.service.get(id);
    this.assertCollectionScope(existing.collectionId, collectionId);
    await this.service.delete(id);
  }

  /**
   * Per-route guard against IDOR: a rule's id is unique across
   * collections, and our route nests under `:collectionId`. Reject
   * the request if the rule's owning collection does not match the
   * URL — return 404 (not 403) to avoid leaking the existence of a
   * rule belonging to a different collection.
   */
  private assertCollectionScope(ruleCollectionId: string, urlCollectionId: string): void {
    if (ruleCollectionId !== urlCollectionId) {
      throw new NotFoundException('Display Rule not found in this Collection');
    }
  }
}
