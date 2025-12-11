import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { NavigationResolutionService, NavigationUser } from './navigation-resolution.service';
import { NavigationCacheService } from './navigation-cache.service';
import {
  ResolvedNavigation,
  NavProfileSummary,
  NavSearchResult,
  SwitchProfileDto,
  ToggleFavoriteDto,
  RecordNavigationDto,
} from './dto/navigation.dto';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Extended request with user context
 */
interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email: string;
    tenantId?: string;
    membershipId?: string;
    roles?: string[];
    permissions?: string[];
  };
}

/**
 * NavigationController - REST API for navigation system
 *
 * Endpoints:
 * - GET /api/navigation - Get resolved navigation for current user
 * - GET /api/navigation/profiles - List available profiles
 * - POST /api/navigation/profiles/switch - Switch active profile
 * - GET /api/navigation/search - Search navigation items
 * - POST /api/navigation/favorites/toggle - Toggle favorite
 * - POST /api/navigation/record - Record navigation (for recent/frequent)
 */
@ApiTags('Navigation')
@ApiBearerAuth()
@SkipThrottle() // Navigation is already cached, no need for rate limiting
@Controller('navigation')
export class NavigationController {
  constructor(
    private readonly navigationService: NavigationResolutionService,
    private readonly cacheService: NavigationCacheService
  ) {}

  /**
   * Get resolved navigation for the current user
   */
  @Get()
  @ApiOperation({ summary: 'Get navigation for current user' })
  @ApiResponse({ status: 200, description: 'Resolved navigation tree', type: ResolvedNavigation })
  @ApiQuery({ name: 'contextTags', required: false, type: [String], description: 'Context tags (e.g., mobile, desktop)' })
  async getNavigation(
    @Req() req: AuthenticatedRequest,
    @Query('contextTags') contextTags?: string | string[]
  ): Promise<ResolvedNavigation> {
    const user = this.extractUser(req);
    const tags = this.normalizeArray(contextTags);

    // Check cache first
    const cacheKey = this.cacheService.getNavigationCacheKey(
      user.tenantId,
      '', // Will be determined by service
      user.roles,
      user.permissions,
      [], // Feature flags would come from config service
      tags
    );

    const cached = this.cacheService.getCachedNavigation(cacheKey);
    if (cached) {
      return cached;
    }

    // Resolve navigation
    const navigation = await this.navigationService.resolveNavigation(user, [], tags);

    // Cache result
    const actualCacheKey = this.cacheService.getNavigationCacheKey(
      user.tenantId,
      navigation.profileId,
      user.roles,
      user.permissions,
      [],
      tags
    );
    this.cacheService.setCachedNavigation(actualCacheKey, navigation);

    return navigation;
  }

  /**
   * Get available navigation profiles for the current user
   */
  @Get('profiles')
  @ApiOperation({ summary: 'List available navigation profiles' })
  @ApiResponse({ status: 200, description: 'List of available profiles', type: [NavProfileSummary] })
  async getProfiles(@Req() req: AuthenticatedRequest): Promise<NavProfileSummary[]> {
    const user = this.extractUser(req);
    return this.navigationService.getAvailableProfiles(user);
  }

  /**
   * Switch to a different navigation profile
   */
  @Post('profiles/switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch active navigation profile' })
  @ApiResponse({ status: 200, description: 'Profile switched successfully' })
  async switchProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SwitchProfileDto
  ): Promise<{ success: boolean }> {
    const user = this.extractUser(req);
    await this.navigationService.switchProfile(user, dto.profileId);

    // Invalidate user's navigation cache
    this.cacheService.invalidateTenantNavigation(user.tenantId);

    return { success: true };
  }

  /**
   * Search navigation items
   */
  @Get('search')
  @ApiOperation({ summary: 'Search navigation items' })
  @ApiResponse({ status: 200, description: 'Search results', type: [NavSearchResult] })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results' })
  async searchNavigation(
    @Req() req: AuthenticatedRequest,
    @Query('q') query: string,
    @Query('limit') limit?: number
  ): Promise<NavSearchResult[]> {
    const user = this.extractUser(req);
    return this.navigationService.searchNavigation(user, query, limit || 20);
  }

  /**
   * Toggle favorite status for a module
   */
  @Post('favorites/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle favorite status for a module' })
  @ApiResponse({ status: 200, description: 'Updated favorites list' })
  async toggleFavorite(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ToggleFavoriteDto
  ): Promise<{ favorites: string[] }> {
    const user = this.extractUser(req);
    const favorites = await this.navigationService.toggleFavorite(user, dto.moduleKey);

    // Invalidate navigation cache (favorites affect smart groups)
    this.cacheService.invalidateTenantNavigation(user.tenantId);

    return { favorites };
  }

  /**
   * Record navigation to a module (for recent/frequent tracking)
   */
  @Post('record')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record navigation to a module' })
  @ApiResponse({ status: 200, description: 'Navigation recorded' })
  async recordNavigation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RecordNavigationDto
  ): Promise<{ success: boolean }> {
    const user = this.extractUser(req);
    await this.navigationService.recordNavigation(user, dto.moduleKey);
    return { success: true };
  }

  /**
   * Get cache statistics (for monitoring)
   */
  @Get('cache/stats')
  @Roles('admin')
  @ApiOperation({ summary: 'Get navigation cache statistics' })
  @ApiResponse({ status: 200, description: 'Cache statistics' })
  async getCacheStats(): Promise<any> {
    return this.cacheService.getStats();
  }

  /**
   * Clear navigation cache for a tenant (admin only)
   */
  @Post('cache/clear')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear navigation cache' })
  @ApiResponse({ status: 200, description: 'Cache cleared' })
  async clearCache(@Req() req: AuthenticatedRequest): Promise<{ success: boolean }> {
    const user = this.extractUser(req);
    this.cacheService.invalidateTenantNavigation(user.tenantId);
    return { success: true };
  }

  // === Helper Methods ===

  private extractUser(req: AuthenticatedRequest): NavigationUser {
    if (!req.user?.tenantId) {
      throw new Error('User context not available - missing tenantId');
    }

    return {
      userId: req.user.sub,
      // membershipId may not be present in all JWT contexts, use sub as fallback
      membershipId: req.user.membershipId || req.user.sub,
      tenantId: req.user.tenantId,
      roles: req.user.roles || [],
      permissions: req.user.permissions || [],
    };
  }

  private normalizeArray(value?: string | string[]): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return value.split(',').map((s) => s.trim());
  }
}
