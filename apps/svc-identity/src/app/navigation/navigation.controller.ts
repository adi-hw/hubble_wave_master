import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { NavigationResolutionService } from './navigation-resolution.service';
import { NavigationPreferenceService } from './navigation-preference.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResolvedNavigation, NavProfileSummary, SwitchProfileRequest, ToggleFavoriteRequest, RecordNavigationRequest } from './dto/navigation.dto';

interface CurrentUserPayload {
  userId: string;
  email: string;
  username: string;
  roles: string[];
  permissions: string[];
}

@Controller('navigation')
export class NavigationController {
  constructor(
    private readonly resolutionService: NavigationResolutionService,
    private readonly preferenceService: NavigationPreferenceService,
  ) {}

  @Get()
  async getNavigation(
    @CurrentUser() user: CurrentUserPayload,
    @Query('contextTags') _tags?: string,
  ): Promise<ResolvedNavigation> {
    // Get base navigation
    const navigation = await this.resolutionService.resolveNavigation(user);

    // Get user favorites and merge into navigation
    if (user?.userId) {
      const favorites = await this.preferenceService.getFavorites(user.userId);
      navigation.favorites = favorites;
    }

    return navigation;
  }

  @Get('profiles')
  async getProfiles(): Promise<NavProfileSummary[]> {
    return this.resolutionService.getAvailableProfiles();
  }

  @Post('profiles/switch')
  async switchProfile(@Body() _body: SwitchProfileRequest) {
    // TODO: Implement session persistence for profile choice
    return { success: true };
  }

  @Post('favorites/toggle')
  async toggleFavorite(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: ToggleFavoriteRequest,
  ) {
    if (!user?.userId) {
      return { favorites: [], error: 'User not authenticated' };
    }

    const favorites = await this.preferenceService.toggleFavorite(
      user.userId,
      body.moduleKey,
    );

    return { favorites };
  }

  @Post('record')
  async recordNavigation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: RecordNavigationRequest,
  ) {
    if (!user?.userId) {
      return { success: false, error: 'User not authenticated' };
    }

    await this.preferenceService.recordNavigation(user.userId, body.moduleKey);
    return { success: true };
  }
}
