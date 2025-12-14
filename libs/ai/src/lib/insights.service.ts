import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LLMService } from './llm.service';
import { AVAInsight, AVAAction } from './ava.service';

/**
 * Proactive Insights Engine for AVA
 * Generates insights based on patterns, anomalies, and recommendations
 */

export interface InsightRule {
  id: string;
  name: string;
  type: 'anomaly' | 'trend' | 'recommendation' | 'alert';
  category: string;
  query: string;
  threshold?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  template: string;
  actions?: AVAAction[];
  enabled: boolean;
}

export interface InsightContext {
  userId: string;
  tenantId: string;
  userRole?: string;
  collections?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  // Built-in insight rules
  private readonly builtInRules: InsightRule[] = [
    {
      id: 'high-priority-unassigned',
      name: 'High Priority Unassigned',
      type: 'alert',
      category: 'incidents',
      query: `
        SELECT COUNT(*) as count
        FROM incidents
        WHERE priority IN ('high', 'critical')
          AND assigned_to IS NULL
          AND status NOT IN ('resolved', 'closed')
          AND created_at > NOW() - INTERVAL '24 hours'
      `,
      threshold: 1,
      priority: 'high',
      template: 'There are {count} high-priority incidents that need assignment.',
      actions: [
        { type: 'navigate', label: 'View unassigned incidents', target: '/incidents?status=open&assigned=none&priority=high,critical' }
      ],
      enabled: true,
    },
    {
      id: 'sla-breach-warning',
      name: 'SLA Breach Warning',
      type: 'alert',
      category: 'sla',
      query: `
        SELECT COUNT(*) as count
        FROM incidents i
        JOIN commitments c ON c.collection_code = 'incidents'
        WHERE i.status NOT IN ('resolved', 'closed')
          AND i.created_at + (c.target_value || ' hours')::interval < NOW() + INTERVAL '2 hours'
      `,
      threshold: 1,
      priority: 'critical',
      template: '{count} incidents are at risk of breaching SLA in the next 2 hours.',
      actions: [
        { type: 'navigate', label: 'View at-risk incidents', target: '/incidents?sla_status=at_risk' }
      ],
      enabled: true,
    },
    {
      id: 'duplicate-incidents',
      name: 'Potential Duplicates',
      type: 'recommendation',
      category: 'incidents',
      query: `
        SELECT COUNT(*) as count
        FROM incidents i1
        JOIN incidents i2 ON i1.short_description ILIKE '%' || i2.short_description || '%'
        WHERE i1.id != i2.id
          AND i1.created_at > NOW() - INTERVAL '24 hours'
          AND i2.created_at > NOW() - INTERVAL '7 days'
      `,
      threshold: 1,
      priority: 'medium',
      template: 'AVA detected {count} potentially duplicate incidents that could be merged.',
      actions: [
        { type: 'navigate', label: 'Review duplicates', target: '/incidents?view=duplicates' }
      ],
      enabled: true,
    },
    {
      id: 'knowledge-gap',
      name: 'Knowledge Gap Detected',
      type: 'recommendation',
      category: 'knowledge',
      query: `
        SELECT COUNT(DISTINCT i.short_description) as count
        FROM incidents i
        LEFT JOIN document_chunks dc ON dc.content ILIKE '%' || i.short_description || '%'
        WHERE i.created_at > NOW() - INTERVAL '7 days'
          AND dc.id IS NULL
        GROUP BY i.category
        HAVING COUNT(*) >= 3
      `,
      threshold: 1,
      priority: 'low',
      template: 'Multiple incidents share topics not covered in the knowledge base. Consider creating articles.',
      actions: [
        { type: 'create', label: 'Create knowledge article', target: '/knowledge/new' }
      ],
      enabled: true,
    },
    {
      id: 'trending-issue',
      name: 'Trending Issue',
      type: 'trend',
      category: 'incidents',
      query: `
        SELECT category, COUNT(*) as count
        FROM incidents
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY category
        HAVING COUNT(*) > (
          SELECT AVG(daily_count) * 2
          FROM (
            SELECT category, DATE(created_at), COUNT(*) as daily_count
            FROM incidents
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY category, DATE(created_at)
          ) daily_stats
          WHERE daily_stats.category = incidents.category
        )
      `,
      threshold: 1,
      priority: 'medium',
      template: 'Incident volume for "{category}" is trending higher than usual today.',
      actions: [
        { type: 'navigate', label: 'View category', target: '/incidents?category={category}' }
      ],
      enabled: true,
    },
  ];

  constructor(private llmService: LLMService) {}

