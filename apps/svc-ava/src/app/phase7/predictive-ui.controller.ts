import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PredictiveUIService, UserContext } from '@hubblewave/ai';
import { BehaviorType } from '@hubblewave/instance-db';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';

interface TrackBehaviorDto {
  type: BehaviorType;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
}

interface GetSuggestionsDto {
  currentPage: string;
  recentActions?: string[];
  sessionDuration?: number;
}

@ApiTags('Phase 7 - Predictive UI')
@ApiBearerAuth()
@Controller('api/phase7/predictive-ui')
@UseGuards(JwtAuthGuard)
export class PredictiveUIController {
  constructor(
    private readonly predictiveUIService: PredictiveUIService,
  ) {}

  @Post('behavior')
  @ApiOperation({ summary: 'Track user behavior' })
  @ApiResponse({ status: 201, description: 'Behavior tracked' })
  async trackBehavior(
    @CurrentUser() user: RequestUser,
    @Body() dto: TrackBehaviorDto,
  ) {
    await this.predictiveUIService.trackBehavior(user.id, dto);
    return { success: true };
  }

  @Post('suggestions')
  @ApiOperation({ summary: 'Get UI suggestions based on context' })
  @ApiResponse({ status: 200, description: 'UI suggestions' })
  async getSuggestions(
    @CurrentUser() user: RequestUser,
    @Body() dto: GetSuggestionsDto,
  ) {
    const now = new Date();
    const context: UserContext = {
      currentPage: dto.currentPage,
      recentActions: dto.recentActions || [],
      timeOfDay: now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening',
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
      sessionDuration: dto.sessionDuration || 0,
    };

    const suggestions = await this.predictiveUIService.getSuggestions(
      user.id,
      context,
    );

    return { suggestions };
  }

  @Post('suggestions/:id/feedback')
  @ApiOperation({ summary: 'Record feedback on a suggestion' })
  @ApiResponse({ status: 200, description: 'Feedback recorded' })
  async recordFeedback(
    @Param('id') suggestionId: string,
    @Body() dto: { accepted: boolean },
  ) {
    await this.predictiveUIService.recordSuggestionFeedback(
      suggestionId,
      dto.accepted,
    );

    return { success: true };
  }

  @Get('layout/:page')
  @ApiOperation({ summary: 'Get personalized layout for a page' })
  @ApiResponse({ status: 200, description: 'Personalized layout' })
  async getPersonalizedLayout(
    @CurrentUser() user: RequestUser,
    @Param('page') page: string,
  ) {
    const layout = await this.predictiveUIService.getPersonalizedLayout(
      user.id,
      page,
    );

    return { layout };
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get user behavior insights' })
  @ApiResponse({ status: 200, description: 'User insights' })
  async getUserInsights(
    @CurrentUser() user: RequestUser,
  ) {
    const insights = await this.predictiveUIService.getUserInsights(user.id);
    return { insights };
  }

  @Get('shortcuts')
  @ApiOperation({ summary: 'Get personalized shortcuts' })
  @ApiResponse({ status: 200, description: 'Personalized shortcuts' })
  async getShortcuts(
    @CurrentUser() user: RequestUser,
  ) {
    const layout = await this.predictiveUIService.getPersonalizedLayout(
      user.id,
      'global',
    );

    return { shortcuts: layout.shortcuts };
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent items' })
  @ApiResponse({ status: 200, description: 'Recent items' })
  async getRecentItems(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    const layout = await this.predictiveUIService.getPersonalizedLayout(
      user.id,
      'global',
    );

    const recentItems = layout.recentItems.slice(
      0,
      limit ? parseInt(limit, 10) : 10,
    );

    return { recentItems };
  }
}
