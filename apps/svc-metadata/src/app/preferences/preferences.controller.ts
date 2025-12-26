import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import {
  UpdateUserPreferencesDto,
  AddPinnedItemDto,
  UpdatePinnedItemDto,
  ReorderPinnedItemsDto,
  SyncPreferencesDto,
} from './preferences.dto';
import { CurrentUser, JwtAuthGuard } from '@hubblewave/auth-guard';

@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  // ============================================================================
  // Main Preferences
  // ============================================================================

  /**
   * GET /preferences/me
   * Get current user's preferences
   */
  @Get('me')
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.preferencesService.getPreferences(userId);
  }

  /**
   * PUT /preferences/me
   * Update current user's preferences (full update)
   */
  @Put('me')
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    return this.preferencesService.updatePreferences(userId, dto);
  }

  /**
   * PATCH /preferences/me
   * Partially update current user's preferences
   */
  @Patch('me')
  async patchPreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<UpdateUserPreferencesDto>,
  ) {
    return this.preferencesService.patchPreferences(userId, dto);
  }

  /**
   * POST /preferences/me/reset
   * Reset preferences to defaults
   */
  @Post('me/reset')
  async resetPreferences(@CurrentUser('id') userId: string) {
    return this.preferencesService.resetPreferences(userId);
  }

  // ============================================================================
  // Pinned Navigation
  // ============================================================================

  /**
   * GET /preferences/me/pinned
   * Get pinned navigation items
   */
  @Get('me/pinned')
  async getPinnedNavigation(@CurrentUser('id') userId: string) {
    const items = await this.preferencesService.getPinnedNavigation(userId);
    return { data: items };
  }

  /**
   * POST /preferences/me/pinned
   * Add a pinned navigation item
   */
  @Post('me/pinned')
  async addPinnedItem(
    @CurrentUser('id') userId: string,
    @Body() dto: AddPinnedItemDto,
  ) {
    const items = await this.preferencesService.addPinnedItem(userId, dto);
    return { data: items };
  }

  /**
   * PUT /preferences/me/pinned/:id
   * Update a pinned navigation item
   */
  @Put('me/pinned/:id')
  async updatePinnedItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePinnedItemDto,
  ) {
    const items = await this.preferencesService.updatePinnedItem(userId, itemId, dto);
    return { data: items };
  }

  /**
   * DELETE /preferences/me/pinned/:id
   * Remove a pinned navigation item
   */
  @Delete('me/pinned/:id')
  async removePinnedItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) itemId: string,
  ) {
    const items = await this.preferencesService.removePinnedItem(userId, itemId);
    return { data: items };
  }

  /**
   * POST /preferences/me/pinned/reorder
   * Reorder pinned navigation items
   */
  @Post('me/pinned/reorder')
  async reorderPinnedItems(
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderPinnedItemsDto,
  ) {
    const items = await this.preferencesService.reorderPinnedItems(userId, dto.order);
    return { data: items };
  }

  // ============================================================================
  // Quick Actions
  // ============================================================================

  /**
   * PUT /preferences/me/density/:mode
   * Quick set density mode
   */
  @Put('me/density/:mode')
  async setDensityMode(
    @CurrentUser('id') userId: string,
    @Param('mode') mode: 'compact' | 'comfortable' | 'spacious',
  ) {
    return this.preferencesService.setDensityMode(userId, mode);
  }

  /**
   * PUT /preferences/me/sidebar/position/:position
   * Quick set sidebar position
   */
  @Put('me/sidebar/position/:position')
  async setSidebarPosition(
    @CurrentUser('id') userId: string,
    @Param('position') position: 'left' | 'right',
  ) {
    return this.preferencesService.setSidebarPosition(userId, position);
  }

  /**
   * POST /preferences/me/sidebar/toggle
   * Toggle sidebar collapsed state
   */
  @Post('me/sidebar/toggle')
  async toggleSidebarCollapsed(@CurrentUser('id') userId: string) {
    return this.preferencesService.toggleSidebarCollapsed(userId);
  }

  // ============================================================================
  // Sync
  // ============================================================================

  /**
   * POST /preferences/me/sync
   * Sync preferences from another device
   */
  @Post('me/sync')
  async syncPreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: SyncPreferencesDto,
  ) {
    return this.preferencesService.syncPreferences(
      userId,
      dto.deviceId,
      dto.fromVersion,
    );
  }

  /**
   * GET /preferences/me/version
   * Get preference version for sync check
   */
  @Get('me/version')
  async getPreferenceVersion(@CurrentUser('id') userId: string) {
    return this.preferencesService.getPreferenceVersion(userId);
  }
}
