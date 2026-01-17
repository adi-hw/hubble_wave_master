/**
 * Phase 1: AVA Intents for Core Platform
 *
 * Defines intent categories and handlers for navigation,
 * record operations, view management, and help/guidance.
 */

export enum Phase1IntentCategory {
  // Navigation Intents
  NAVIGATE = 'navigate',
  SEARCH = 'search',
  FIND = 'find',

  // Collection Management
  CREATE_COLLECTION = 'create_collection',
  MODIFY_COLLECTION = 'modify_collection',
  EXPLAIN_COLLECTION = 'explain_collection',

  // Record Operations
  CREATE_RECORD = 'create_record',
  UPDATE_RECORD = 'update_record',
  DELETE_RECORD = 'delete_record',
  FIND_RECORDS = 'find_records',
  BULK_OPERATIONS = 'bulk_operations',

  // View Management
  CREATE_VIEW = 'create_view',
  SWITCH_VIEW = 'switch_view',
  FILTER_DATA = 'filter_data',
  SORT_DATA = 'sort_data',

  // User Management
  FIND_USER = 'find_user',
  CHECK_PERMISSIONS = 'check_permissions',
  DELEGATE_ACCESS = 'delegate_access',

  // Help & Guidance
  EXPLAIN_FEATURE = 'explain_feature',
  TROUBLESHOOT = 'troubleshoot',
  SUGGEST_ACTION = 'suggest_action',

  // System
  SETTINGS = 'settings',
  PROFILE = 'profile',
  LOGOUT = 'logout',
}

export interface AvaContext {
  user: {
    id: string;
    name: string;
    roles: string[];
    permissions: string[];
    preferences: Record<string, unknown>;
    timezone: string;
    language: string;
  };

  location: {
    route: string;
    collection?: string;
    record?: string;
    view?: string;
  };

  selection: {
    records?: string[];
    properties?: string[];
  };

  form?: {
    collection: string;
    mode: 'create' | 'edit';
    values: Record<string, unknown>;
    errors: Record<string, string>;
  };

  history: {
    recentCollections: string[];
    recentRecords: Array<{ collection: string; id: string }>;
    recentSearches: string[];
    recentActions: Array<{ type: string; timestamp: Date }>;
  };

  instance: {
    customCollections: string[];
    customTerminology: Record<string, string>;
    businessRules: string[];
  };
}

export interface IntentMatch {
  category: Phase1IntentCategory;
  confidence: number;
  entities: Record<string, unknown>;
  originalQuery: string;
}

export interface NavigateAction {
  type: 'navigate';
  route: string;
  params?: Record<string, string>;
}

export interface FilterAction {
  type: 'navigate_with_filter';
  route: string;
  filter: Record<string, unknown>;
}

export interface GuideAction {
  type: 'guide';
  steps: Array<{
    instruction: string;
    route?: string;
    highlight?: string;
  }>;
}

export interface CreateFormAction {
  type: 'open_create_form';
  collection: string;
  prefill?: Record<string, unknown>;
}

export interface UpdateRecordAction {
  type: 'update_record';
  collection: string;
  recordId: string;
  updates: Record<string, unknown>;
}

export interface BulkUpdateAction {
  type: 'bulk_update';
  preview: boolean;
  collection: string;
  filter: Record<string, unknown>;
  updates: Record<string, unknown>;
}

export interface SaveViewAction {
  type: 'save_view';
  name: string;
  visibility: 'personal' | 'team' | 'global';
  inheritCurrentFilters: boolean;
}

export interface ApplyFilterAction {
  type: 'apply_filter';
  collection: string;
  filter: {
    operator: 'and' | 'or';
    conditions: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
  };
}

export type AvaAction =
  | NavigateAction
  | FilterAction
  | GuideAction
  | CreateFormAction
  | UpdateRecordAction
  | BulkUpdateAction
  | SaveViewAction
  | ApplyFilterAction;

export interface AvaResponse {
  intent: Phase1IntentCategory;
  entities: Record<string, unknown>;
  action?: AvaAction;
  confirmation?: string;
  response: string;
}

/**
 * Intent patterns for natural language matching
 */
