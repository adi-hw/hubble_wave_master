# Phase 2: AVA Integration - Schema & Views

## AVA for Schema & Views

Phase 2 expands AVA's capabilities to assist with advanced schema design, formula creation, view configuration, and data modeling. AVA becomes an intelligent schema architect that helps users design complex data structures without requiring deep technical knowledge.

---

## 1. AVA Schema Design Assistance

### 1.1 Collection Creation with AVA

AVA can guide users through creating complex collections with inferred properties, relationships, and validation rules.

```typescript
// libs/ava/src/intents/phase2-intents.ts

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
  MODEL_WORKFLOW = 'model_workflow',
  DESIGN_HIERARCHY = 'design_hierarchy',
  SETUP_ROLLUPS = 'setup_rollups',

  // Migration & Schema Changes
  MIGRATE_SCHEMA = 'migrate_schema',
  ASSESS_IMPACT = 'assess_impact',
  SUGGEST_MIGRATION = 'suggest_migration',
}
```

### 1.2 Schema Creation Examples

```typescript
// User: "Help me create a collection for tracking customer orders"
{
  intent: 'design_collection',
  entities: {
    purpose: 'tracking customer orders',
    domain: 'e-commerce',
    inferredStructure: {
      name: 'customer_orders',
      displayName: 'Customer Orders',
      description: 'Track customer orders from placement to fulfillment',
      properties: [
        {
          name: 'customer',
          type: 'reference',
          targetCollection: 'customers',
          required: true,
          description: 'Customer who placed the order'
        },
        {
          name: 'order_number',
          type: 'text',
          unique: true,
          readonly: true,
          defaultValue: 'AUTO_INCREMENT',
          description: 'Unique order identifier'
        },
        {
          name: 'order_date',
          type: 'datetime',
          required: true,
          defaultValue: 'NOW()',
          indexed: true
        },
        {
          name: 'status',
          type: 'choice',
          choices: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
          defaultValue: 'Pending',
          required: true
        },
        {
          name: 'items',
          type: 'multi-reference',
          targetCollection: 'order_items',
          description: 'Line items in this order'
        },
        {
          name: 'total_amount',
          type: 'rollup',
          sourceCollection: 'order_items',
          sourceProperty: 'amount',
          relationshipProperty: 'order',
          aggregation: 'sum',
          description: 'Sum of all item amounts'
        },
        {
          name: 'shipping_address',
          type: 'lookup',
          sourceReference: 'customer',
          targetProperty: 'default_shipping_address'
        },
        {
          name: 'days_since_order',
          type: 'formula',
          formula: 'DATEDIFF(order_date, TODAY(), "days")',
          resultType: 'number',
          cacheStrategy: 'periodic',
          cacheTtl: 3600
        },
        {
          name: 'priority',
          type: 'formula',
          formula: 'IF(total_amount > 1000, "High", IF(total_amount > 500, "Medium", "Low"))',
          resultType: 'text',
          cacheStrategy: 'on_save'
        }
      ],
      relationships: [
        {
          type: 'belongs_to',
          targetCollection: 'customers',
          property: 'customer'
        },
        {
          type: 'has_many',
          targetCollection: 'order_items',
          foreignKey: 'order'
        }
      ]
    }
  },
  action: {
    type: 'schema_wizard',
    prefill: {
      /* inferred structure */
    }
  },
  response: `I'll help you create a Customer Orders collection! Based on typical e-commerce workflows, I recommend:

**Core Properties:**
- Customer (reference) - links to customer record
- Order Number - auto-generated unique identifier
- Order Date - when the order was placed
- Status - track order lifecycle (Pending → Delivered)

**Relationships:**
- Links to Order Items (line items)
- Links to Customer for shipping details

**Calculated Fields:**
- Total Amount - automatically sum all line items
- Days Since Order - track age of orders
- Priority - based on order value

**Additional Features:**
- Shipping Address - automatically pulled from customer
- Order tracking and history

Would you like me to create this structure? I can also add properties for payment method, shipping method, or discount codes if needed.`
}

// User: "Add a property to track estimated delivery date"
{
  intent: 'recommend_properties',
  entities: {
    purpose: 'track estimated delivery date',
    context: 'customer_orders_collection'
  },
  suggestion: {
    propertyDefinition: {
      name: 'estimated_delivery',
      displayName: 'Estimated Delivery',
      type: 'formula',
      formula: `IF(
        status == "Shipped",
        DATEADD(ship_date,
          LOOKUP(shipping_method, "delivery_days"),
          "days"
        ),
        IF(
          status == "Delivered",
          actual_delivery_date,
          DATEADD(order_date, 7, "days")
        )
      )`,
      resultType: 'date',
      cacheStrategy: 'on_save',
      dependencies: ['status', 'ship_date', 'shipping_method', 'actual_delivery_date', 'order_date']
    }
  },
  response: `I recommend adding a calculated "Estimated Delivery" property. Here's what it will do:

**Logic:**
- If order is Shipped → Ship date + shipping method delivery time
- If order is Delivered → Show actual delivery date
- Otherwise → Order date + 7 days (default estimate)

This formula automatically updates based on order status and shipping method. Should I add this property?

**Alternative Options:**
1. Simple date field (manual entry)
2. Formula with SLA-based calculation
3. Integration with shipping provider API

Which approach works best for your workflow?`
}
```

---

## 2. Formula Creation Assistance

### 2.1 Natural Language Formula Generation

AVA can convert natural language descriptions into formula syntax with intelligent field suggestions.

