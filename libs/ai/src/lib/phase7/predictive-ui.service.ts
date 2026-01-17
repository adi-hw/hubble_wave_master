// ============================================================
// Phase 7: Predictive UI Service
// Anticipates user needs and adapts interface accordingly
// ============================================================

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import {
  UserBehavior,
  PredictiveSuggestion,
  UserPattern,
  UserAction,
  BehaviorType,
  PatternType,
} from '@hubblewave/instance-db';
import { LLMService } from '../llm.service';

export interface UISuggestion {
  type: 'navigation' | 'action' | 'data' | 'shortcut';
  title: string;
  description: string;
  action: Record<string, unknown>;
  confidence: number;
  reason: string;
}

export interface UserContext {
  currentPage: string;
  recentActions: string[];
  timeOfDay: string;
  dayOfWeek: string;
  sessionDuration: number;
}

@Injectable()
export class PredictiveUIService {
  constructor(
    @InjectRepository(UserBehavior)
    private readonly behaviorRepo: Repository<UserBehavior>,
    @InjectRepository(PredictiveSuggestion)
    private readonly suggestionRepo: Repository<PredictiveSuggestion>,
    @InjectRepository(UserPattern)
    private readonly patternRepo: Repository<UserPattern>,
    private readonly llmService: LLMService,
  ) {}