export const PHASE1_INTENT_PATTERNS: Record<Phase1IntentCategory, RegExp[]> = {
  [Phase1IntentCategory.NAVIGATE]: [
    /(?:take|go|navigate|open|show) (?:me )?(?:to )?(.+)/i,
    /(?:go to|open) (.+)/i,
  ],
  [Phase1IntentCategory.SEARCH]: [
    /search (?:for )?(.+)/i,
    /find (.+)/i,
    /look for (.+)/i,
  ],
  [Phase1IntentCategory.FIND]: [
    /where (?:can i|do i|is) (.+)/i,
    /how (?:do i|can i) (?:find|get to) (.+)/i,
  ],
  [Phase1IntentCategory.CREATE_COLLECTION]: [
    /create (?:a )?(?:new )?collection (?:to|for|called) (.+)/i,
    /(?:make|build) (?:a )?collection (?:for|to) (.+)/i,
  ],
  [Phase1IntentCategory.MODIFY_COLLECTION]: [
    /(?:modify|change|update|edit) (?:the )?collection (.+)/i,
    /add (?:a )?property to (.+)/i,
  ],
  [Phase1IntentCategory.EXPLAIN_COLLECTION]: [
    /(?:explain|describe|what is) (?:the )?(.+) collection/i,
    /tell me about (?:the )?(.+) collection/i,
  ],
  [Phase1IntentCategory.CREATE_RECORD]: [
    /create (?:a )?(?:new )?(.+)/i,
    /(?:make|add) (?:a )?(?:new )?(.+)/i,
  ],
  [Phase1IntentCategory.UPDATE_RECORD]: [
    /(?:update|change|modify|set) (?:the )?(.+) (?:of|for) (.+)/i,
    /change (.+) to (.+)/i,
  ],
  [Phase1IntentCategory.DELETE_RECORD]: [
    /delete (?:the )?(.+)/i,
    /remove (?:the )?(.+)/i,
  ],
  [Phase1IntentCategory.FIND_RECORDS]: [
    /show (?:me )?(?:all )?(?:my )?(.+)/i,
    /(?:list|display) (?:all )?(?:my )?(.+)/i,
  ],
  [Phase1IntentCategory.BULK_OPERATIONS]: [
    /(?:update|change|modify) (?:all )?(.+) (?:where|that|with) (.+)/i,
    /bulk (?:update|edit) (.+)/i,
  ],
  [Phase1IntentCategory.CREATE_VIEW]: [
    /(?:save|create) (?:this )?(?:as )?(?:a )?view (?:called|named) (.+)/i,
    /save (?:this|current) (?:as )?(.+) view/i,
  ],
  [Phase1IntentCategory.SWITCH_VIEW]: [
    /switch to (?:the )?(.+) view/i,
    /show (?:me )?(?:the )?(.+) view/i,
  ],
  [Phase1IntentCategory.FILTER_DATA]: [
    /filter (?:by )?(.+)/i,
    /show only (.+)/i,
    /(?:where|with) (.+) (?:is|equals|=) (.+)/i,
  ],
  [Phase1IntentCategory.SORT_DATA]: [
    /sort (?:by )?(.+)/i,
    /order by (.+)/i,
  ],
  [Phase1IntentCategory.FIND_USER]: [
    /find (?:user )?(.+)/i,
    /who is (.+)/i,
  ],
  [Phase1IntentCategory.CHECK_PERMISSIONS]: [
    /(?:can i|do i have permission to) (.+)/i,
    /what (?:can i|permissions do i have)/i,
  ],
  [Phase1IntentCategory.DELEGATE_ACCESS]: [
    /(?:grant|give) (.+) access to (.+)/i,
    /share (.+) with (.+)/i,
  ],
  [Phase1IntentCategory.EXPLAIN_FEATURE]: [
    /(?:explain|what is|how does) (.+) (?:work|mean)/i,
    /tell me about (.+)/i,
  ],
  [Phase1IntentCategory.TROUBLESHOOT]: [
    /(?:what's wrong|help|fix) (.+)/i,
    /why (?:can't i|isn't|doesn't) (.+)/i,
  ],
  [Phase1IntentCategory.SUGGEST_ACTION]: [
    /what (?:should|can) i do/i,
    /suggest (.+)/i,
  ],
  [Phase1IntentCategory.SETTINGS]: [
    /(?:open|go to|show) settings/i,
    /(?:change|update) (?:my )?settings/i,
  ],
  [Phase1IntentCategory.PROFILE]: [
    /(?:open|go to|show) (?:my )?profile/i,
    /(?:view|edit) (?:my )?profile/i,
  ],
  [Phase1IntentCategory.LOGOUT]: [
    /(?:log|sign) ?out/i,
    /(?:exit|leave)/i,
  ],
};

/**
 * Match a user query against Phase 1 intent patterns
 */
export function matchPhase1Intent(query: string): IntentMatch | null {
  for (const [category, patterns] of Object.entries(PHASE1_INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          category: category as Phase1IntentCategory,
          confidence: 0.85,
          entities: extractPhase1Entities(category as Phase1IntentCategory, match),
          originalQuery: query,
        };
      }
    }
  }
  return null;
}