```typescript
// User: "Create a formula that calculates the age of a record in days"
{
  intent: 'create_formula',
  entities: {
    calculation: 'age in days',
    context: 'current_collection'
  },
  generatedFormula: {
    formula: 'DATEDIFF(created_at, TODAY(), "days")',
    explanation: 'Calculates the number of days between record creation and today',
    dependencies: ['created_at'],
    resultType: 'number',
    cacheStrategy: 'periodic',
    cacheTtl: 86400, // 24 hours
  },
  response: `Here's a formula to calculate record age in days:

\`\`\`
DATEDIFF(created_at, TODAY(), "days")
\`\`\`

**How it works:**
- Takes the record's creation date
- Compares it to today's date
- Returns the difference in days

**Performance:** This formula recalculates daily (cached for 24 hours).

**Usage Example:**
- Records created yesterday: 1 day
- Records created last week: 7 days
- Today's records: 0 days

Would you like me to add this formula? I can also create variations for:
- Age in hours
- Age in weeks
- Business days only (excluding weekends)`
}

// User: "Formula to calculate discount based on order total"
{
  intent: 'create_formula',
  entities: {
    calculation: 'discount based on order total',
    context: 'customer_orders'
  },
  generatedFormula: {
    formula: `SWITCH(
      TRUE,
      total_amount >= 1000, total_amount * 0.15,
      total_amount >= 500, total_amount * 0.10,
      total_amount >= 250, total_amount * 0.05,
      0
    )`,
    explanation: 'Tiered discount: 15% for $1000+, 10% for $500+, 5% for $250+',
    dependencies: ['total_amount'],
    resultType: 'number',
    cacheStrategy: 'on_save'
  },
  response: `I've created a tiered discount formula:

\`\`\`
SWITCH(
  TRUE,
  total_amount >= 1000, total_amount * 0.15,
  total_amount >= 500, total_amount * 0.10,
  total_amount >= 250, total_amount * 0.05,
  0
)
\`\`\`

**Discount Tiers:**
- Orders $1000+: 15% discount
- Orders $500-999: 10% discount
- Orders $250-499: 5% discount
- Orders under $250: No discount

**Example Calculations:**
- $1200 order → $180 discount (15%)
- $600 order → $60 discount (10%)
- $300 order → $15 discount (5%)
- $100 order → $0 discount

Want me to:
- Adjust the tiers or percentages?
- Add additional conditions (customer tier, product category)?
- Create a companion formula for final price after discount?`
}

// User: "Debug this formula: DATEDIFF(due_date, created_at)"
{
  intent: 'debug_formula',
  entities: {
    formula: 'DATEDIFF(due_date, created_at)',
    error: 'Missing required parameter'
  },
  analysis: {
    issue: 'DATEDIFF requires 3 parameters: date1, date2, unit',
    missingParameters: ['unit'],
    suggestion: 'DATEDIFF(due_date, created_at, "days")'
  },
  response: `I found the issue! The DATEDIFF function requires 3 parameters:

**Current formula:**
\`\`\`
DATEDIFF(due_date, created_at)
\`\`\`

**Missing:** The third parameter specifying the time unit.

**Corrected formula:**
\`\`\`
DATEDIFF(due_date, created_at, "days")
\`\`\`

**Available units:**
- "days" - difference in days
- "months" - difference in months
- "years" - difference in years

**Note:** This calculates due_date minus created_at. If you want a positive number for overdue items, use:
\`\`\`
DATEDIFF(created_at, due_date, "days")
\`\`\`

Which version would you like to use?`
}
```

### 2.2 Formula Builder UI Integration

```tsx
// apps/web-client/src/components/schema/FormulaEditor.tsx

interface FormulaEditorProps {
  value: string;
  schema: CollectionSchema;
  onChange: (formula: string) => void;
}