  async trackBehavior(
    userId: string,
    behavior: {
      type: BehaviorType;
      action: string;
      target?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const record = this.behaviorRepo.create({
      userId,
      action: behavior.action as UserAction,
      targetEntityType: behavior.target,
      context: behavior.metadata || {},
      timestamp: new Date(),
    });

    await this.behaviorRepo.save(record);
    await this.updatePatterns(userId);
  }

  private async updatePatterns(userId: string): Promise<void> {
    const recentBehaviors = await this.behaviorRepo.find({
      where: {
        userId,
        timestamp: MoreThan(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      },
      order: { timestamp: 'DESC' },
      take: 500,
    });

    if (recentBehaviors.length < 10) {
      return;
    }

    const patterns = this.analyzePatterns(recentBehaviors);

    for (const pattern of patterns) {
      const existing = await this.patternRepo.findOne({
        where: {
          userId,
          patternType: pattern.type,
        },
      });

      if (existing) {
        existing.patternData = {
          ...existing.patternData,
          frequency: pattern.frequency,
          ...pattern.metadata,
        };
        existing.confidence = pattern.confidence;
        existing.lastOccurrenceAt = new Date();
        existing.occurrenceCount = existing.occurrenceCount + 1;
        await this.patternRepo.save(existing);
      } else {
        const newPattern = this.patternRepo.create({
          userId,
          patternType: pattern.type,
          patternData: {
            frequency: pattern.frequency,
            ...pattern.metadata,
          },
          confidence: pattern.confidence,
          lastOccurrenceAt: new Date(),
          occurrenceCount: 1,
        });
        await this.patternRepo.save(newPattern);
      }
    }
  }

  private analyzePatterns(
    behaviors: UserBehavior[],
  ): Array<{
    type: PatternType;
    key: string;
    frequency: number;
    confidence: number;
    metadata: Record<string, unknown>;
  }> {
    const patterns: Array<{
      type: PatternType;
      key: string;
      frequency: number;
      confidence: number;
      metadata: Record<string, unknown>;
    }> = [];

    const actionCounts = new Map<string, number>();
    for (const b of behaviors) {
      const key = `${b.action}:${b.targetEntityType || 'none'}`;
      actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
    }

    for (const [key, count] of actionCounts) {
      if (count >= 3) {
        patterns.push({
          type: PatternType.FREQUENT_ACTION,
          key,
          frequency: count,
          confidence: Math.min(count / 10, 1),
          metadata: { action: key.split(':')[0], target: key.split(':')[1] },
        });
      }
    }

    const sequences = this.findSequences(behaviors);
    for (const seq of sequences) {
      patterns.push({
        type: PatternType.SEQUENCE,
        key: seq.actions.join('->'),
        frequency: seq.count,
        confidence: Math.min(seq.count / 5, 1),
        metadata: { actions: seq.actions },
      });
    }

    const timePatterns = this.findTimePatterns(behaviors);
    for (const tp of timePatterns) {
      patterns.push({
        type: PatternType.TIME_BASED,
        key: `${tp.hour}:${tp.action}`,
        frequency: tp.count,
        confidence: Math.min(tp.count / 3, 1),
        metadata: { hour: tp.hour, action: tp.action },
      });
    }

    return patterns;
  }

  private findSequences(
    behaviors: UserBehavior[],
  ): Array<{ actions: string[]; count: number }> {
    const sequenceCounts = new Map<string, number>();

    for (let i = 0; i < behaviors.length - 2; i++) {
      const seq = [
        behaviors[i].action,
        behaviors[i + 1].action,
        behaviors[i + 2].action,
      ];
      const key = seq.join('->');
      sequenceCounts.set(key, (sequenceCounts.get(key) || 0) + 1);
    }

    const sequences: Array<{ actions: string[]; count: number }> = [];
    for (const [key, count] of sequenceCounts) {
      if (count >= 2) {
        sequences.push({ actions: key.split('->'), count });
      }
    }

    return sequences;
  }

  private findTimePatterns(
    behaviors: UserBehavior[],
  ): Array<{ hour: number; action: string; count: number }> {
    const timeCounts = new Map<string, number>();

    for (const b of behaviors) {
      const hour = new Date(b.timestamp).getHours();
      const key = `${hour}:${b.action}`;
      timeCounts.set(key, (timeCounts.get(key) || 0) + 1);
    }

    const patterns: Array<{ hour: number; action: string; count: number }> = [];
    for (const [key, count] of timeCounts) {
      if (count >= 2) {
        const [hour, action] = key.split(':');
        patterns.push({ hour: parseInt(hour, 10), action, count });
      }
    }

    return patterns;
  }

  async getSuggestions(
    userId: string,
    context: UserContext,
  ): Promise<UISuggestion[]> {
    const patterns = await this.patternRepo.find({
      where: { userId },
      order: { confidence: 'DESC' },
      take: 20,
    });

    const recentBehaviors = await this.behaviorRepo.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: 10,
    });

    const suggestions = await this.generateSuggestions(
      patterns,
      recentBehaviors,
      context,
    );

    for (const suggestion of suggestions) {
      // Map 'data' type to 'filter' (closest equivalent in entity types)
      const mappedType = suggestion.type === 'data' ? 'filter' : suggestion.type;
      const record = this.suggestionRepo.create({
        userId,
        suggestionType: mappedType as 'navigation' | 'action' | 'filter' | 'shortcut' | 'tip',
        label: suggestion.title,
        description: suggestion.description,
        actionType: (suggestion.action as Record<string, unknown>)?.actionType as string,
        actionPayload: suggestion.action,
        confidence: suggestion.confidence,
        contextRoute: context.currentPage,
      });
      await this.suggestionRepo.save(record);
    }

    return suggestions;
  }

  private async generateSuggestions(
    patterns: UserPattern[],
    recentBehaviors: UserBehavior[],
    context: UserContext,
  ): Promise<UISuggestion[]> {
    const prompt = `You are a predictive UI assistant. Based on user patterns and current context, suggest helpful actions.

User Patterns:
${JSON.stringify(patterns.map(p => ({
  type: p.patternType,
  data: p.patternData,
  confidence: p.confidence,
})), null, 2)}

Recent Actions:
${JSON.stringify(recentBehaviors.map(b => ({
  action: b.action,
  target: b.targetEntityType,
  time: b.timestamp,
})), null, 2)}

Current Context:
${JSON.stringify(context, null, 2)}

Generate 3-5 suggestions. Each suggestion should have:
- type: navigation | action | data | shortcut
- title: short title
- description: why this is suggested
- action: object with actionType and parameters
- confidence: 0-1
- reason: explanation for the user

Return as JSON array.`;

    const response = await this.llmService.complete(
      prompt,
      undefined,
      { maxTokens: 1000 },
    );

    try {
      return JSON.parse(response);
    } catch {
      return this.getFallbackSuggestions(patterns, context);
    }
  }

