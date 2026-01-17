import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LLMChatMessage, LLMService } from './llm.service';
import { RAGService } from './rag.service';
import { InstanceContextService } from './instance-context.service';
import { PlatformKnowledgeService } from './platform-knowledge.service';
import { UpgradeAssistantService } from './upgrade-assistant.service';

/**
 * AVA - AI Virtual Assistant for HubbleWave
 * The primary interface for AI interactions in the platform
 */

export interface AVAContext {
  userId: string;
  userRole?: string;
  userName?: string;
  currentPage?: string;
  recentActivity?: string[];
  preferences?: Record<string, unknown>;
}

export interface AVAMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: AVASource[];
  actions?: AVAAction[];
  cards?: AVACard[];
}

export interface AVASource {
  type: string;
  id: string;
  title: string;
  relevance: number;
}

export interface AVAAction {
  type: 'navigate' | 'create' | 'update' | 'execute';
  label: string;
  target: string;
  params?: Record<string, unknown>;
}

export interface AVACard {
  code: string;
  name: string;
  description?: string | null;
  layout: Record<string, unknown>;
  actionBindings?: Record<string, unknown>;
}

export interface AVAResponse {
  message: string;
  sources: AVASource[];
  suggestedActions: AVAAction[];
  followUpQuestions?: string[];
  cards?: AVACard[];
  confidence: number;
  model: string;
  duration?: number;
}

export interface AVAInsight {
  type: 'anomaly' | 'trend' | 'recommendation' | 'alert';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  actions?: AVAAction[];
  createdAt: Date;
}

// AVA Personality Configuration
const AVA_SYSTEM_PROMPT = `You are AVA (AI Virtual Assistant), the intelligent assistant for HubbleWave - an enterprise operations platform.

## Your Identity
- Name: AVA (AI Virtual Assistant)
- Role: Proactive enterprise assistant
- Brand: HubbleWave

## Your Personality
- Professional yet approachable
- Proactive and helpful - anticipate user needs
- Clear and concise - respect users' time
- Confident but honest about limitations
- Solution-oriented - always suggest next steps

## Your Capabilities
1. **Knowledge Access**: Search the knowledge base, service catalog, and records
2. **Task Assistance**: Help users navigate, create, and manage records
3. **Insights**: Identify patterns, anomalies, and provide recommendations
4. **Guidance**: Explain processes and best practices
5. **Action Execution**: Perform platform actions on behalf of users (with permission)

## Response Guidelines
- Start with a direct answer when possible
- Cite sources with [Source: title] format
- Suggest relevant follow-up actions
- Offer to help with related tasks
- Use bullet points for clarity
- Keep responses focused and actionable

## Boundaries
- Always identify yourself as AVA when asked
- Acknowledge when you don't have enough information
- Never make up data or sources
- Respect user permissions and data access levels
- Ask for clarification when the request is ambiguous
- NEVER share platform source code, internal implementation details, or system configurations
- NEVER discuss how the HubbleWave platform is built, its architecture, or proprietary algorithms
- Focus only on helping users with their instance data and operations`;

const AVA_GREETING_TEMPLATES = [
  "Hi! I'm AVA, your HubbleWave assistant. How can I help you today?",
  "Hello! I'm AVA. I can help you with knowledge lookup, creating records, or navigating the platform. What do you need?",
  "Hey there! AVA here, ready to assist. What are you working on today?",
];

const AVA_CLARIFICATION_TEMPLATES = [
  "I want to make sure I help you correctly. Could you tell me more about {topic}?",
  "To give you the best answer, I need a bit more context about {topic}.",
  "I have a few options for {topic}. Which aspect are you most interested in?",
];

@Injectable()
export class AVAService {
  private readonly logger = new Logger(AVAService.name);

