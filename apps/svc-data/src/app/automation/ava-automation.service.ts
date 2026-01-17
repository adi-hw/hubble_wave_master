/**
 * AvaAutomationService
 * HubbleWave Platform - Phase 3
 *
 * AVA integration for automation rules.
 * Allows natural language creation and management of automation rules.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';

export interface AvaAutomationRequest {
  intent: 'create_rule' | 'explain_rule' | 'suggest_rules' | 'list_rules' | 'debug_rule';
  message: string;
  collectionId?: string;
  automationId?: string;
  context?: {
    collectionName?: string;
    properties?: Array<{ code: string; label: string; type: string }>;
    existingRules?: Array<{ id: string; name: string; description?: string }>;
  };
}

export interface AvaAutomationResponse {
  success: boolean;
  message: string;
  automation?: {
    id?: string;
    name: string;
    description?: string;
    triggerTiming: string;
    triggerOperations: string[];
    condition?: Record<string, unknown>;
    actions: Array<{ type: string; config: Record<string, unknown> }>;
  };
  suggestions?: Array<{
    name: string;
    description: string;
    triggerTiming: string;
    benefit: string;
  }>;
  explanation?: string;
  followUpQuestions?: string[];
}

const AUTOMATION_INTENTS = {
  create: ['create', 'add', 'make', 'setup', 'configure', 'build', 'set up'],
  explain: ['explain', 'describe', 'what does', 'how does', 'tell me about'],
  suggest: ['suggest', 'recommend', 'what automation', 'which rules', 'ideas'],
  list: ['list', 'show', 'get', 'all', 'existing'],
  debug: ['debug', 'why', 'not working', 'troubleshoot', 'fix'],
};

@Injectable()
export class AvaAutomationService {
  private readonly logger = new Logger(AvaAutomationService.name);

  constructor(
    private readonly automationService: AutomationService,
    protected readonly conditionEvaluator: ConditionEvaluatorService,
  ) {}

  /**
   * Process a natural language automation request
   */
  async processRequest(request: AvaAutomationRequest): Promise<AvaAutomationResponse> {
    const { intent, message, collectionId, automationId, context } = request;

    this.logger.debug(`Processing AVA automation request: ${intent} - ${message}`);

    switch (intent) {
      case 'create_rule':
        return this.handleCreateRule(message, collectionId, context);
      case 'explain_rule':
        return this.handleExplainRule(automationId);
      case 'suggest_rules':
        return this.handleSuggestRules(collectionId, context);
      case 'list_rules':
        return this.handleListRules(collectionId);
      case 'debug_rule':
        return this.handleDebugRule(automationId, message);
      default:
        return {
          success: false,
          message: "I'm not sure what you'd like to do with automations. You can ask me to create, explain, suggest, or list automation rules.",
        };
    }
  }

  /**
   * Parse intent from natural language message
   */
  parseIntent(message: string): AvaAutomationRequest['intent'] {
    const lowerMessage = message.toLowerCase();

    for (const keyword of AUTOMATION_INTENTS.create) {
      if (lowerMessage.includes(keyword)) return 'create_rule';
    }
    for (const keyword of AUTOMATION_INTENTS.explain) {
      if (lowerMessage.includes(keyword)) return 'explain_rule';
    }
    for (const keyword of AUTOMATION_INTENTS.suggest) {
      if (lowerMessage.includes(keyword)) return 'suggest_rules';
    }
    for (const keyword of AUTOMATION_INTENTS.list) {
      if (lowerMessage.includes(keyword)) return 'list_rules';
    }
    for (const keyword of AUTOMATION_INTENTS.debug) {
      if (lowerMessage.includes(keyword)) return 'debug_rule';
    }

    return 'suggest_rules';
  }

  /**
   * Handle create rule request
   */
  private async handleCreateRule(
    message: string,
    collectionId?: string,
    context?: AvaAutomationRequest['context']
  ): Promise<AvaAutomationResponse> {
    if (!collectionId) {
      return {
        success: false,
        message: 'Please select a collection first to create an automation rule.',
        followUpQuestions: ['Which collection would you like to create a rule for?'],
      };
    }

    const parsed = this.parseRuleFromMessage(message, context);

    if (!parsed.name) {
      return {
        success: false,
        message: "I couldn't understand the rule you want to create. Could you describe it more specifically?",
        followUpQuestions: [
          'What should trigger the rule? (e.g., "when a record is created")',
          'What condition should be checked? (e.g., "if status equals Active")',
          'What action should happen? (e.g., "set priority to High")',
        ],
      };
    }

    return {
      success: true,
      message: `I've drafted an automation rule called "${parsed.name}". Please review and adjust before saving.`,
      automation: {
        name: parsed.name,
        description: parsed.description,
        triggerTiming: parsed.triggerTiming || 'before',
        triggerOperations: parsed.triggerOperations || ['create'],
        condition: parsed.condition,
        actions: parsed.actions || [],
      },
      followUpQuestions: [
        'Would you like me to adjust any part of this rule?',
        'Should I add more conditions or actions?',
      ],
    };
  }

  /**
   * Handle explain rule request
   */
  private async handleExplainRule(automationId?: string): Promise<AvaAutomationResponse> {
    if (!automationId) {
      return {
        success: false,
        message: 'Please specify which automation rule you want me to explain.',
        followUpQuestions: ['Which automation rule would you like me to explain?'],
      };
    }

    try {
      const automation = await this.automationService.getAutomation(automationId);

      const explanation = this.generateRuleExplanation(automation);

      return {
        success: true,
        message: 'Here\'s an explanation of the automation rule:',
        explanation,
        followUpQuestions: [
          'Would you like me to suggest improvements to this rule?',
          'Do you want to know when this rule last ran?',
        ],
      };
    } catch {
      return {
        success: false,
        message: 'I couldn\'t find that automation rule. Please check the ID and try again.',
      };
    }
  }

  /**
   * Handle suggest rules request
   */
  private async handleSuggestRules(
    collectionId?: string,
    context?: AvaAutomationRequest['context']
  ): Promise<AvaAutomationResponse> {
    const suggestions = this.generateRuleSuggestions(collectionId, context);

    if (suggestions.length === 0) {
      return {
        success: true,
        message: 'I don\'t have enough context to suggest automation rules. Tell me more about what you\'re trying to automate.',
        followUpQuestions: [
          'What repetitive tasks would you like to automate?',
          'Are there any notifications you need sent automatically?',
          'Do you need to automatically set values based on conditions?',
        ],
      };
    }

    return {
      success: true,
      message: 'Here are some automation rules I suggest for your collection:',
      suggestions,
      followUpQuestions: [
        'Would you like me to create any of these rules?',
        'Do you have other automation ideas you\'d like to explore?',
      ],
    };
  }

  /**
   * Handle list rules request
   */
  private async handleListRules(collectionId?: string): Promise<AvaAutomationResponse> {
    if (!collectionId) {
      return {
        success: false,
        message: 'Please select a collection to see its automation rules.',
        followUpQuestions: ['Which collection\'s automation rules would you like to see?'],
      };
    }

    try {
      const automations = await this.automationService.getAutomationsForCollection(collectionId, true);

      if (automations.length === 0) {
        return {
          success: true,
          message: 'This collection doesn\'t have any automation rules yet.',
          followUpQuestions: [
            'Would you like me to suggest some automation rules?',
            'Do you want to create a new automation rule?',
          ],
        };
      }

      const ruleList = automations.map((a) => {
        const status = a.isActive ? 'Active' : 'Inactive';
        return `- **${a.name}** (${status}): ${a.description ?? 'No description'}`;
      }).join('\n');

      return {
        success: true,
        message: `Here are the automation rules for this collection:\n\n${ruleList}`,
        followUpQuestions: [
          'Would you like me to explain any of these rules?',
          'Do you want to create a new automation rule?',
        ],
      };
    } catch (error) {
      return {
        success: false,
        message: 'I couldn\'t retrieve the automation rules. Please try again.',
      };
    }
  }

  /**
   * Handle debug rule request
   */
  private async handleDebugRule(
    automationId?: string,
    _message?: string,
  ): Promise<AvaAutomationResponse> {
    if (!automationId) {
      return {
        success: false,
        message: 'Please specify which automation rule you\'d like to debug.',
        followUpQuestions: ['Which automation rule is not working as expected?'],
      };
    }

    try {
      const automation = await this.automationService.getAutomation(automationId);

      const debugInfo: string[] = [];

      // Check if rule is active
      if (!automation.isActive) {
        debugInfo.push('The rule is currently **inactive**. Enable it to start processing.');
      }

      // Check for condition issues
      if (automation.conditionType === 'condition' && !automation.condition) {
        debugInfo.push('The rule has a condition type set but no condition is defined.');
      }

      // Check for action issues
      if (!automation.actions || automation.actions.length === 0) {
        debugInfo.push('The rule has **no actions** defined. Add actions for the rule to do something.');
      }

      // Check consecutive errors
      if (automation.consecutiveErrors && automation.consecutiveErrors > 0) {
        debugInfo.push(`The rule has encountered **${automation.consecutiveErrors} consecutive errors**.`);
      }

      if (debugInfo.length === 0) {
        debugInfo.push('The rule configuration looks correct. The issue might be in the condition logic.');
        debugInfo.push('Check if the condition is matching the records you expect.');
      }

      return {
        success: true,
        message: 'Here\'s what I found while debugging the rule:',
        explanation: debugInfo.join('\n\n'),
        followUpQuestions: [
          'Would you like me to explain the condition logic?',
          'Do you want to see the execution history for this rule?',
        ],
      };
    } catch {
      return {
        success: false,
        message: 'I couldn\'t find that automation rule. Please check the ID and try again.',
      };
    }
  }

  /**
   * Parse rule configuration from natural language
   */
  private parseRuleFromMessage(
    message: string,
    context?: AvaAutomationRequest['context']
  ): Partial<{
    name: string;
    description: string;
    triggerTiming: string;
    triggerOperations: string[];
    condition: Record<string, unknown>;
    actions: Array<{ type: string; config: Record<string, unknown> }>;
  }> {
    const lowerMessage = message.toLowerCase();
    const result: ReturnType<typeof this.parseRuleFromMessage> = {
      triggerTiming: 'after',
      triggerOperations: [],
      actions: [],
    };

    // Parse trigger operations
    if (lowerMessage.includes('created') || lowerMessage.includes('insert') || lowerMessage.includes('new')) {
      result.triggerOperations!.push('insert');
    }
    if (lowerMessage.includes('updated') || lowerMessage.includes('modified') || lowerMessage.includes('changed')) {
      result.triggerOperations!.push('update');
    }
    if (lowerMessage.includes('deleted') || lowerMessage.includes('removed')) {
      result.triggerOperations!.push('delete');
    }

    if (result.triggerOperations!.length === 0) {
      result.triggerOperations = ['insert', 'update'];
    }

    // Parse timing
    if (lowerMessage.includes('before')) {
      result.triggerTiming = 'before';
    }

    // Parse conditions (simple pattern matching)
    const conditionPatterns = [
      /when\s+(\w+)\s+(is|equals|=)\s+["']?([^"']+)["']?/i,
      /if\s+(\w+)\s+(is|equals|=)\s+["']?([^"']+)["']?/i,
    ];

    for (const pattern of conditionPatterns) {
      const match = message.match(pattern);
      if (match) {
        const [, property, , value] = match;
        const propertyCode = this.findPropertyCode(property, context?.properties);
        if (propertyCode) {
          result.condition = {
            id: `cond_${Date.now()}`,
            operator: 'and',
            conditions: [{
              id: `rule_${Date.now()}`,
              property: propertyCode,
              operator: 'equals',
              value: value.trim(),
            }],
          };
        }
        break;
      }
    }

    // Parse actions
    const setValuePatterns = [
      /set\s+(\w+)\s+to\s+["']?([^"']+)["']?/i,
      /assign\s+(\w+)\s+to\s+["']?([^"']+)["']?/i,
    ];

    for (const pattern of setValuePatterns) {
      const match = message.match(pattern);
      if (match) {
        const [, property, value] = match;
        const propertyCode = this.findPropertyCode(property, context?.properties);
        if (propertyCode) {
          result.actions!.push({
            type: 'set_value',
            config: { property: propertyCode, value: value.trim() },
          });
        }
        break;
      }
    }

    // Generate name
    const actions = result.actions!.length > 0 ? result.actions![0].type : 'action';
    const trigger = result.triggerOperations!.join('/');
    result.name = `Auto ${actions} on ${trigger}`;
    result.description = `Automatically ${actions.replace('_', ' ')} when record is ${trigger}`;

    return result;
  }

  /**
   * Find property code from label or partial match
   */
  private findPropertyCode(
    search: string,
    properties?: Array<{ code: string; label: string; type: string }>
  ): string | undefined {
    if (!properties) return undefined;

    const lowerSearch = search.toLowerCase();

    // Exact match on code
    const exactCode = properties.find((p) => p.code.toLowerCase() === lowerSearch);
    if (exactCode) return exactCode.code;

    // Exact match on label
    const exactLabel = properties.find((p) => p.label.toLowerCase() === lowerSearch);
    if (exactLabel) return exactLabel.code;

    // Partial match
    const partial = properties.find(
      (p) => p.code.toLowerCase().includes(lowerSearch) || p.label.toLowerCase().includes(lowerSearch)
    );
    if (partial) return partial.code;

    return undefined;
  }

  /**
   * Generate human-readable explanation of a rule
   */
  private generateRuleExplanation(automation: {
    name: string;
    description?: string;
    triggerTiming: string;
    isActive: boolean;
    conditionType: string;
    condition?: unknown;
    actions?: unknown[];
  }): string {
    const lines: string[] = [];

    lines.push(`**${automation.name}**`);
    if (automation.description) {
      lines.push(automation.description);
    }

    lines.push('');
    lines.push(`**Status:** ${automation.isActive ? 'Active' : 'Inactive'}`);
    lines.push(`**Trigger:** ${automation.triggerTiming} operation`);

    if (automation.conditionType === 'always') {
      lines.push('**Condition:** Always runs');
    } else if (automation.conditionType === 'condition' && automation.condition) {
      lines.push('**Condition:** Custom conditions defined');
    } else if (automation.conditionType === 'script') {
      lines.push('**Condition:** Custom script');
    }

    if (automation.actions && automation.actions.length > 0) {
      lines.push(`**Actions:** ${automation.actions.length} action(s) defined`);
    } else {
      lines.push('**Actions:** None defined');
    }

    return lines.join('\n');
  }

  /**
   * Generate rule suggestions based on collection context
   */
  private generateRuleSuggestions(
    _collectionId?: string,
    context?: AvaAutomationRequest['context']
  ): Array<{
    name: string;
    description: string;
    triggerTiming: string;
    benefit: string;
  }> {
    const suggestions: Array<{
      name: string;
      description: string;
      triggerTiming: string;
      benefit: string;
    }> = [];

    if (!context?.properties) return suggestions;

    // Check for common property patterns
    const hasStatus = context.properties.some((p) =>
      p.code.toLowerCase().includes('status') || p.label.toLowerCase().includes('status')
    );
    const hasPriority = context.properties.some((p) =>
      p.code.toLowerCase().includes('priority') || p.label.toLowerCase().includes('priority')
    );
    const hasAssigned = context.properties.some((p) =>
      p.code.toLowerCase().includes('assigned') || p.label.toLowerCase().includes('assigned')
    );
    const hasCreated = context.properties.some((p) =>
      p.code.toLowerCase().includes('created') || p.type === 'datetime'
    );

    if (hasStatus) {
      suggestions.push({
        name: 'Auto-notify on status change',
        description: 'Send notification when status changes to a specific value',
        triggerTiming: 'after',
        benefit: 'Keep stakeholders informed of important status changes',
      });
    }

    if (hasPriority) {
      suggestions.push({
        name: 'Auto-escalate high priority',
        description: 'Automatically escalate or notify when priority is set to high/critical',
        triggerTiming: 'after',
        benefit: 'Ensure urgent items get immediate attention',
      });
    }

    if (hasAssigned && hasCreated) {
      suggestions.push({
        name: 'Auto-assign new records',
        description: 'Automatically assign new records to a default user or group',
        triggerTiming: 'before',
        benefit: 'Reduce manual work and ensure nothing falls through the cracks',
      });
    }

    // Generic suggestions
    suggestions.push({
      name: 'Audit log on changes',
      description: 'Log all changes to a separate audit collection',
      triggerTiming: 'after',
      benefit: 'Maintain complete history of all changes for compliance',
    });

    return suggestions.slice(0, 4);
  }
}
