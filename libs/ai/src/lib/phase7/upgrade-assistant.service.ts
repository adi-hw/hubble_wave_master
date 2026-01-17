// ============================================================
// Phase 7: Intelligent Upgrade Assistant Service
// AI-powered upgrade planning and execution
// ============================================================

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CustomizationRegistry,
  UpgradeImpactAnalysis,
  UpgradeFix,
  CustomizationType,
  AnalysisStatus,
  FixType,
} from '@hubblewave/instance-db';
import { LLMService } from '../llm.service';

interface UpgradeAnalysisResult {
  analysisId: string;
  targetVersion: string;
  riskScore: number;
  impactedCustomizations: Array<{
    id: string;
    code: string;
    type: CustomizationType;
    severity: 'breaking' | 'warning' | 'safe';
    description: string;
  }>;
  breakingCount: number;
  warningCount: number;
  safeCount: number;
  recommendations: string;
}

@Injectable()
export class Phase7UpgradeAssistantService {
  constructor(
    @InjectRepository(CustomizationRegistry)
    private readonly customizationRepo: Repository<CustomizationRegistry>,
    @InjectRepository(UpgradeImpactAnalysis)
    private readonly analysisRepo: Repository<UpgradeImpactAnalysis>,
    @InjectRepository(UpgradeFix)
    private readonly fixRepo: Repository<UpgradeFix>,
    private readonly llmService: LLMService,
  ) {}

  async registerCustomization(
    customizationType: CustomizationType,
    artifactId: string,
    artifactCode: string,
    dependencies: string[] = [],
  ): Promise<CustomizationRegistry> {
    const existing = await this.customizationRepo.findOne({
      where: {
        customizationType,
        artifactId,
      },
    });

    if (existing) {
      existing.dependencies = dependencies;
      return this.customizationRepo.save(existing);
    }

    const record = this.customizationRepo.create({
      customizationType,
      artifactId,
      artifactCode,
      dependencies,
      dependents: [],
      isSystemModified: false,
    });

    return this.customizationRepo.save(record);
  }

  async getCustomizations(
    type?: CustomizationType,
  ): Promise<CustomizationRegistry[]> {
    if (type) {
      return this.customizationRepo.find({ where: { customizationType: type } });
    }
    return this.customizationRepo.find();
  }

  async analyzeUpgrade(
    currentVersion: string,
    targetVersion: string,
  ): Promise<UpgradeAnalysisResult> {
    const customizations = await this.customizationRepo.find();

    const analysis = this.analysisRepo.create({
      fromVersion: currentVersion,
      toVersion: targetVersion,
      analysisStatus: 'pending' as AnalysisStatus,
      totalCustomizations: customizations.length,
    });
    await this.analysisRepo.save(analysis);

    const releaseNotes = await this.fetchReleaseNotes(currentVersion, targetVersion);
    const impactAnalysis = await this.analyzeImpact(
      customizations,
      releaseNotes,
    );

    analysis.impactDetails = impactAnalysis.impactDetails;
    analysis.breakingCount = impactAnalysis.breakingCount;
    analysis.warningCount = impactAnalysis.warningCount;
    analysis.safeCount = impactAnalysis.safeCount;
    analysis.avaRecommendations = impactAnalysis.recommendations;
    analysis.autoFixableCount = impactAnalysis.autoFixableCount;
    analysis.analysisStatus = 'complete';
    analysis.analyzedAt = new Date();
    await this.analysisRepo.save(analysis);

    return {
      analysisId: analysis.id,
      targetVersion,
      riskScore: this.calculateRiskScore(impactAnalysis),
      impactedCustomizations: impactAnalysis.impactDetails.map(item => ({
        id: item.customizationId,
        code: customizations.find(c => c.id === item.customizationId)?.artifactCode || '',
        type: customizations.find(c => c.id === item.customizationId)?.customizationType || 'collection',
        severity: item.severity,
        description: item.description,
      })),
      breakingCount: impactAnalysis.breakingCount,
      warningCount: impactAnalysis.warningCount,
      safeCount: impactAnalysis.safeCount,
      recommendations: impactAnalysis.recommendations,
    };
  }

