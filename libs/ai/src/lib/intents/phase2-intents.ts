/**
 * Phase 2: AVA Intents for Schema & Views
 *
 * Defines intent categories and handlers for schema design,
 * formula assistance, view configuration, and data modeling.
 */

export enum Phase2IntentCategory {
  // Schema Design
  DESIGN_COLLECTION = 'design_collection',
  RECOMMEND_PROPERTIES = 'recommend_properties',
  SUGGEST_RELATIONSHIPS = 'suggest_relationships',
  VALIDATE_SCHEMA = 'validate_schema',

  // Formula Assistance
  CREATE_FORMULA = 'create_formula',
  DEBUG_FORMULA = 'debug_formula',
  EXPLAIN_FORMULA = 'explain_formula',
  OPTIMIZE_FORMULA = 'optimize_formula',

  // View Configuration
  CREATE_VIEW = 'create_view',
  CONFIGURE_FILTERS = 'configure_filters',
  SETUP_AGGREGATIONS = 'setup_aggregations',
  DESIGN_LAYOUT = 'design_layout',

  // Form Building
  CREATE_FORM = 'create_form',
  ADD_CONDITIONAL_LOGIC = 'add_conditional_logic',
  CONFIGURE_VALIDATION = 'configure_validation',

  // Data Modeling
  MODEL_PROCESS_FLOW = 'model_process_flow',
  DESIGN_HIERARCHY = 'design_hierarchy',
  SETUP_ROLLUPS = 'setup_rollups',

  // Migration & Schema Changes
  MIGRATE_SCHEMA = 'migrate_schema',
  ASSESS_IMPACT = 'assess_impact',
  SUGGEST_MIGRATION = 'suggest_migration',

  // Schema Queries
  QUERY_SCHEMA = 'query_schema',
  EXPLAIN_PROPERTY = 'explain_property',
}

export interface IntentMatch {
  category: Phase2IntentCategory;
  confidence: number;
  entities: Record<string, unknown>;
  originalQuery: string;
}

export interface FormulaIntent {
  description: string;
  context: {
    collectionId?: string;
    availableProperties: string[];
    currentFormula?: string;
  };
}

export interface FormulaResult {
  formula: string;
  explanation: string;
  resultType: 'text' | 'number' | 'boolean' | 'date';
  dependencies: string[];
  cacheStrategy: 'on_save' | 'periodic' | 'never';
  cacheTtl?: number;
  examples?: Array<{ input: string; output: string }>;
  alternatives?: FormulaResult[];
}

export interface SchemaDesignIntent {
  purpose: string;
  domain?: string;
  existingCollections?: string[];
}

export interface SchemaRecommendation {
  name: string;
  displayName: string;
  description: string;
  properties: PropertyRecommendation[];
  relationships: RelationshipRecommendation[];
  explanation: string;
}

export interface PropertyRecommendation {
  name: string;
  displayName: string;
  type: string;
  typeConfig?: Record<string, unknown>;
  required: boolean;
  indexed: boolean;
  description: string;
  confidence: number;
}

export interface RelationshipRecommendation {
  type: 'belongs_to' | 'has_many' | 'has_one' | 'many_to_many';
  targetCollection: string;
  property: string;
  description: string;
}

export interface ViewDesignIntent {
  purpose: string;
  collectionId: string;
  preferredType?: 'list' | 'kanban' | 'calendar' | 'timeline' | 'map' | 'pivot';
}

export interface ViewRecommendation {
  name: string;
  type: string;
  config: Record<string, unknown>;
  filters: Record<string, unknown>;
  sorting: Array<{ field: string; direction: 'asc' | 'desc' }>;
  conditionalFormatting?: Array<Record<string, unknown>>;
  aggregations?: Array<Record<string, unknown>>;
  explanation: string;
}

export interface ImpactAssessment {
  breakingChanges: boolean;
  affectedRecords: number;
  affectedProperties: Array<{
    property: string;
    type: string;
    issue: string;
  }>;
  affectedViews: Array<{
    view: string;
    type: string;
    issue: string;
  }>;
  affectedValidation: Array<{
    type: string;
    issue: string;
  }>;
  dataLoss: boolean;
  migrationStrategy: {
    recommended: string;
    alternatives: Array<{
      approach: string;
      description: string;
      pros: string[];
      cons: string[];
    }>;
  };
}