  constructor(
    private readonly ragService: RAGService,
    private readonly instanceContextService: InstanceContextService,
    private readonly platformKnowledgeService: PlatformKnowledgeService,
    private readonly upgradeAssistantService: UpgradeAssistantService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * Get a greeting from AVA
   */
  getGreeting(context?: AVAContext): string {
    const template = AVA_GREETING_TEMPLATES[
      Math.floor(Math.random() * AVA_GREETING_TEMPLATES.length)
    ];

    if (context?.userName) {
      return template.replace("Hi!", `Hi ${context.userName}!`);
    }

    return template;
  }

  /**
   * Main chat interface with AVA
   */
  async chat(
    dataSource: DataSource,
    message: string,
    context: AVAContext,
    history: AVAMessage[] = []
  ): Promise<AVAResponse> {
    // Get instance-specific context for personalization
    const instanceContext = await this.getInstanceContextForPrompt(dataSource, context);
    const systemPrompt = this.buildSystemPrompt(context, instanceContext);

    // Build conversation history for LLM
    const messages: LLMChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    for (const msg of history.slice(-10)) { // Keep last 10 messages
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Perform RAG query
    const ragResponse = await this.ragService.query(dataSource, message, {
      maxDocuments: 5,
      similarityThreshold: 0.5,
      systemPrompt,
      temperature: 0.7,
    });

    // Extract sources
    const sources: AVASource[] = ragResponse.sources.map((s) => ({
      type: s.sourceType,
      id: s.sourceId,
      title: s.title || s.sourceId,
      relevance: s.similarity,
    }));

    // Generate suggested actions based on context and response
    const suggestedActions = await this.generateSuggestedActions(
      dataSource,
      message,
      ragResponse.answer,
      context
    );

    const groundedMessage = this.buildGroundedAnswer(ragResponse.answer, sources);

    // Generate follow-up questions
    const followUpQuestions = await this.generateFollowUpQuestions(
      message,
      ragResponse.answer
    );

    return {
      message: groundedMessage,
      sources,
      suggestedActions,
      followUpQuestions,
      confidence: this.calculateConfidence(ragResponse.sources),
      model: ragResponse.modelUsed,
      duration: ragResponse.totalDuration,
    };
  }

  /**
   * Stream chat response from AVA
   */
  async *chatStream(
    dataSource: DataSource,
    message: string,
    context: AVAContext,
    _history: AVAMessage[] = []
  ): AsyncGenerator<{ type: 'chunk' | 'sources' | 'actions' | 'done'; data: unknown }> {
    // Build context-aware system prompt
    const systemPrompt = this.buildSystemPrompt(context);

    // Accumulate response chunks to generate actions after streaming completes
    let fullResponse = '';

    // Stream RAG response
    for await (const event of this.ragService.queryStream(dataSource, message, {
      maxDocuments: 5,
      similarityThreshold: 0.5,
      systemPrompt,
      temperature: 0.7,
    })) {
      if (event.type === 'sources') {
        const sources = (event.data as Array<{ sourceType: string; sourceId: string; title?: string; similarity: number }>).map((s) => ({
          type: s.sourceType,
          id: s.sourceId,
          title: s.title || s.sourceId,
          relevance: s.similarity,
        }));
        yield { type: 'sources', data: sources };
      } else if (event.type === 'chunk') {
        fullResponse += event.data as string;
        yield { type: 'chunk', data: event.data };
      } else if (event.type === 'done') {
        // Generate actions after response is complete with full accumulated response
        const actions = await this.generateSuggestedActions(
          dataSource,
          message,
          fullResponse,
          context
        );
        yield { type: 'actions', data: actions };
        yield { type: 'done', data: event.data };
      }
    }
  }

  /**
   * Get proactive insights for a user
   *
   * Aggregates insights from multiple sources:
   * - Active anomalies (detected by pattern analysis)
   * - Predictions that may require attention
   * - Personalized suggestions based on user behavior
   */
  async getInsights(
    dataSource: DataSource,
    context: AVAContext,
    limit = 5
  ): Promise<AVAInsight[]> {
    this.logger.debug(`Getting insights for user ${context.userId}`);
    const insights: AVAInsight[] = [];

    try {
      // Get recent anomalies
      const anomalyInsights = await this.getAnomalyInsights(dataSource, context, Math.ceil(limit / 2));
      insights.push(...anomalyInsights);

      // Get prediction-based insights
      const predictionInsights = await this.getPredictionInsights(dataSource, context, Math.ceil(limit / 3));
      insights.push(...predictionInsights);

      // Get personalized suggestions
      const suggestionInsights = await this.getSuggestionInsights(dataSource, context, Math.ceil(limit / 3));
      insights.push(...suggestionInsights);

      // Sort by priority and creation date
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      insights.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      return insights.slice(0, limit);
    } catch (error: any) {
      this.logger.error(`Error getting insights: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Get insights from detected anomalies
   */
  private async getAnomalyInsights(
    dataSource: DataSource,
    _context: AVAContext,
    limit: number
  ): Promise<AVAInsight[]> {
    const anomalyRepo = dataSource.getRepository('AVAAnomaly');

    const anomalies = await anomalyRepo.find({
      where: {
        isResolved: false,
      },
      order: {
        severity: 'DESC',
        detectedAt: 'DESC',
      },
      take: limit,
    });

    return anomalies.map((anomaly: any) => ({
      type: 'anomaly' as const,
      title: `Anomaly Detected: ${anomaly.anomalyType}`,
      description: anomaly.description,
      priority: anomaly.severity,
      category: anomaly.affectedEntity || 'system',
      actions: anomaly.affectedEntityId
        ? [
            {
              type: 'navigate' as const,
              label: `View ${anomaly.affectedEntity}`,
              target: `/${anomaly.affectedEntity}s/${anomaly.affectedEntityId}`,
            },
          ]
        : undefined,
      createdAt: new Date(anomaly.detectedAt),
    }));
  }

  /**
   * Get insights from predictions
   */
  private async getPredictionInsights(
    dataSource: DataSource,
    _context: AVAContext,
    limit: number
  ): Promise<AVAInsight[]> {
    const predictionRepo = dataSource.getRepository('AVAPrediction');
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const predictions = await predictionRepo
      .createQueryBuilder('p')
      .where('p.is_active = true')
      .andWhere('p.target_date BETWEEN :now AND :weekFromNow', { now, weekFromNow })
      .andWhere('p.confidence >= 0.7')
      .orderBy('p.target_date', 'ASC')
      .take(limit)
      .getMany();

    return predictions.map((prediction: any) => {
      const value = prediction.predictionValue as Record<string, any>;
      const predictionType = prediction.predictionType;

      let title = 'Upcoming Prediction';
      let description = '';
      let priority: AVAInsight['priority'] = 'medium';

      switch (predictionType) {
        case 'capacity':
          title = 'Capacity Alert';
          description = `Predicted ${value.metric || 'resource'} will reach ${value.threshold || 'threshold'} by ${new Date(prediction.targetDate).toLocaleDateString()}`;
          priority = value.urgency === 'high' ? 'high' : 'medium';
          break;
        case 'maintenance':
          title = 'Maintenance Recommended';
          description = `${value.asset || 'Asset'} may require maintenance based on predicted wear patterns`;
          priority = 'medium';
          break;
        case 'trend':
          title = 'Trend Insight';
          description = value.description || `Trend detected in ${value.metric || 'metrics'}`;
          priority = 'low';
          break;
        default:
          description = JSON.stringify(value).substring(0, 100);
      }

      return {
        type: 'trend' as const,
        title,
        description,
        priority,
        category: predictionType,
        createdAt: new Date(prediction.createdAt),
      };
    });
  }

  /**
   * Get personalized suggestion insights
   */
  private async getSuggestionInsights(
    dataSource: DataSource,
    context: AVAContext,
    limit: number
  ): Promise<AVAInsight[]> {
    const suggestionRepo = dataSource.getRepository('AVASuggestion');

    const suggestions = await suggestionRepo.find({
      where: {
        userId: context.userId,
        status: 'pending',
      },
      order: {
        relevanceScore: 'DESC',
        createdAt: 'DESC',
      },
      take: limit,
    });

    return suggestions.map((suggestion: any) => ({
      type: 'recommendation' as const,
      title: suggestion.title || 'Suggestion',
      description: suggestion.description,
      priority: 'low' as const,
      category: suggestion.suggestionType || 'general',
      actions: suggestion.actionPayload
        ? [
            {
              type: (suggestion.actionType || 'navigate') as AVAAction['type'],
              label: suggestion.actionLabel || 'Take Action',
              target: suggestion.actionTarget || '/',
              params: suggestion.actionPayload,
            },
          ]
        : undefined,
      createdAt: new Date(suggestion.createdAt),
    }));
  }

  /**
   * Quick action suggestions based on current context
   */
  async getQuickActions(
    context: AVAContext
  ): Promise<AVAAction[]> {
    const actions: AVAAction[] = [];

    // Add context-based actions
    if (context.currentPage?.includes('incident')) {
      actions.push({
        type: 'create',
        label: 'Create new incident',
        target: '/incidents/new',
      });
      actions.push({
        type: 'navigate',
        label: 'View my incidents',
        target: '/incidents?assigned_to=me',
      });
    }

    if (context.currentPage?.includes('request')) {
      actions.push({
        type: 'navigate',
        label: 'Browse service catalog',
        target: '/catalog',
      });
      actions.push({
        type: 'create',
        label: 'Submit a request',
        target: '/requests/new',
      });
    }

    // Add general actions
    actions.push({
      type: 'navigate',
      label: 'Search knowledge base',
      target: '/knowledge',
    });

    return actions.slice(0, 5);
  }

  /**
   * Summarize a document or record for the user
   */
  async summarize(
    text: string,
    style: 'brief' | 'detailed' | 'bullet' = 'brief'
  ): Promise<string> {
    return this.ragService.summarize(text, 200, style);
  }

  /**
   * Ask AVA to clarify something
   */
  async requestClarification(topic: string): Promise<string> {
    const template = AVA_CLARIFICATION_TEMPLATES[
      Math.floor(Math.random() * AVA_CLARIFICATION_TEMPLATES.length)
    ];
    return template.replace('{topic}', topic);
  }

  /**
   * Build context-aware system prompt with instance-specific information
   */
  private buildSystemPrompt(context: AVAContext, instanceContext?: string): string {
    let prompt = AVA_SYSTEM_PROMPT;

    // Add instance-specific context if available
    if (instanceContext) {
      prompt += instanceContext;
    }

    // Add user context
    prompt += `\n\n## Current Context`;
    if (context.userName) {
      prompt += `\n- User: ${context.userName}`;
    }
    if (context.userRole) {
      prompt += `\n- Role: ${context.userRole}`;
    }
    if (context.currentPage) {
      prompt += `\n- Current Page: ${context.currentPage}`;
    }
    if (context.recentActivity && context.recentActivity.length > 0) {
      prompt += `\n- Recent Activity: ${context.recentActivity.slice(0, 3).join(', ')}`;
    }

    return prompt;
  }

  /**
   * Get instance-specific context for AVA prompts
   */
  async getInstanceContextForPrompt(
    dataSource: DataSource,
    context: AVAContext
  ): Promise<string> {
    try {
      let fullContext = '';

      // Get instance profile
      const instanceProfile = await this.instanceContextService.getInstanceProfile(
        dataSource
      );

      // Get user profile for personalization
      const userProfile = await this.instanceContextService.getUserProfile(
        dataSource,
        context.userId
      );

      // Build instance context prompt
      fullContext += this.instanceContextService.buildContextPrompt(instanceProfile, userProfile || undefined);

      // Add platform capabilities summary (for admin users)
      if (context.userRole && ['admin', 'itil_admin'].includes(context.userRole)) {
        fullContext += this.platformKnowledgeService.buildCapabilitiesSummary();
      }

      // Add upgrade context
      try {
        const upgradeContext = await this.upgradeAssistantService.buildUpgradeContextForAVA(
          dataSource
        );
        fullContext += upgradeContext;
      } catch {
        // Ignore upgrade context errors
      }

      return fullContext;
    } catch (error) {
      this.logger.debug(`Error building instance context: ${error}`);
      return '';
    }
  }

  /**
   * Get platform capabilities for user queries
   */
  getPlatformCapabilities(options?: { category?: string; query?: string }) {
    if (options?.query) {
      return this.platformKnowledgeService.searchCapabilities(options.query);
    }
    return this.platformKnowledgeService.getCapabilities();
  }

  /**
   * Get upgrade guidance for the instance
   */
  async getUpgradeGuidance(
    dataSource: DataSource,
    phase: 'pre' | 'during' | 'post' = 'pre'
  ) {
    return this.upgradeAssistantService.generateUpgradeGuidance(dataSource, phase);
  }

  /**
   * Ask about upgrade-related topics
   */
  async askAboutUpgrade(
    dataSource: DataSource,
    question: string
  ): Promise<string> {
    return this.upgradeAssistantService.askAboutUpgrade(dataSource, question);
  }

  /**
   * Generate suggested actions based on conversation
   */
  private async generateSuggestedActions(
    _dataSource: DataSource,
    question: string,
    _answer: string,
    _context: AVAContext
  ): Promise<AVAAction[]> {
    const actions: AVAAction[] = [];

    // Analyze intent from question
    const lowerQuestion = question.toLowerCase();

    // Create actions
    if (lowerQuestion.includes('create') || lowerQuestion.includes('new') || lowerQuestion.includes('add')) {
      if (lowerQuestion.includes('incident')) {
        actions.push({
          type: 'create',
          label: 'Create incident',
          target: '/incidents/new',
        });
      }
      if (lowerQuestion.includes('request')) {
        actions.push({
          type: 'create',
          label: 'Submit request',
          target: '/requests/new',
        });
      }
    }

    // Navigation actions
    if (lowerQuestion.includes('show') || lowerQuestion.includes('find') || lowerQuestion.includes('where')) {
      if (lowerQuestion.includes('incident')) {
        actions.push({
          type: 'navigate',
          label: 'View incidents',
          target: '/incidents',
        });
      }
      if (lowerQuestion.includes('knowledge') || lowerQuestion.includes('article')) {
        actions.push({
          type: 'navigate',
          label: 'Browse knowledge base',
          target: '/knowledge',
        });
      }
    }

    return actions.slice(0, 3);
  }

  /**
   * Generate follow-up questions
   */
  private async generateFollowUpQuestions(
    question: string,
    _answer: string
  ): Promise<string[]> {
    // Simple follow-up generation based on topic
    const followUps: string[] = [];

    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('incident')) {
      followUps.push('Would you like me to create an incident for this?');
      followUps.push('Should I check for similar incidents?');
    }

    if (lowerQuestion.includes('how to') || lowerQuestion.includes('help')) {
      followUps.push('Would you like more detailed steps?');
      followUps.push('Should I show you related articles?');
    }

    return followUps.slice(0, 2);
  }

  /**
   * Calculate confidence score based on sources
   */
  private calculateConfidence(sources: Array<{ similarity: number }>): number {
    if (sources.length === 0) return 0.3;

    const avgSimilarity = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;
    const hasHighQualitySources = sources.some((s) => s.similarity > 0.8);

    let confidence = avgSimilarity;
    if (hasHighQualitySources) confidence += 0.1;
    if (sources.length >= 3) confidence += 0.05;

    return Math.min(confidence, 1);
  }

  private buildGroundedAnswer(answer: string, sources: AVASource[]): string {
    if (sources.length === 0) {
      return 'I do not have enough grounded information to answer that yet. Please provide more context or point me to a record, collection, or knowledge article.';
    }

    if (answer.includes('[Source:')) {
      return answer;
    }

    const citationLines = sources.map((source) => `- [Source: ${source.title}]`);
    return `${answer}\n\nSources:\n${citationLines.join('\n')}`;
  }
  /**
   * Transform text using AI instructions
   */
  async transformText(
    text: string,
    instruction: string,
    context?: any
  ): Promise<string> {
    const prompt = `
You are an expert editor and writing assistant.
Transform the following text according to the instruction: "${instruction}".

TEXT TO TRANSFORM:
${text}

CONTEXT:
${context ? JSON.stringify(context) : 'None'}

RULES:
- Maintain the original meaning.
- Adjust tone and length as requested.
- Return ONLY the transformed text.
- Do not include explanations or quotes around the result.
`;

    const response = await this.llmService.complete(prompt, undefined, {
       temperature: 0.3, 
       maxTokens: 500,
    });
    
    return response.trim();
  }
}


// Export AVA branding constants
export const AVA_BRANDING = {
  name: 'AVA',
  fullName: 'AI Virtual Assistant',
  tagline: 'Your intelligent HubbleWave assistant',
  avatar: '/assets/ava-avatar.svg',
  colors: {
    primary: '#6366f1', // Indigo
    secondary: '#8b5cf6', // Violet
    accent: '#ec4899', // Pink
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
  },
  personality: {
    traits: ['helpful', 'proactive', 'professional', 'knowledgeable'],
    tone: 'friendly-professional',
    style: 'concise-actionable',
  },
};