export function FormulaEditor({ value, schema, onChange }: FormulaEditorProps) {
  const [avaAssistOpen, setAvaAssistOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<FormulaSuggestion | null>(null);

  const handleAvaAssist = async (naturalLanguage: string) => {
    const response = await avaService.createFormula({
      description: naturalLanguage,
      context: {
        collectionId: schema.id,
        availableProperties: schema.properties,
        currentFormula: value,
      },
    });

    setSuggestion(response.suggestion);
  };

  return (
    <div className="formula-editor">
      <div className="formula-editor__toolbar">
        <button
          className="formula-editor__ava-button"
          onClick={() => setAvaAssistOpen(true)}
          aria-label="Ask AVA for help"
        >
          <Icon name="sparkles" />
          Ask AVA
        </button>

        <FormulaFunctionPicker
          functions={FORMULA_FUNCTIONS}
          onSelect={(fn) => insertFunction(fn)}
        />
      </div>

      <CodeEditor
        value={value}
        language="formula"
        onChange={onChange}
        schema={schema}
        autoComplete={{
          properties: schema.properties.map(p => p.name),
          functions: FORMULA_FUNCTIONS.map(f => f.name),
        }}
      />

      {/* AVA Assistance Panel */}
      <AvaFormulaAssist
        isOpen={avaAssistOpen}
        onClose={() => setAvaAssistOpen(false)}
        onRequest={handleAvaAssist}
        suggestion={suggestion}
        onAccept={(formula) => {
          onChange(formula);
          setAvaAssistOpen(false);
        }}
      />

      {/* Validation & Preview */}
      <FormulaValidation
        formula={value}
        schema={schema}
        onValidate={(result) => {
          if (result.valid) {
            // Show preview with sample data
          } else {
            // Show errors
          }
        }}
      />
    </div>
  );
}

// AVA Formula Assistance Component
function AvaFormulaAssist({ isOpen, onClose, onRequest, suggestion, onAccept }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await onRequest(input);
    setLoading(false);
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} position="right" width="400px">
      <DrawerHeader>
        <AvaAvatar size="sm" />
        <h3>Formula Assistant</h3>
      </DrawerHeader>

      <DrawerContent>
        {!suggestion ? (
          <div className="ava-formula-assist__input">
            <p>Describe the calculation you need in plain language:</p>

            <TextArea
              value={input}
              onChange={setInput}
              placeholder="Example: Calculate the number of days between order date and delivery date"
              rows={4}
            />

            <div className="ava-formula-assist__examples">
              <p>Try asking:</p>
              <ul>
                <li>"Calculate total price with tax"</li>
                <li>"Show days until due date"</li>
                <li>"Concatenate first and last name"</li>
                <li>"Assign priority based on amount"</li>
              </ul>
            </div>

            <Button
              onClick={handleSubmit}
              loading={loading}
              disabled={!input}
              fullWidth
            >
              Generate Formula
            </Button>
          </div>
        ) : (
          <div className="ava-formula-assist__result">
            <div className="ava-formula-assist__explanation">
              <h4>Generated Formula</h4>
              <p>{suggestion.explanation}</p>
            </div>

            <CodeBlock language="formula">
              {suggestion.formula}
            </CodeBlock>

            <div className="ava-formula-assist__metadata">
              <InfoItem label="Result Type" value={suggestion.resultType} />
              <InfoItem
                label="Dependencies"
                value={suggestion.dependencies.join(', ')}
              />
              <InfoItem
                label="Cache Strategy"
                value={suggestion.cacheStrategy}
              />
            </div>

            {suggestion.examples && (
              <div className="ava-formula-assist__examples">
                <h5>Example Results</h5>
                {suggestion.examples.map((ex, i) => (
                  <div key={i} className="example">
                    <code>{ex.input}</code> → <strong>{ex.output}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="ava-formula-assist__actions">
              <Button variant="primary" onClick={() => onAccept(suggestion.formula)}>
                Use This Formula
              </Button>
              <Button variant="secondary" onClick={() => setSuggestion(null)}>
                Try Different Description
              </Button>
            </div>

            {suggestion.alternatives && (
              <div className="ava-formula-assist__alternatives">
                <h5>Alternative Approaches</h5>
                {suggestion.alternatives.map((alt, i) => (
                  <AlternativeFormula
                    key={i}
                    formula={alt}
                    onSelect={() => onAccept(alt.formula)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
```

---

## 3. View Configuration Assistance

### 3.1 Intelligent View Recommendations

```typescript
// User: "Create a view to track high priority orders"
{
  intent: 'create_view',
  entities: {
    purpose: 'track high priority orders',
    collection: 'customer_orders'
  },
  recommendation: {
    name: 'High Priority Orders',
    type: 'list',
    config: {
      type: 'list',
      columns: [
        { property: 'order_number', width: 120, pinned: true },
        { property: 'customer', width: 200 },
        { property: 'total_amount', width: 120, aggregation: 'sum' },
        { property: 'status', width: 120 },
        { property: 'order_date', width: 150 },
        { property: 'days_since_order', width: 100 }
      ],
      rowHeight: 'default',
      showTotals: true,
      enableInlineEdit: true
    },
    filters: {
      operator: 'or',
      conditions: [
        { field: 'priority', operator: 'eq', value: 'High' },
        { field: 'total_amount', operator: 'gte', value: 1000 },
        { field: 'status', operator: 'eq', value: 'Processing' }
      ]
    },
    sorting: [
      { field: 'total_amount', direction: 'desc' }
    ],
    conditionalFormatting: [
      {
        id: 'overdue',
        name: 'Overdue Orders',
        conditions: {
          operator: 'and',
          conditions: [
            { field: 'days_since_order', operator: 'gt', value: 7 },
            { field: 'status', operator: 'neq', value: 'Delivered' }
          ]
        },
        style: {
          backgroundColor: 'semantic.error.subtle',
          textColor: 'semantic.error.default',
          fontWeight: 'bold'
        },
        appliesTo: 'row'
      },
      {
        id: 'vip-customer',
        name: 'VIP Customer Orders',
        conditions: {
          operator: 'and',
          conditions: [
            { field: 'customer.tier', operator: 'eq', value: 'VIP' }
          ]
        },
        style: {
          icon: 'star',
          iconColor: 'semantic.warning.default'
        },
        appliesTo: 'row'
      }
    ],
    aggregations: [
      { property: 'total_amount', type: 'sum', label: 'Total Revenue' },
      { property: 'order_number', type: 'count', label: 'Order Count' },
      { property: 'total_amount', type: 'avg', label: 'Average Order Value' }
    ]
  },
  response: `I'll create a "High Priority Orders" view with these features:

**Filters:**
- Priority = High OR
- Total Amount ≥ $1000 OR
- Status = Processing

**Visible Columns:**
- Order Number (pinned)
- Customer
- Total Amount (with sum)
- Status
- Order Date
- Days Since Order

**Sorting:** By Total Amount (highest first)

**Conditional Formatting:**
- Highlight overdue orders (>7 days, not delivered) in red
- Show star icon for VIP customer orders

**Totals Row:**
- Total Revenue: Sum of all amounts
- Order Count: Total number of orders
- Average Order Value: Mean order size

This view will help you quickly identify urgent orders that need attention. Should I create it?

**Customization Options:**
- Add grouping by Status
- Include timeline/calendar view
- Add export to Excel option`
}

// User: "Show me orders on a map by shipping location"
{
  intent: 'create_view',
  entities: {
    viewType: 'map',
    collection: 'customer_orders',
    locationField: 'shipping_address'
  },
  recommendation: {
    name: 'Orders Map View',
    type: 'map',
    config: {
      type: 'map',
      locationProperty: 'shipping_address.coordinates',
      titleProperty: 'order_number',
      popupProperties: [
        'customer',
        'total_amount',
        'status',
        'estimated_delivery'
      ],
      clusterMarkers: true,
      mapStyle: 'standard',
      defaultZoom: 10
    },
    conditionalFormatting: [
      {
        id: 'status-colors',
        name: 'Status-based Colors',
        conditions: {
          field: 'status',
          operator: 'eq',
          value: 'Delivered'
        },
        style: { iconColor: 'semantic.success.default' },
        appliesTo: 'marker'
      },
      {
        id: 'pending-orders',
        name: 'Pending Orders',
        conditions: {
          field: 'status',
          operator: 'eq',
          value: 'Pending'
        },
        style: { iconColor: 'semantic.warning.default' },
        appliesTo: 'marker'
      }
    ]
  },
  response: `Perfect! I'll create a map view showing orders by shipping location:

**Map Features:**
- Markers clustered when zoomed out (performance optimization)
- Color-coded by delivery status:
  - Green: Delivered
  - Yellow: Pending
  - Blue: In Transit

**Marker Popup Shows:**
- Order Number
- Customer Name
- Total Amount
- Current Status
- Estimated Delivery

**Important:** This requires the shipping_address property to have geolocation data. I can help you:
1. Add geocoding to convert addresses to coordinates
2. Bulk geocode existing addresses
3. Enable real-time geocoding for new orders

Would you like me to set up geocoding first?`
}

// User: "Create a kanban board for order status"
{
  intent: 'create_view',
  entities: {
    viewType: 'kanban',
    collection: 'customer_orders',
    groupBy: 'status'
  },
  recommendation: {
    name: 'Order Status Board',
    type: 'kanban',
    config: {
      type: 'kanban',
      columnProperty: 'status',
      cardProperties: [
        'order_number',
        'customer',
        'total_amount',
        'order_date',
        'days_since_order'
      ],
      cardColorProperty: 'priority',
      wipLimits: {
        'Processing': 20,
        'Shipped': 50
      },
      showEmptyColumns: true
    },
    sorting: [
      { field: 'total_amount', direction: 'desc' }
    ]
  },
  response: `I'll create a Kanban board for managing order workflow:

**Columns (by Status):**
- Pending
- Processing (limit: 20 orders)
- Shipped (limit: 50 orders)
- Delivered
- Cancelled

**Card Information:**
- Order Number (header)
- Customer Name
- Total Amount
- Order Date
- Days Since Order

**Card Colors:** Based on priority level
- Red: High priority
- Orange: Medium priority
- Blue: Low priority

**Features:**
- Drag & drop to update status
- WIP limits to prevent bottlenecks
- Cards sorted by total amount (highest first)

**Workflow Benefits:**
- Visual pipeline management
- Identify bottlenecks quickly
- Track order progression

Ready to create this board?`
}
```

---

## 4. Property Type Recommendations

### 4.1 Intelligent Type Suggestions

```typescript
// User: "What's the best way to store customer phone numbers?"
{
  intent: 'recommend_properties',
  entities: {
    dataType: 'phone number',
    context: 'customers'
  },
  recommendations: [
    {
      approach: 'formatted_text',
      propertyConfig: {
        name: 'phone',
        type: 'text',
        validation: [
          {
            type: 'pattern',
            value: '^\\+?[1-9]\\d{1,14}$',
            message: 'Must be valid international phone number'
          }
        ],
        typeConfig: {
          format: 'phone',
          autoFormat: true,
          allowExtension: true
        }
      },
      pros: [
        'Automatic formatting (e.g., (555) 123-4567)',
        'Validation for format',
        'Click-to-call integration',
        'International format support'
      ],
      cons: [
        'Requires validation pattern',
        'May need country code handling'
      ],
      recommended: true
    },
    {
      approach: 'json_structure',
      propertyConfig: {
        name: 'phone',
        type: 'json',
        typeConfig: {
          schema: {
            countryCode: 'string',
            number: 'string',
            extension: 'string?',
            type: 'string' // mobile, work, home
          }
        }
      },
      pros: [
        'Structured data',
        'Easy to query by country',
        'Support multiple phone types'
      ],
      cons: [
        'More complex to display',
        'Requires custom UI'
      ],
      recommended: false
    }
  ],
  response: `For storing phone numbers, I recommend using a **formatted text property** with validation:

**Recommended Setup:**
\`\`\`
Property Type: Text
Format: Phone
Auto-formatting: Enabled
Pattern: International format (E.164)
\`\`\`

**Benefits:**
- Automatic formatting as user types
- Validates correct phone format
- Click-to-call functionality
- Works with international numbers
- SMS/calling integrations

**Example Display:**
- Input: 5551234567
- Formatted: (555) 123-4567
- International: +1 (555) 123-4567

**Alternative Approach:**
If you need to store multiple phone numbers per customer (mobile, work, home), I can create a related "Customer Phone Numbers" collection with proper type classification.

Which approach fits your needs better?`
}

// User: "How should I track inventory quantities?"
{
  intent: 'recommend_properties',
  entities: {
    dataType: 'inventory quantity',
    context: 'products'
  },
  recommendations: [
    {
      approach: 'calculated_rollup',
      properties: [
        {
          name: 'quantity_on_hand',
          type: 'rollup',
          sourceCollection: 'inventory_transactions',
          sourceProperty: 'quantity_change',
          aggregation: 'sum',
          filter: {
            field: 'transaction_type',
            operator: 'in',
            value: ['receipt', 'adjustment', 'sale']
          }
        },
        {
          name: 'quantity_available',
          type: 'formula',
          formula: 'quantity_on_hand - quantity_reserved',
          resultType: 'number',
          cacheStrategy: 'on_save'
        },
        {
          name: 'reorder_needed',
          type: 'formula',
          formula: 'quantity_available <= reorder_point',
          resultType: 'boolean',
          cacheStrategy: 'periodic',
          cacheTtl: 3600
        }
      ],
      pros: [
        'Audit trail through transactions',
        'Real-time accuracy',
        'Automatic calculations',
        'Historical tracking'
      ],
      recommended: true
    },
    {
      approach: 'simple_number',
      properties: [
        {
          name: 'quantity',
          type: 'number',
          validation: [
            { type: 'min', value: 0, message: 'Cannot be negative' }
          ]
        }
      ],
      pros: [
        'Simple to implement',
        'Fast queries',
        'Easy to understand'
      ],
      cons: [
        'No audit trail',
        'Manual updates required',
        'Risk of data inconsistency'
      ],
      recommended: false
    }
  ],
  response: `For inventory tracking, I recommend a **transaction-based approach** with automatic rollup calculations:

**Schema Structure:**

**Products Collection:**
- \`quantity_on_hand\` (Rollup) - Sum of all inventory transactions
- \`quantity_reserved\` (Rollup) - Sum of pending order quantities
- \`quantity_available\` (Formula) - On hand minus reserved
- \`reorder_point\` (Number) - Threshold for reordering
- \`reorder_needed\` (Formula) - Auto-flag when stock low

**Inventory Transactions Collection:**
- Product (Reference)
- Transaction Type (Receipt, Sale, Adjustment, Return)
- Quantity Change (+/-)
- Transaction Date
- Reference Number
- Notes

**Benefits:**
- Complete audit trail
- Automatic quantity calculation
- Track every stock movement
- Easy reconciliation
- Historical analysis
- Auto-reorder alerts

**Example Workflow:**
1. Receive 100 units → Transaction: +100
2. Sell 30 units → Transaction: -30
3. Quantity on hand automatically = 70

Should I create this structure for you?`
}
```

---

## 5. Migration Guidance

### 5.1 Schema Change Impact Assessment

```typescript
// User: "I want to change the 'status' property from choice to text"
{
  intent: 'assess_impact',
  entities: {
    collection: 'customer_orders',
    property: 'status',
    currentType: 'choice',
    proposedType: 'text'
  },
  impact: {
    breakingChanges: true,
    affectedRecords: 1523,
    affectedProperties: [
      {
        property: 'status_color',
        type: 'formula',
        issue: 'Formula references choice options that will no longer exist'
      },
      {
        property: 'orders_by_status',
        type: 'rollup',
        issue: 'Rollup filter uses status choice values'
      }
    ],
    affectedViews: [
      {
        view: 'Order Status Board',
        type: 'kanban',
        issue: 'Kanban board uses status as column property - requires choice type'
      },
      {
        view: 'Status Report',
        type: 'pivot',
        issue: 'Pivot table groups by status values'
      }
    ],
    affectedValidation: [
      {
        type: 'choice_constraint',
        issue: 'Current data limited to specific values - text allows any value'
      }
    ],
    dataLoss: false,
    migrationStrategy: {
      recommended: 'alternative_approach',
      alternatives: [
        {
          approach: 'Add new property',
          description: 'Keep current status as choice, add status_notes as text',
          pros: ['No breaking changes', 'Preserves existing functionality'],
          cons: ['Duplicated data concept']
        },
        {
          approach: 'Expand choices',
          description: 'Add more options to the choice list instead of converting to text',
          pros: ['Maintains data validation', 'No views break'],
          cons: ['Still limited to predefined values']
        }
      ]
    }
  },
  response: `⚠️ This change would have significant impact on your system:

**Affected Items:**
- 1,523 existing records
- 2 formulas that reference status
- 2 views (Kanban board will break)
- Data validation will be removed

**Breaking Changes:**

1. **Order Status Board (Kanban)** - Won't work anymore
   - Kanban boards require choice properties for columns
   - All cards would disappear from the board

2. **Status-based Formulas** - May break
   - \`status_color\` formula uses choice-specific logic
   - \`orders_by_status\` rollup filters by status values

3. **Data Quality Risk**
   - Current: Only allows 5 specific values
   - After change: Users can enter anything
   - Risk of typos and inconsistency

**Recommended Alternatives:**

**Option 1: Add More Choices** (Recommended)
- Keep as choice property
- Add the new status values you need
- Everything keeps working

**Option 2: Add Separate Text Property**
- Keep status as choice for workflow
- Add "status_notes" as text for additional info
- No breaking changes

**Option 3: Proceed with Conversion** (Not Recommended)
- I can guide you through migration
- Will need to recreate Kanban board
- Will need to update formulas
- Estimated migration time: 2-3 hours

Which approach would you prefer? I can help with any of these options.`
}

// User: "Help me migrate from ServiceNow to HubbleWave"
{
  intent: 'suggest_migration',
  entities: {
    source: 'ServiceNow',
    tables: ['incident', 'change_request', 'problem'],
    recordCount: 15000
  },
  migrationPlan: {
    phases: [
      {
        phase: 1,
        name: 'Schema Analysis',
        tasks: [
          'Export ServiceNow table definitions',
          'Map ServiceNow fields to HubbleWave properties',
          'Identify custom fields and business rules',
          'Document relationships and references'
        ],
        duration: '1-2 days'
      },
      {
        phase: 2,
        name: 'Schema Creation',
        tasks: [
          'Create HubbleWave collections',
          'Define properties with correct types',
          'Set up relationships',
          'Recreate business rules as formulas'
        ],
        duration: '2-3 days',
        avaAssistance: 'I can auto-generate schemas from ServiceNow exports'
      },
      {
        phase: 3,
        name: 'Data Migration',
        tasks: [
          'Export data from ServiceNow',
          'Transform data to HubbleWave format',
          'Validate data quality',
          'Import in batches',
          'Verify record counts and relationships'
        ],
        duration: '3-5 days',
        avaAssistance: 'I can validate data quality and suggest transformations'
      },
      {
        phase: 4,
        name: 'View & Form Recreation',
        tasks: [
          'Recreate key list views',
          'Build form layouts',
          'Set up filters and views',
          'Configure dashboards'
        ],
        duration: '2-3 days',
        avaAssistance: 'I can recommend optimal view configurations'
      },
      {
        phase: 5,
        name: 'Testing & Validation',
        tasks: [
          'User acceptance testing',
          'Performance validation',
          'Security review',
          'Training materials'
        ],
        duration: '1 week'
      }
    ],
    estimatedTotal: '3-4 weeks',
    risks: [
      {
        risk: 'Custom business rules',
        mitigation: 'Convert to HubbleWave formulas and workflows'
      },
      {
        risk: 'Third-party integrations',
        mitigation: 'Recreate using HubbleWave API'
      }
    ]
  },
  response: `I'll help you migrate from ServiceNow! Here's a comprehensive migration plan:

**Migration Timeline: 3-4 weeks**

**Phase 1: Schema Analysis (1-2 days)**
- Export your ServiceNow table definitions
- I'll analyze and map fields to HubbleWave
- Identify custom fields and business rules

**Phase 2: Schema Creation (2-3 days)**
- Create Collections for incident, change_request, problem
- Map ServiceNow field types to HubbleWave properties
- Convert business rules to formulas

**Key Mappings:**
| ServiceNow | HubbleWave |
|------------|------------|
| String | Text |
| Choice | Choice |
| Reference | Reference |
| Calculated | Formula |
| Related List | Multi-Reference |

**Phase 3: Data Migration (3-5 days)**
- Export ~15,000 records from ServiceNow
- Transform and validate data
- Batch import to HubbleWave
- Verify integrity

**Phase 4: Views & Forms (2-3 days)**
- Recreate list views (better than ServiceNow!)
- Build form layouts
- Set up your dashboards

**Phase 5: Testing (1 week)**
- UAT with key users
- Performance validation
- Security review

**How I Can Help:**
- Auto-generate schemas from ServiceNow exports
- Recommend optimal property types
- Validate data quality during migration
- Suggest view configurations
- Create formulas from business rules

**Next Steps:**
1. Export a sample ServiceNow table definition
2. I'll create a test collection to verify mapping
3. You review and approve
4. We proceed with full migration

Ready to start? Upload a ServiceNow table definition and I'll create the initial mapping.`
}
```

---

## 6. Natural Language Schema Queries

### 6.1 Schema Information Requests

```typescript
// User: "What collections have a reference to customers?"
{
  intent: 'schema_query',
  entities: {
    query: 'collections with customer reference',
    targetCollection: 'customers'
  },
  result: {
    collections: [
      {
        name: 'customer_orders',
        property: 'customer',
        type: 'reference',
        description: 'Order placed by customer'
      },
      {
        name: 'support_tickets',
        property: 'customer',
        type: 'reference',
        description: 'Customer who submitted ticket'
      },
      {
        name: 'invoices',
        property: 'bill_to_customer',
        type: 'reference',
        description: 'Customer being billed'
      },
      {
        name: 'customer_contacts',
        property: 'customer',
        type: 'reference',
        description: 'Associated customer record'
      }
    ],
    count: 4
  },
  response: `I found 4 collections that reference customers:

**1. Customer Orders**
   - Property: \`customer\`
   - Type: Reference
   - Purpose: Track which customer placed each order

**2. Support Tickets**
   - Property: \`customer\`
   - Type: Reference
   - Purpose: Link tickets to customer accounts

**3. Invoices**
   - Property: \`bill_to_customer\`
   - Type: Reference
   - Purpose: Associate invoices with customers

**4. Customer Contacts**
   - Property: \`customer\`
   - Type: Reference
   - Purpose: Link contact persons to customer companies

**Relationship Visualization:**
\`\`\`
Customers
    ├── Orders (1 customer → many orders)
    ├── Support Tickets (1 customer → many tickets)
    ├── Invoices (1 customer → many invoices)
    └── Contacts (1 customer → many contacts)
\`\`\`

Would you like me to:
- Show the full schema for any of these?
- Create a relationship diagram?
- Set up a dashboard showing all customer-related data?`
}

// User: "Show me all formula properties in the orders collection"
{
  intent: 'schema_query',
  entities: {
    collection: 'customer_orders',
    propertyType: 'formula'
  },
  result: {
    properties: [
      {
        name: 'total_amount',
        formula: 'SUM(order_items.amount)',
        resultType: 'number',
        description: 'Sum of all line items',
        dependencies: ['order_items.amount'],
        cacheStrategy: 'on_save'
      },
      {
        name: 'days_since_order',
        formula: 'DATEDIFF(order_date, TODAY(), "days")',
        resultType: 'number',
        description: 'Age of order in days',
        dependencies: ['order_date'],
        cacheStrategy: 'periodic',
        cacheTtl: 86400
      },
      {
        name: 'priority',
        formula: 'IF(total_amount > 1000, "High", IF(total_amount > 500, "Medium", "Low"))',
        resultType: 'text',
        description: 'Priority based on order value',
        dependencies: ['total_amount'],
        cacheStrategy: 'on_save'
      },
      {
        name: 'estimated_delivery',
        formula: 'DATEADD(ship_date, LOOKUP(shipping_method, "delivery_days"), "days")',
        resultType: 'date',
        description: 'Expected delivery date',
        dependencies: ['ship_date', 'shipping_method'],
        cacheStrategy: 'on_save'
      }
    ],
    count: 4
  },
  response: `The Customer Orders collection has 4 formula properties:

**1. total_amount** (Number)
   - \`SUM(order_items.amount)\`
   - Calculates total from all line items
   - Recalculates when order saved

**2. days_since_order** (Number)
   - \`DATEDIFF(order_date, TODAY(), "days")\`
   - Shows age of order
   - Updates daily (cached 24 hours)

**3. priority** (Text)
   - \`IF(total_amount > 1000, "High", IF(total_amount > 500, "Medium", "Low"))\`
   - Auto-assigns priority by value
   - High: $1000+, Medium: $500-999, Low: <$500

**4. estimated_delivery** (Date)
   - \`DATEADD(ship_date, LOOKUP(shipping_method, "delivery_days"), "days")\`
   - Calculates expected delivery
   - Based on shipping method timing

**Performance Notes:**
- Total Amount: Fast (calculated on save)
- Days Since Order: Cached (updates once per day)
- Priority: Fast (depends on Total Amount)
- Estimated Delivery: Fast (calculated on save)

**Dependency Chain:**
\`\`\`
order_items.amount → total_amount → priority
order_date → days_since_order
ship_date + shipping_method → estimated_delivery
\`\`\`

Need help optimizing any of these formulas?`
}
```

---

## 7. AVA Knowledge Base Updates

### 7.1 Schema Learning

```typescript
// libs/ava/src/learning/schema-learner.ts

@Injectable()
export class SchemaLearner {
  async learnFromSchema(schema: CollectionSchema): Promise<void> {
    // Extract knowledge about the collection
    const knowledge = {
      // Collection metadata
      collection: {
        name: schema.name,
        displayName: schema.displayName,
        description: schema.description,
        purpose: this.inferPurpose(schema),
        domain: this.inferDomain(schema),
        synonyms: this.generateSynonyms(schema.displayName),
      },

      // Properties
      properties: schema.properties.map(prop => ({
        name: prop.name,
        displayName: prop.displayName,
        type: prop.type,
        description: prop.description,
        commonQueries: this.generatePropertyQueries(prop),
        examples: this.generatePropertyExamples(prop),
      })),

      // Relationships
      relationships: this.extractRelationships(schema),

      // Common operations
      commonOperations: this.generateCommonOperations(schema),

      // Formula patterns
      formulaPatterns: this.extractFormulaPatterns(schema),

      // View recommendations
      viewRecommendations: this.generateViewRecommendations(schema),
    };

    // Update AVA's knowledge base
    await this.knowledgeBase.update(schema.instanceId, knowledge);
  }

  private inferPurpose(schema: CollectionSchema): string {
    // Analyze properties and structure to infer purpose
    const hasStatus = schema.properties.some(p => p.name.includes('status'));
    const hasAmount = schema.properties.some(p => p.name.includes('amount') || p.name.includes('total'));
    const hasDate = schema.properties.some(p => p.type === 'date' || p.type === 'datetime');

    if (schema.name.includes('order') && hasAmount) {
      return 'Track and manage customer orders';
    }
    if (schema.name.includes('ticket') && hasStatus) {
      return 'Manage support tickets and issues';
    }
    if (schema.name.includes('project') && hasDate) {
      return 'Plan and track projects';
    }

    return `Manage ${schema.displayName} records`;
  }

  private generateCommonOperations(schema: CollectionSchema): string[] {
    const ops = [
      `Create new ${schema.displayName}`,
      `List all ${schema.pluralLabel}`,
      `Find ${schema.displayName} by`,
    ];

    // Add property-specific queries
    const searchableProps = schema.properties.filter(p =>
      p.type === 'text' || p.type === 'number' || p.indexed
    );

    searchableProps.forEach(prop => {
      ops.push(`Search ${schema.pluralLabel} by ${prop.displayName}`);
    });

    return ops;
  }

  private extractFormulaPatterns(schema: CollectionSchema): FormulaPattern[] {
    const patterns: FormulaPattern[] = [];

    schema.properties
      .filter(p => p.type === 'formula')
      .forEach(prop => {
        const config = prop.typeConfig as FormulaPropertyConfig;

        patterns.push({
          pattern: config.formula,
          resultType: config.resultType,
          useCase: prop.description || prop.displayName,
          reusable: true,
          category: this.categorizeFormula(config.formula),
        });
      });

    return patterns;
  }
}
```

---

## 8. AVA API Endpoints for Phase 2

```typescript
// apps/svc-ava/src/app/ava/phase2/ava-schema.controller.ts

@Controller('ava/schema')
@ApiTags('AVA - Schema Assistance')
export class AvaSchemaController {
  @Post('design-collection')
  @ApiOperation({ summary: 'Get AVA help designing a collection' })
  async designCollection(@Body() dto: DesignCollectionDto): Promise<SchemaRecommendation> {
    // AVA analyzes purpose and recommends complete schema
  }

  @Post('recommend-properties')
  @ApiOperation({ summary: 'Get property recommendations' })
  async recommendProperties(@Body() dto: RecommendPropertiesDto): Promise<PropertyRecommendation[]> {
    // Suggest properties for a use case
  }

  @Post('create-formula')
  @ApiOperation({ summary: 'Generate formula from natural language' })
  async createFormula(@Body() dto: CreateFormulaDto): Promise<FormulaRecommendation> {
    // Convert description to formula syntax
  }

  @Post('debug-formula')
  @ApiOperation({ summary: 'Debug and fix formula issues' })
  async debugFormula(@Body() dto: DebugFormulaDto): Promise<FormulaDebugResult> {
    // Analyze formula errors and suggest fixes
  }

  @Post('optimize-formula')
  @ApiOperation({ summary: 'Optimize formula performance' })
  async optimizeFormula(@Body() dto: OptimizeFormulaDto): Promise<FormulaOptimization> {
    // Suggest performance improvements
  }

  @Post('design-view')
  @ApiOperation({ summary: 'Get view configuration recommendations' })
  async designView(@Body() dto: DesignViewDto): Promise<ViewRecommendation> {
    // Recommend view type and configuration
  }

  @Post('assess-impact')
  @ApiOperation({ summary: 'Assess schema change impact' })
  async assessImpact(@Body() dto: AssessImpactDto): Promise<ImpactAssessment> {
    // Analyze breaking changes and migration needs
  }

  @Post('suggest-migration')
  @ApiOperation({ summary: 'Get migration guidance' })
  async suggestMigration(@Body() dto: MigrationRequestDto): Promise<MigrationPlan> {
    // Create migration plan for schema changes
  }

  @Post('query-schema')
  @ApiOperation({ summary: 'Answer questions about schema' })
  async querySchema(@Body() dto: SchemaQueryDto): Promise<SchemaQueryResult> {
    // Natural language schema queries
  }

  @Post('explain-property')
  @ApiOperation({ summary: 'Explain how a property works' })
  async explainProperty(@Body() dto: ExplainPropertyDto): Promise<PropertyExplanation> {
    // Detailed explanation of property configuration
  }
}
```

---

## 9. Performance Considerations

### 9.1 Formula Calculation Optimization

```typescript
// AVA helps users optimize formula performance

// User: "This formula is slow: COUNTIF(related_records, status = 'Active')"
{
  intent: 'optimize_formula',
  entities: {
    formula: 'COUNTIF(related_records, status = "Active")',
    performanceIssue: 'slow calculation'
  },
  analysis: {
    currentPerformance: {
      executionTime: 2500, // ms
      recordsProcessed: 10000,
      cacheHitRate: 0
    },
    bottlenecks: [
      {
        issue: 'No caching configured',
        impact: 'high',
        suggestion: 'Add periodic caching'
      },
      {
        issue: 'Counting all related records on every access',
        impact: 'high',
        suggestion: 'Use rollup property instead'
      }
    ],
    optimizedApproach: {
      propertyType: 'rollup',
      config: {
        type: 'rollup',
        sourceCollection: 'related_records',
        sourceProperty: 'id',
        relationshipProperty: 'parent',
        aggregation: 'count',
        filter: [
          { field: 'status', operator: 'eq', value: 'Active' }
        ]
      },
      expectedPerformance: {
        executionTime: 50, // ms
        improvement: '50x faster',
        cacheHitRate: 0.95
      }
    }
  },
  response: `I can help optimize this! The current approach is recalculating on every access.

**Current Performance:**
- Execution time: 2.5 seconds
- Processing 10,000 records each time
- No caching

**Optimization Strategy:**

**Option 1: Use Rollup Property** (Recommended)
- Switch from formula to rollup
- Database-level aggregation
- Automatic cache management
- **Expected: 50x faster** (50ms vs 2500ms)

**Option 2: Add Aggressive Caching**
- Keep formula, add periodic cache
- Update every 5 minutes
- Trade-off: Slightly stale data

**Recommended Configuration:**
\`\`\`
Property Type: Rollup
Source: related_records
Filter: status = "Active"
Aggregation: Count
\`\`\`

**Benefits:**
- Instant calculations
- Automatically updated when related records change
- No manual cache management
- Better scalability

Should I convert this to a rollup property?`
}
```

---

## 10. Testing AVA Schema Assistance

```typescript
// apps/svc-ava/src/app/ava/__tests__/schema-assistance.spec.ts

describe('AVA Schema Assistance', () => {
  describe('Collection Design', () => {
    it('recommends appropriate properties for e-commerce orders', async () => {
      const response = await ava.designCollection({
        purpose: 'track customer orders',
        domain: 'e-commerce',
      });

      expect(response.schema.properties).toContainEqual(
        expect.objectContaining({ name: 'customer', type: 'reference' })
      );
      expect(response.schema.properties).toContainEqual(
        expect.objectContaining({ name: 'total_amount', type: 'rollup' })
      );
      expect(response.schema.properties).toContainEqual(
        expect.objectContaining({ name: 'status', type: 'choice' })
      );
    });

    it('suggests relationships between collections', async () => {
      const response = await ava.suggestRelationships({
        collections: ['customers', 'orders', 'products'],
      });

      expect(response.relationships).toContainEqual({
        from: 'orders',
        to: 'customers',
        type: 'belongs_to',
      });
    });
  });

  describe('Formula Generation', () => {
    it('generates correct formula for date difference', async () => {
      const response = await ava.createFormula({
        description: 'calculate days between order date and today',
        context: { availableProperties: ['order_date', 'created_at'] },
      });

      expect(response.formula).toContain('DATEDIFF');
      expect(response.formula).toContain('order_date');
      expect(response.formula).toContain('TODAY()');
      expect(response.resultType).toBe('number');
    });

    it('debugs formula syntax errors', async () => {
      const response = await ava.debugFormula({
        formula: 'DATEDIFF(date1, date2)', // Missing unit parameter
      });

      expect(response.issues).toHaveLength(1);
      expect(response.issues[0].type).toBe('missing_parameter');
      expect(response.suggestion).toContain('"days"');
    });
  });

  describe('Impact Assessment', () => {
    it('identifies breaking changes when changing property type', async () => {
      const response = await ava.assessImpact({
        collection: 'orders',
        property: 'status',
        change: { from: 'choice', to: 'text' },
      });

      expect(response.breakingChanges).toBe(true);
      expect(response.affectedViews).toContainEqual(
        expect.objectContaining({ type: 'kanban' })
      );
    });
  });
});
```

---

*Document Version: 1.0*
*Phase Status: Planning*
*Last Updated: Phase 2 Planning*
