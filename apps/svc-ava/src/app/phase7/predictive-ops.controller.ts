import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PredictiveOpsService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { InsightType, InsightSeverity, InsightStatus } from '@hubblewave/instance-db';

interface TriggerAnalysisDto {
  type: InsightType;
}

@ApiTags('Phase 7 - Predictive Operations')
@ApiBearerAuth()
@Controller('api/phase7/predictive-ops')
@UseGuards(JwtAuthGuard)
export class PredictiveOpsController {
  constructor(
    private readonly predictiveOpsService: PredictiveOpsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get predictive operations dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard summary' })
  async getDashboard() {
    const summary = await this.predictiveOpsService.getDashboardSummary();
    return summary;
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get predictive insights' })
  @ApiResponse({ status: 200, description: 'List of insights' })
  async getInsights(
    @Query('type') type?: InsightType,
    @Query('severity') severity?: InsightSeverity,
    @Query('status') status?: InsightStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.predictiveOpsService.listInsights({
      type,
      severity,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    // Transform to match frontend expectations
    return {
      insights: result.data,
      total: result.total,
    };
  }

  @Get('insights/:id')
  @ApiOperation({ summary: 'Get insight details' })
  @ApiResponse({ status: 200, description: 'Insight details' })
  async getInsight(
    @Param('id') insightId: string,
  ) {
    const insight = await this.predictiveOpsService.getInsight(insightId);
    return { insight };
  }

  @Put('insights/:id/resolve')
  @ApiOperation({ summary: 'Mark insight as resolved' })
  @ApiResponse({ status: 200, description: 'Insight resolved' })
  async resolveInsight(
    @CurrentUser() user: RequestUser,
    @Param('id') insightId: string,
    @Body() dto: { action: string },
  ) {
    const insight = await this.predictiveOpsService.resolveInsight(
      insightId,
      user.id,
      dto.action,
    );

    return { insight };
  }

  @Put('insights/:id/dismiss')
  @ApiOperation({ summary: 'Dismiss insight' })
  @ApiResponse({ status: 200, description: 'Insight dismissed' })
  async dismissInsight(
    @CurrentUser() user: RequestUser,
    @Param('id') insightId: string,
  ) {
    const insight = await this.predictiveOpsService.dismissInsight(
      insightId,
      user.id,
    );

    return { insight };
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Trigger a specific analysis' })
  @ApiResponse({ status: 200, description: 'Analysis triggered' })
  async triggerAnalysis(
    @Body() dto: TriggerAnalysisDto,
  ) {
    const insights = await this.predictiveOpsService.triggerAnalysis(dto.type);

    return { insights };
  }

}