/**
 * Extract entities from a regex match based on intent category
 */
function extractPhase1Entities(
  category: Phase1IntentCategory,
  match: RegExpMatchArray
): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  switch (category) {
    case Phase1IntentCategory.NAVIGATE:
    case Phase1IntentCategory.SEARCH:
    case Phase1IntentCategory.FIND:
      entities['destination'] = match[1]?.trim();
      break;

    case Phase1IntentCategory.CREATE_COLLECTION:
    case Phase1IntentCategory.MODIFY_COLLECTION:
    case Phase1IntentCategory.EXPLAIN_COLLECTION:
      entities['collection'] = match[1]?.trim();
      break;

    case Phase1IntentCategory.CREATE_RECORD:
    case Phase1IntentCategory.DELETE_RECORD:
    case Phase1IntentCategory.FIND_RECORDS:
      entities['recordType'] = match[1]?.trim();
      break;

    case Phase1IntentCategory.UPDATE_RECORD:
      entities['field'] = match[1]?.trim();
      entities['record'] = match[2]?.trim();
      break;

    case Phase1IntentCategory.BULK_OPERATIONS:
      entities['recordType'] = match[1]?.trim();
      entities['condition'] = match[2]?.trim();
      break;

    case Phase1IntentCategory.FILTER_DATA:
      entities['filter'] = match[1]?.trim();
      if (match[2]) {
        entities['value'] = match[2].trim();
      }
      break;

    case Phase1IntentCategory.SORT_DATA:
      entities['sortField'] = match[1]?.trim();
      break;

    case Phase1IntentCategory.CREATE_VIEW:
    case Phase1IntentCategory.SWITCH_VIEW:
      entities['viewName'] = match[1]?.trim();
      break;

    case Phase1IntentCategory.DELEGATE_ACCESS:
      entities['user'] = match[1]?.trim();
      entities['resource'] = match[2]?.trim();
      break;

    default:
      if (match[1]) {
        entities['subject'] = match[1].trim();
      }
  }

  return entities;
}

/**
 * Response templates for AVA
 */
export const AvaResponseTemplates = {
  greeting: {
    morning: "Good morning! How can I help you today?",
    afternoon: "Good afternoon! What would you like to do?",
    evening: "Good evening! I'm here to help.",
    returning: "Welcome back, {{userName}}! Pick up where you left off?",
  },

  confirmation: {
    success: "Done! {{actionDescription}}",
    created: "Created {{itemType}} successfully. Would you like to {{nextAction}}?",
    updated: "Updated {{itemType}}. The changes are saved.",
    deleted: "Deleted {{itemType}}. This action cannot be undone.",
  },

  clarification: {
    ambiguous: "I found multiple matches for '{{term}}'. Did you mean:\n{{options}}",
    missing: "I need more information. {{missingField}}?",
    confirm: "Just to confirm: You want to {{action}}. Is that correct?",
  },

  error: {
    notFound: "I couldn't find {{item}}. Try a different search term?",
    noPermission: "You don't have permission to {{action}}. Contact your admin for access.",
    invalid: "That's not quite right. {{explanation}}",
    unknown: "Something went wrong. Let me try a different approach.",
  },

  guidance: {
    howTo: "Here's how to {{action}}:\n{{steps}}",
    tip: "Pro tip: {{tip}}",
    shortcut: "Quick shortcut: {{shortcut}}",
  },

  suggestion: {
    proactive: "Based on your recent activity, would you like to {{suggestion}}?",
    efficiency: "You could save time by {{suggestion}}",
    explore: "Have you tried {{feature}}? It might help with {{useCase}}.",
  },
};