  /**
   * Generate insights for a user based on context
   */
  async generateInsights(
    dataSource: DataSource,
    _context: InsightContext,
    limit = 5
  ): Promise<AVAInsight[]> {
    const insights: AVAInsight[] = [];
    const now = new Date();

    for (const rule of this.builtInRules) {
      if (!rule.enabled) continue;

      try {
        const result = await this.evaluateRule(dataSource, rule);

        if (result && result.triggered) {
          insights.push({
            type: rule.type,
            title: rule.name,
            description: this.formatTemplate(rule.template, result.data),
            priority: rule.priority,
            category: rule.category,
            actions: this.formatActions(rule.actions, result.data),
            createdAt: now,
          });
        }
      } catch (error) {
        this.logger.debug(`Rule ${rule.id} evaluation failed: ${error}`);
        // Continue with other rules
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return insights.slice(0, limit);
  }

  /**
   * Get AI-generated insight from data patterns
   */
  async getAIInsight(
    dataSource: DataSource,
    topic: string,
    _context: InsightContext
  ): Promise<AVAInsight | null> {
    try {
      // Gather relevant data
      const dataPoints = await this.gatherDataForTopic(dataSource, topic);

      if (!dataPoints) return null;

      // Ask LLM to analyze
      const prompt = `Analyze the following data and provide a brief, actionable insight:

Topic: ${topic}
Data: ${JSON.stringify(dataPoints, null, 2)}

Provide a single paragraph insight that:
1. Identifies the key pattern or issue
2. Explains its significance
3. Suggests a specific action

Keep it under 100 words.`;

      const analysis = await this.llmService.complete(
        prompt,
        'You are AVA, an AI analyst for enterprise operations. Provide concise, actionable insights.'
      );

      return {
        type: 'recommendation',
        title: `Insight: ${topic}`,
        description: analysis,
        priority: 'medium',
        category: topic,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to generate AI insight for ${topic}`, error);
      return null;
    }
  }

  /**
   * Get personalized recommendations for a user
   */
  async getPersonalizedRecommendations(
    dataSource: DataSource,
    context: InsightContext,
    limit = 3
  ): Promise<AVAInsight[]> {
    const recommendations: AVAInsight[] = [];
    const now = new Date();

    try {
      // Check for user's pending tasks
      const pendingTasks = await dataSource.query(
        `SELECT COUNT(*) as count FROM tasks
         WHERE assigned_to = $1 AND status = 'pending'`,
        [context.userId]
      );

      if (pendingTasks[0]?.count > 5) {
        recommendations.push({
          type: 'recommendation',
          title: 'Task Backlog',
          description: `You have ${pendingTasks[0].count} pending tasks. Consider prioritizing or delegating some.`,
          priority: 'medium',
          category: 'productivity',
          actions: [
            { type: 'navigate', label: 'View my tasks', target: '/tasks?assigned=me&status=pending' }
          ],
          createdAt: now,
        });
      }

      // Check for stale assigned items
      const staleItems = await dataSource.query(
        `SELECT COUNT(*) as count FROM incidents
         WHERE assigned_to = $1 AND status = 'in_progress'
           AND updated_at < NOW() - INTERVAL '3 days'`,
        [context.userId]
      );

      if (staleItems[0]?.count > 0) {
        recommendations.push({
          type: 'recommendation',
          title: 'Stale Work Items',
          description: `${staleItems[0].count} of your assigned items haven't been updated in 3+ days.`,
          priority: 'low',
          category: 'productivity',
          actions: [
            { type: 'navigate', label: 'Review stale items', target: '/incidents?assigned=me&stale=true' }
          ],
          createdAt: now,
        });
      }
    } catch (error) {
      this.logger.debug('Error generating personalized recommendations', error);
    }

    return recommendations.slice(0, limit);
  }

  /**
   * Evaluate a single insight rule
   */
  private async evaluateRule(
    dataSource: DataSource,
    rule: InsightRule
  ): Promise<{ triggered: boolean; data: Record<string, unknown> } | null> {
    try {
      const result = await dataSource.query(rule.query);

      if (!result || result.length === 0) {
        return { triggered: false, data: {} };
      }

      const data = result[0];
      const value = parseInt(data.count || '0', 10);
      const triggered = rule.threshold ? value >= rule.threshold : value > 0;

      return {
        triggered,
        data: { ...data, count: value },
      };
    } catch {
      return null;
    }
  }

  /**
   * Format template with data values
   */
  private formatTemplate(
    template: string,
    data: Record<string, unknown>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }

    return result;
  }

  /**
   * Format actions with data values
   */
  private formatActions(
    actions: AVAAction[] | undefined,
    data: Record<string, unknown>
  ): AVAAction[] | undefined {
    if (!actions) return undefined;

    return actions.map((action) => ({
      ...action,
      target: this.formatTemplate(action.target, data),
      label: this.formatTemplate(action.label, data),
    }));
  }

  /**
   * Gather data for a specific topic
   */
  private async gatherDataForTopic(
    dataSource: DataSource,
    topic: string
  ): Promise<Record<string, unknown> | null> {
    // This would be expanded based on the topic
    const topicQueries: Record<string, string> = {
      incidents: `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE priority IN ('high', 'critical')) as high_priority,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
        FROM incidents
        WHERE created_at > NOW() - INTERVAL '7 days'
      `,
      requests: `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'approved') as approved
        FROM service_requests
        WHERE created_at > NOW() - INTERVAL '7 days'
      `,
    };

    const query = topicQueries[topic.toLowerCase()];
    if (!query) return null;

    try {
      const result = await dataSource.query(query);
      return result[0] || null;
    } catch {
      return null;
    }
  }
}