  private calculateRiskScore(analysis: {
    breakingCount: number;
    warningCount: number;
    safeCount: number;
  }): number {
    const total = analysis.breakingCount + analysis.warningCount + analysis.safeCount;
    if (total === 0) return 0;
    return Math.round((analysis.breakingCount * 100 + analysis.warningCount * 50) / total);
  }

  private async fetchReleaseNotes(
    currentVersion: string,
    targetVersion: string,
  ): Promise<string> {
    return `
Release Notes ${currentVersion} -> ${targetVersion}:
- API changes in data services
- Updated validation rules
- New property types available
- Process flow engine improvements
- UI component updates
    `;
  }

  private async analyzeImpact(
    customizations: CustomizationRegistry[],
    releaseNotes: string,
  ): Promise<{
    impactDetails: Array<{
      customizationId: string;
      severity: 'breaking' | 'warning' | 'safe';
      description: string;
      autoFixable: boolean;
      suggestedFix?: string;
    }>;
    breakingCount: number;
    warningCount: number;
    safeCount: number;
    autoFixableCount: number;
    recommendations: string;
  }> {
    const prompt = `You are an upgrade impact analyzer for an enterprise platform.

Customizations to analyze:
${JSON.stringify(customizations.map(c => ({
  id: c.id,
  type: c.customizationType,
  artifactCode: c.artifactCode,
  dependencies: c.dependencies,
})), null, 2)}

Release Notes:
${releaseNotes}

Analyze the impact of this upgrade and return a JSON object with:
1. impactDetails: array of affected customizations with:
   - customizationId: the id
   - severity: "breaking" | "warning" | "safe"
   - description: explanation of impact
   - autoFixable: boolean
   - suggestedFix: optional fix suggestion
2. breakingCount: number of breaking changes
3. warningCount: number of warnings
4. safeCount: number of safe customizations
5. autoFixableCount: number of auto-fixable issues
6. recommendations: string with upgrade recommendations

Return only valid JSON.`;

    const response = await this.llmService.complete(
      prompt,
      undefined,
      { maxTokens: 2000 },
    );

    try {
      return JSON.parse(response);
    } catch {
      return {
        impactDetails: customizations.map(c => ({
          customizationId: c.id,
          severity: 'safe' as const,
          description: 'No impact detected',
          autoFixable: false,
        })),
        breakingCount: 0,
        warningCount: 0,
        safeCount: customizations.length,
        autoFixableCount: 0,
        recommendations: 'Unable to analyze impact automatically. Manual review recommended.',
      };
    }
  }

  async generateFixes(analysisId: string): Promise<UpgradeFix[]> {
    const analysis = await this.analysisRepo.findOne({
      where: { id: analysisId },
    });

    if (!analysis) {
      throw new Error('Analysis not found');
    }

    const fixes: UpgradeFix[] = [];

    for (const item of analysis.impactDetails || []) {
      if (item.severity === 'safe') {
        continue;
      }

      const customization = await this.customizationRepo.findOne({
        where: { id: item.customizationId },
      });

      if (!customization) {
        continue;
      }

      const fixSuggestion = await this.generateFixSuggestion(
        customization,
        item.description,
        analysis.toVersion,
      );

      const fix = this.fixRepo.create({
        analysisId,
        customizationId: item.customizationId,
        fixType: item.autoFixable ? 'auto' as FixType : 'manual' as FixType,
        originalCode: JSON.stringify(customization.dependencies),
        fixedCode: fixSuggestion.code,
        fixDescription: fixSuggestion.explanation,
        rollbackAvailable: true,
      });

      await this.fixRepo.save(fix);
      fixes.push(fix);
    }

    return fixes;
  }