  private getFallbackSuggestions(
    patterns: UserPattern[],
    _context: UserContext,
  ): UISuggestion[] {
    const suggestions: UISuggestion[] = [];

    const frequentActions = patterns
      .filter(p => p.patternType === PatternType.FREQUENT_ACTION)
      .slice(0, 3);

    for (const pattern of frequentActions) {
      const actionName = (pattern.patternData as Record<string, unknown>).action as string || 'action';
      suggestions.push({
        type: 'action',
        title: `Quick: ${actionName}`,
        description: `You frequently perform this action`,
        action: pattern.patternData as Record<string, unknown>,
        confidence: pattern.confidence || 0,
        reason: `Based on ${pattern.occurrenceCount} recent uses`,
      });
    }

    const timePatterns = patterns.filter(
      p =>
        p.patternType === PatternType.TIME_BASED &&
        (p.patternData as { hour?: number }).hour === new Date().getHours(),
    );

    for (const pattern of timePatterns.slice(0, 2)) {
      const actionName = (pattern.patternData as { action?: string }).action || 'action';
      suggestions.push({
        type: 'action',
        title: `Usual: ${actionName}`,
        description: `You often do this at this time`,
        action: pattern.patternData as Record<string, unknown>,
        confidence: pattern.confidence || 0,
        reason: `Based on time-of-day patterns`,
      });
    }

    return suggestions;
  }

  async recordSuggestionFeedback(
    suggestionId: string,
    accepted: boolean,
  ): Promise<void> {
    const suggestion = await this.suggestionRepo.findOne({
      where: { id: suggestionId },
    });

    if (suggestion) {
      suggestion.accepted = accepted;
      suggestion.dismissed = !accepted;
      suggestion.respondedAt = new Date();
      await this.suggestionRepo.save(suggestion);
    }
  }

  async getPersonalizedLayout(
    userId: string,
    _page: string,
  ): Promise<{
    widgets: Array<{ id: string; position: number; priority: number }>;
    shortcuts: Array<{ action: string; label: string }>;
    recentItems: Array<{ type: string; id: string; label: string }>;
  }> {
    const patterns = await this.patternRepo.find({
      where: { userId },
      order: { occurrenceCount: 'DESC' },
    });

    const frequentActions = patterns
      .filter(p => p.patternType === PatternType.FREQUENT_ACTION)
      .slice(0, 5);

    const shortcuts = frequentActions.map(p => {
      const actionName = (p.patternData as { action?: string }).action || 'action';
      return {
        action: actionName,
        label: actionName,
      };
    });

    const recentBehaviors = await this.behaviorRepo.find({
      where: { userId, action: 'view' as UserAction },
      order: { timestamp: 'DESC' },
      take: 10,
    });

    const recentItems = recentBehaviors.map(b => ({
      type: b.action,
      id: b.targetEntityId || '',
      label: b.targetEntityType || b.action,
    }));

    return {
      widgets: [
        { id: 'quick-actions', position: 1, priority: 1 },
        { id: 'recent-items', position: 2, priority: 2 },
        { id: 'suggestions', position: 3, priority: 3 },
      ],
      shortcuts,
      recentItems,
    };
  }

  async getUserInsights(userId: string): Promise<{
    totalActions: number;
    topActions: Array<{ action: string; count: number }>;
    activeHours: number[];
    patterns: Array<{ type: string; description: string }>;
  }> {
    const behaviors = await this.behaviorRepo.find({
      where: { userId },
    });

    const actionCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();

    for (const b of behaviors) {
      actionCounts.set(b.action, (actionCounts.get(b.action) || 0) + 1);
      const hour = new Date(b.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    const topActions = Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    const activeHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour]) => hour);

    const patterns = await this.patternRepo.find({
      where: { userId },
      order: { confidence: 'DESC' },
      take: 10,
    });

    return {
      totalActions: behaviors.length,
      topActions,
      activeHours,
      patterns: patterns.map(p => ({
        type: p.patternType,
        description: JSON.stringify(p.patternData),
      })),
    };
  }
}