/**
 * Intent patterns for natural language matching
 */
export const INTENT_PATTERNS: Record<Phase2IntentCategory, RegExp[]> = {
  [Phase2IntentCategory.DESIGN_COLLECTION]: [
    /create (?:a )?(?:new )?collection (?:for|to) (.+)/i,
    /help (?:me )?(?:design|create) (?:a )?(.+) (?:collection|table)/i,
    /i need (?:a )?(?:collection|table) (?:for|to) (.+)/i,
  ],
  [Phase2IntentCategory.RECOMMEND_PROPERTIES]: [
    /add (?:a )?property (?:for|to) (.+)/i,
    /what properties (?:should|do) i need for (.+)/i,
    /recommend properties for (.+)/i,
    /how should i store (.+)/i,
  ],
  [Phase2IntentCategory.SUGGEST_RELATIONSHIPS]: [
    /how (?:should|do) (.+) (?:relate|connect) to (.+)/i,
    /what relationships (?:should|do) (.+) have/i,
    /link (.+) to (.+)/i,
  ],
  [Phase2IntentCategory.VALIDATE_SCHEMA]: [
    /validate (?:the )?schema/i,
    /check (?:the )?schema (?:for )?(.+)/i,
    /is (?:the|my) schema (?:correct|valid)/i,
  ],
  [Phase2IntentCategory.CREATE_FORMULA]: [
    /create (?:a )?formula (?:to|that|for) (.+)/i,
    /calculate (.+)/i,
    /formula for (.+)/i,
    /how (?:do i|can i|to) calculate (.+)/i,
  ],
  [Phase2IntentCategory.DEBUG_FORMULA]: [
    /debug (?:this )?formula[:\s]*(.+)/i,
    /(?:what's|what is) wrong with (?:this )?formula[:\s]*(.+)/i,
    /fix (?:this )?formula[:\s]*(.+)/i,
    /formula (?:error|not working)[:\s]*(.+)/i,
  ],
  [Phase2IntentCategory.EXPLAIN_FORMULA]: [
    /explain (?:this )?formula[:\s]*(.+)/i,
    /(?:what|how) does (?:this )?formula (?:do|work)[:\s]*(.+)/i,
    /understand (?:this )?formula[:\s]*(.+)/i,
  ],
  [Phase2IntentCategory.OPTIMIZE_FORMULA]: [
    /optimize (?:this )?formula[:\s]*(.+)/i,
    /(?:make|improve) (?:this )?formula faster[:\s]*(.+)/i,
    /formula (?:is )?(?:slow|performance)[:\s]*(.+)/i,
  ],
  [Phase2IntentCategory.CREATE_VIEW]: [
    /create (?:a )?(?:new )?view (?:to|for|that) (.+)/i,
    /show (?:me )?(.+) (?:on )?(?:a )?(?:map|board|calendar|timeline)/i,
    /i need (?:a )?view (?:to|for) (.+)/i,
  ],
  [Phase2IntentCategory.CONFIGURE_FILTERS]: [
    /filter (?:by|for) (.+)/i,
    /add (?:a )?filter (?:for|to) (.+)/i,
    /show only (.+)/i,
  ],
  [Phase2IntentCategory.SETUP_AGGREGATIONS]: [
    /aggregate (.+) by (.+)/i,
    /(?:sum|count|average|total) (?:of )?(.+)/i,
    /group (.+) by (.+)/i,
  ],
  [Phase2IntentCategory.DESIGN_LAYOUT]: [
    /design (?:a )?layout for (.+)/i,
    /arrange (?:the )?columns/i,
    /customize (?:the )?view layout/i,
  ],
  [Phase2IntentCategory.CREATE_FORM]: [
    /create (?:a )?form (?:for|to) (.+)/i,
    /build (?:a )?form/i,
    /design (?:a )?form (?:for|to) (.+)/i,
  ],
  [Phase2IntentCategory.ADD_CONDITIONAL_LOGIC]: [
    /add conditional (?:logic|visibility)/i,
    /show (.+) when (.+)/i,
    /hide (.+) (?:if|when|unless) (.+)/i,
  ],
  [Phase2IntentCategory.CONFIGURE_VALIDATION]: [
    /add validation (?:for|to) (.+)/i,
    /validate (?:that )?(.+)/i,
    /require (.+) (?:when|if) (.+)/i,
  ],
  [Phase2IntentCategory.MODEL_PROCESS_FLOW]: [
    /model (?:a )?(?:process flow|flow) (?:for|to) (.+)/i,
    /create (?:a )?(?:state|status) (?:machine|flow) for (.+)/i,
  ],
  [Phase2IntentCategory.DESIGN_HIERARCHY]: [
    /create (?:a )?hierarchy (?:for|of) (.+)/i,
    /(?:make|set up) (.+) hierarchical/i,
    /parent.?child (?:relationship|structure) for (.+)/i,
  ],
  [Phase2IntentCategory.SETUP_ROLLUPS]: [
    /(?:roll up|rollup|aggregate) (.+) from (.+)/i,
    /(?:sum|count|calculate) (.+) from (?:child|related) records/i,
  ],
  [Phase2IntentCategory.MIGRATE_SCHEMA]: [
    /migrate (?:from )?(.+)/i,
    /import (?:from )?(.+)/i,
    /convert (?:from )?(.+)/i,
  ],
  [Phase2IntentCategory.ASSESS_IMPACT]: [
    /(?:what|how) (?:will|would) (?:happen|change) if (?:i )?(.+)/i,
    /impact (?:of )?(?:changing|removing|updating) (.+)/i,
    /assess (?:the )?impact/i,
  ],
  [Phase2IntentCategory.SUGGEST_MIGRATION]: [
    /help (?:me )?migrate/i,
    /migration (?:plan|strategy|guide)/i,
    /how (?:do i|to|can i) migrate/i,
  ],
  [Phase2IntentCategory.QUERY_SCHEMA]: [
    /(?:what|which) (?:collections|properties|fields) (.+)/i,
    /show (?:me )?(?:all )?(.+) (?:collections|properties)/i,
    /(?:list|find) (?:collections|properties) (?:with|that|where) (.+)/i,
  ],
  [Phase2IntentCategory.EXPLAIN_PROPERTY]: [
    /explain (?:the )?property (.+)/i,
    /(?:what|how) does (?:the )?property (.+) (?:do|work)/i,
    /tell me about (?:the )?(.+) property/i,
  ],
};

/**
 * Match a user query against known intent patterns
 */
export function matchIntent(query: string): IntentMatch | null {
  for (const [category, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          category: category as Phase2IntentCategory,
          confidence: 0.85,
          entities: extractEntities(category as Phase2IntentCategory, match),
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
function extractEntities(
  category: Phase2IntentCategory,
  match: RegExpMatchArray
): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  switch (category) {
    case Phase2IntentCategory.DESIGN_COLLECTION:
    case Phase2IntentCategory.RECOMMEND_PROPERTIES:
      entities['purpose'] = match[1]?.trim();
      break;

    case Phase2IntentCategory.SUGGEST_RELATIONSHIPS:
      entities['sourceCollection'] = match[1]?.trim();
      entities['targetCollection'] = match[2]?.trim();
      break;

    case Phase2IntentCategory.CREATE_FORMULA:
    case Phase2IntentCategory.DEBUG_FORMULA:
    case Phase2IntentCategory.EXPLAIN_FORMULA:
    case Phase2IntentCategory.OPTIMIZE_FORMULA:
      entities['formula'] = match[1]?.trim();
      break;

    case Phase2IntentCategory.CREATE_VIEW:
      entities['viewPurpose'] = match[1]?.trim();
      break;

    case Phase2IntentCategory.CONFIGURE_FILTERS:
    case Phase2IntentCategory.SETUP_AGGREGATIONS:
      entities['field'] = match[1]?.trim();
      entities['groupBy'] = match[2]?.trim();
      break;

    case Phase2IntentCategory.ADD_CONDITIONAL_LOGIC:
      entities['targetField'] = match[1]?.trim();
      entities['condition'] = match[2]?.trim();
      break;

    case Phase2IntentCategory.ASSESS_IMPACT:
      entities['proposedChange'] = match[1]?.trim();
      break;

    default:
      if (match[1]) {
        entities['subject'] = match[1].trim();
      }
  }

  return entities;
}
