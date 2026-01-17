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
import { Phase7UpgradeAssistantService } from '@hubblewave/ai';
import { CustomizationType } from '@hubblewave/instance-db';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';

interface RegisterCustomizationDto {
  customizationType: CustomizationType;
  artifactId: string;
  artifactCode: string;
  dependencies?: string[];
}

interface AnalyzeUpgradeDto {
  currentVersion: string;
  targetVersion: string;
}

@ApiTags('Phase 7 - Intelligent Upgrade Assistant')
@ApiBearerAuth()
@Controller('api/phase7/upgrade-assistant')
@UseGuards(JwtAuthGuard)
export class UpgradeAssistantController {
  private readonly PLATFORM_VERSION = '2.4.0';
  private readonly LATEST_VERSION = '2.5.0';

  constructor(
    private readonly upgradeService: Phase7UpgradeAssistantService,
  ) {}

  @Get('current-version')
  @ApiOperation({ summary: 'Get current platform version' })
  @ApiResponse({ status: 200, description: 'Current version info' })
  async getCurrentVersion(
    @CurrentUser() _user: RequestUser,
  ) {
    const analyses = await this.upgradeService.getAnalysisHistory();
    const pendingAnalysis = analyses.find(
      a => a.analysisStatus === 'complete' && a.toVersion === this.LATEST_VERSION
    );

    return {
      version: this.PLATFORM_VERSION,
      latestVersion: this.LATEST_VERSION,
      pendingAnalysis: pendingAnalysis ? {
        id: pendingAnalysis.id,
        analysisId: pendingAnalysis.id,
        targetVersion: pendingAnalysis.toVersion,
        riskScore: this.calculateRiskScore(pendingAnalysis),
        compatibilityScore: this.calculateCompatibilityScore(pendingAnalysis),
        impacts: this.transformImpacts(pendingAnalysis.impactDetails || []),
        impactedCustomizations: [],
        breakingChanges: [],
        estimatedEffort: { hours: 2, complexity: 'low' as const },
        recommendations: pendingAnalysis.avaRecommendations ? [pendingAnalysis.avaRecommendations] : [],
      } : undefined,
    };
  }

  private calculateRiskScore(analysis: { breakingCount?: number | null; warningCount?: number | null; safeCount?: number | null }): number {
    const total = (analysis.breakingCount || 0) + (analysis.warningCount || 0) + (analysis.safeCount || 0);
    if (total === 0) return 0;
    return Math.round(((analysis.breakingCount || 0) * 100 + (analysis.warningCount || 0) * 50) / total);
  }

  private calculateCompatibilityScore(analysis: { breakingCount?: number | null; warningCount?: number | null; safeCount?: number | null }): number {
    const total = (analysis.breakingCount || 0) + (analysis.warningCount || 0) + (analysis.safeCount || 0);
    if (total === 0) return 100;
    return Math.round(((analysis.safeCount || 0) * 100 + (analysis.warningCount || 0) * 50) / total);
  }

  private transformImpacts(impacts: Array<{ customizationId: string; severity: string; description: string; autoFixable: boolean; suggestedFix?: string }>) {
    return impacts.map((impact, index) => ({
      id: `impact-${index}`,
      title: `Impact on ${impact.customizationId}`,
      description: impact.description,
      category: 'schema' as const,
      severity: impact.severity === 'breaking' ? 'critical' : impact.severity === 'warning' ? 'medium' : 'none',
      affectedArtifact: impact.customizationId,
      suggestedFix: impact.suggestedFix,
    }));
  }

  @Post('customizations')
  @ApiOperation({ summary: 'Register a customization' })
  @ApiResponse({ status: 201, description: 'Customization registered' })
  async registerCustomization(
    @CurrentUser() _user: RequestUser,
    @Body() dto: RegisterCustomizationDto,
  ) {
    const customization = await this.upgradeService.registerCustomization(
      dto.customizationType,
      dto.artifactId,
      dto.artifactCode,
      dto.dependencies,
    );

    return { customization };
  }

  @Get('customizations')
  @ApiOperation({ summary: 'Get registered customizations' })
  @ApiResponse({ status: 200, description: 'List of customizations' })
  async getCustomizations(
    @CurrentUser() _user: RequestUser,
    @Query('type') type?: string,
  ) {
    const customizations = await this.upgradeService.getCustomizations(
      type as CustomizationType | undefined,
    );

    return { customizations };
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze upgrade impact' })
  @ApiResponse({ status: 200, description: 'Upgrade analysis' })
  async analyzeUpgrade(
    @CurrentUser() _user: RequestUser,
    @Body() dto: AnalyzeUpgradeDto,
  ) {
    const analysis = await this.upgradeService.analyzeUpgrade(
      dto.currentVersion,
      dto.targetVersion,
    );

    return { analysis };
  }

  @Get('analyses')
  @ApiOperation({ summary: 'Get upgrade analysis history' })
  @ApiResponse({ status: 200, description: 'Analysis history' })
  async getAnalysisHistory(
    @CurrentUser() _user: RequestUser,
  ) {
    const analyses = await this.upgradeService.getAnalysisHistory();
    return { analyses };
  }

  @Get('analyses/:id')
  @ApiOperation({ summary: 'Get analysis details' })
  @ApiResponse({ status: 200, description: 'Analysis details' })
  async getAnalysis(
    @CurrentUser() _user: RequestUser,
    @Param('id') analysisId: string,
  ) {
    const analysis = await this.upgradeService.getAnalysis(analysisId);
    return { analysis };
  }

  @Post('analyses/:id/fixes')
  @ApiOperation({ summary: 'Generate fixes for analysis' })
  @ApiResponse({ status: 201, description: 'Fixes generated' })
  async generateFixes(
    @CurrentUser() _user: RequestUser,
    @Param('id') analysisId: string,
  ) {
    const fixes = await this.upgradeService.generateFixes(analysisId);
    return { fixes };
  }

  @Get('analyses/:id/fixes')
  @ApiOperation({ summary: 'Get fixes for analysis' })
  @ApiResponse({ status: 200, description: 'List of fixes' })
  async getFixes(
    @CurrentUser() _user: RequestUser,
    @Param('id') analysisId: string,
  ) {
    const fixes = await this.upgradeService.getFixes(analysisId);
    return { fixes };
  }

  @Post('fixes/:id/apply')
  @ApiOperation({ summary: 'Apply a fix' })
  @ApiResponse({ status: 200, description: 'Fix applied' })
  async applyFix(
    @CurrentUser() user: RequestUser,
    @Param('id') fixId: string,
  ) {
    const result = await this.upgradeService.applyFix(fixId, user.id);
    return result;
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Get upgrade readiness status' })
  @ApiResponse({ status: 200, description: 'Readiness status' })
  async getReadiness(
    @CurrentUser() _user: RequestUser,
    @Query('targetVersion') targetVersion: string,
  ) {
    const readiness = await this.upgradeService.getUpgradeReadiness(
      targetVersion,
    );

    return { readiness };
  }

  @Post('simulate')
  @ApiOperation({ summary: 'Simulate upgrade' })
  @ApiResponse({ status: 200, description: 'Simulation results' })
  async simulateUpgrade(
    @CurrentUser() _user: RequestUser,
    @Body() dto: { targetVersion: string },
  ) {
    const result = await this.upgradeService.simulateUpgrade(
      dto.targetVersion,
    );

    return { result };
  }
}