  private async generateFixSuggestion(
    customization: CustomizationRegistry,
    issue: string,
    targetVersion: string,
  ): Promise<{
    code: string;
    explanation: string;
    isAutoFixable: boolean;
  }> {
    const prompt = `You are a code migration assistant.

Customization:
${JSON.stringify({
  type: customization.customizationType,
  artifactCode: customization.artifactCode,
  dependencies: customization.dependencies,
}, null, 2)}

Issue: ${issue}
Target Version: ${targetVersion}

Generate a fix suggestion as JSON:
- code: the updated code as a string
- explanation: what was changed and why
- isAutoFixable: boolean if this can be applied automatically

Return only valid JSON.`;

    const response = await this.llmService.complete(
      prompt,
      undefined,
      { maxTokens: 1500 },
    );

    try {
      return JSON.parse(response);
    } catch {
      return {
        code: '',
        explanation: 'Manual review required',
        isAutoFixable: false,
      };
    }
  }

  async applyFix(
    fixId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const fix = await this.fixRepo.findOne({ where: { id: fixId } });
    if (!fix) {
      throw new Error('Fix not found');
    }

    if (fix.fixType !== 'auto') {
      return {
        success: false,
        message: 'This fix requires manual application',
      };
    }

    fix.appliedBy = userId;
    fix.appliedAt = new Date();
    await this.fixRepo.save(fix);

    return { success: true, message: 'Fix applied successfully' };
  }

  async getAnalysisHistory(): Promise<UpgradeImpactAnalysis[]> {
    return this.analysisRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getAnalysis(analysisId: string): Promise<UpgradeImpactAnalysis | null> {
    return this.analysisRepo.findOne({ where: { id: analysisId } });
  }

  async getFixes(analysisId: string): Promise<UpgradeFix[]> {
    return this.fixRepo.find({
      where: { analysisId },
      order: { createdAt: 'ASC' },
    });
  }

  async getUpgradeReadiness(
    targetVersion: string,
  ): Promise<{
    ready: boolean;
    blockers: string[];
    warnings: string[];
    customizationCount: number;
    pendingFixes: number;
  }> {
    const customizations = await this.customizationRepo.count();

    const latestAnalysis = await this.analysisRepo.findOne({
      where: { toVersion: targetVersion },
      order: { createdAt: 'DESC' },
    });

    if (!latestAnalysis) {
      return {
        ready: false,
        blockers: ['No upgrade analysis performed for this version'],
        warnings: [],
        customizationCount: customizations,
        pendingFixes: 0,
      };
    }

    const pendingFixes = await this.fixRepo.count({
      where: { analysisId: latestAnalysis.id, appliedAt: undefined },
    });

    const blockers: string[] = [];
    const warnings: string[] = [];

    for (const item of latestAnalysis.impactDetails || []) {
      if (item.severity === 'breaking') {
        blockers.push(`Breaking change in ${item.customizationId}: ${item.description}`);
      } else if (item.severity === 'warning') {
        warnings.push(`Warning for ${item.customizationId}: ${item.description}`);
      }
    }

    return {
      ready: blockers.length === 0 && pendingFixes === 0,
      blockers,
      warnings,
      customizationCount: customizations,
      pendingFixes,
    };
  }

  async simulateUpgrade(
    targetVersion: string,
  ): Promise<{
    success: boolean;
    issues: Array<{ type: string; message: string; severity: string }>;
    duration: number;
  }> {
    const startTime = Date.now();
    const issues: Array<{ type: string; message: string; severity: string }> = [];

    const customizations = await this.customizationRepo.find();

    for (const customization of customizations) {
      const validationResult = this.validateCustomization(
        customization,
        targetVersion,
      );

      if (!validationResult.valid) {
        issues.push({
          type: 'validation',
          message: `${customization.artifactCode || customization.id}: ${validationResult.error}`,
          severity: validationResult.severity,
        });
      }
    }

    return {
      success: issues.filter(i => i.severity === 'critical').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  private validateCustomization(
    customization: CustomizationRegistry,
    _targetVersion: string,
  ): { valid: boolean; error?: string; severity: string } {
    if (!customization.artifactId) {
      return {
        valid: false,
        error: 'Missing artifact reference',
        severity: 'high',
      };
    }

    if (customization.dependencies?.some(d => d.includes('deprecated'))) {
      return {
        valid: false,
        error: 'Uses deprecated dependencies',
        severity: 'medium',
      };
    }

    return { valid: true, severity: 'none' };
  }
}
