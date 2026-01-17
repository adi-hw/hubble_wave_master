# Phase 3: AVA Integration

**Document Type:** AI Integration Specification
**Audience:** AI/ML Team, Backend Developers
**Status:** Planning Phase

## Table of Contents

1. [Overview](#overview)
2. [Natural Language Rule Creation](#natural-language-rule-creation)
3. [Rule Suggestions](#rule-suggestions)
4. [Debugging Assistance](#debugging-assistance)
5. [Schedule Optimization](#schedule-optimization)
6. [Formula Generation](#formula-generation)
7. [Implementation Details](#implementation-details)
8. [Training Data Requirements](#training-data-requirements)

---

## Overview

AVA (Adaptive Virtual Assistant) integration in Phase 3 transforms automation from a technical configuration task into a conversational experience. Users can describe what they want to automate in plain English, and AVA translates it into fully-configured business rules, validations, and scheduled jobs.

### Key Capabilities

1. **Natural Language Rule Creation**: "Create a rule that assigns high-priority incidents to the Network team"
2. **Intelligent Suggestions**: "Based on your usage patterns, you might want to automate..."
3. **Debugging Help**: "This rule failed because the email server was unavailable"
4. **Formula Assistance**: "Calculate the total price including tax and shipping"
5. **Schedule Optimization**: "This job runs during peak hours; consider moving it to 2 AM"

### Design Principles

- **Conversational, Not Command-Based**: Users speak naturally, not in formal syntax
- **Contextual Understanding**: AVA understands the current collection, properties, and business context
- **Proactive Suggestions**: AVA suggests automation opportunities based on repetitive tasks
- **Learning from Feedback**: AVA improves suggestions based on user acceptance/rejection

---

## Natural Language Rule Creation

### User Flow

```
User: "Create a rule that assigns critical incidents to the Network team when no one is assigned"

AVA: I'll help you create that rule. Let me confirm the details:

     ┌─────────────────────────────────────────────────────────────────┐
     │ BUSINESS RULE                                                    │
     ├─────────────────────────────────────────────────────────────────┤
     │                                                                  │
     │ Name: Auto-assign Critical Incidents to Network Team            │
     │                                                                  │
     │ WHEN: Incident is created or updated                            │
     │                                                                  │
     │ IF:                                                              │
     │ • Priority equals "Critical"                                    │
     │ • Assignment Group is empty                                     │
     │                                                                  │
     │ THEN:                                                            │
     │ • Set Assignment Group to "Network Operations"                  │
     │ • Send notification to Assignment Group Manager                 │
     │                                                                  │
     │ Does this look correct?                                          │
     │                                                                  │
     │ [Yes, create it]  [Modify]  [Cancel]                            │
     └─────────────────────────────────────────────────────────────────┘

User: Yes, create it

AVA: ✓ Rule created and activated successfully!

     The rule has executed 3 times in the last hour with 100% success rate.

     Would you like to:
     • View execution logs
     • Create a similar rule for other priority levels
     • Set up a scheduled job to review unassigned incidents
```

### Natural Language Parsing

AVA uses a combination of:
- **Intent Recognition**: What does the user want to do? (create_rule, modify_rule, etc.)
- **Entity Extraction**: What are the key components? (collection, properties, values, actions)
- **Context Awareness**: What collection are they viewing? What properties exist?

#### Example Parsing

```
Input: "Create a rule that assigns high-priority incidents to the Network team when no one is assigned"

Parsed Intent: create_business_rule

Extracted Entities:
├─ collection: "Incident"
├─ trigger_event: "create_or_update"
├─ conditions:
│  ├─ { property: "priority", operator: "equals", value: "High" }
│  └─ { property: "assignment_group", operator: "is_empty" }
├─ actions:
│  └─ { type: "set_property", property: "assignment_group", value: "Network Operations" }
└─ implicit_actions:
   └─ { type: "send_notification", recipient: "assignment_group_manager" }
```

### Supported Natural Language Patterns

#### Trigger Patterns
- "when a record is created"
- "when [property] changes"
- "when [property] changes to [value]"
- "before saving"
- "after updating"
- "on delete"

#### Condition Patterns
- "[property] equals [value]"
- "[property] is [value]"
- "[property] is empty"
- "[property] is not empty"
- "[property] contains [value]"
- "[property] is greater than [value]"
- "when no [property] is assigned"
- "if [property] changed"

#### Action Patterns
- "assign to [value]"
- "set [property] to [value]"
- "send email to [recipient]"
- "notify [recipient]"
- "create a [collection] record"
- "update [property]"
- "delete the record"

#### Example Prompts and Translations

```
1. "Send an email to the manager when an incident is resolved"

   → WHEN: Incident updated
   → IF: Status changed to "Resolved"
   → THEN: Send email to Assigned To Manager

2. "Make sure the end date is after the start date"

   → Validation Rule
   → IF: End Date < Start Date
   → ERROR: "End Date must be after Start Date"

3. "Calculate the total as quantity times price minus discount"

   → Calculated Property: Total
   → Formula: [Quantity] * [Price] - [Discount]

4. "Every Monday at 9 AM, send a summary of open tickets to managers"

   → Scheduled Job
   → Schedule: Weekly, Monday, 9:00 AM
   → Action: Generate report of Status = "Open"
   → Send email to Role "Manager"

5. "Show the escalation manager field only when priority is critical"

   → Client Script (onChange: Priority)
   → IF: Priority = "Critical"
   → THEN: Show property "Escalation Manager"
   → ELSE: Hide property "Escalation Manager"
```

---

## Rule Suggestions

AVA proactively suggests automation opportunities based on:
1. **Repetitive User Actions**: Detect patterns in manual operations
2. **Common Workflows**: Recognize standard business processes
3. **Industry Best Practices**: Suggest rules used by similar organizations
4. **Error Patterns**: Suggest validations to prevent common mistakes

### Suggestion Triggers

#### Pattern Detection
```
AVA detected a pattern:
┌─────────────────────────────────────────────────────────────────┐
│ 💡 AUTOMATION SUGGESTION                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Over the past week, you manually assigned 47 critical incidents │
│ to the Network Operations team.                                 │
│                                                                  │
│ Would you like me to create a rule to automate this?            │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Auto-assign Critical Incidents                           │   │
│ │                                                           │   │
│ │ WHEN: Incident created with Priority = "Critical"        │   │
│ │ THEN: Set Assignment Group = "Network Operations"        │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ This would save you approximately 15 minutes per day.           │
│                                                                  │
│ [Create this rule]  [Modify]  [Dismiss]  [Don't suggest again] │
└─────────────────────────────────────────────────────────────────┘
```

#### Onboarding Suggestions

When a user creates a new collection:

```
AVA: I notice you created a "Project" collection. Here are some commonly used rules:

1. ✓ Validate that End Date is after Start Date
   [Add validation rule]

2. ✓ Calculate Project Duration automatically
   [Add calculated property]

3. ✓ Send notification when project status changes to "At Risk"
   [Add business rule]

4. ✓ Weekly report of overdue projects
   [Add scheduled job]

Would you like me to set these up for you?
[Set up all]  [Choose which ones]  [Not now]
```

#### Compliance Suggestions

```
AVA: 🔒 COMPLIANCE RECOMMENDATION

Based on your industry (Healthcare - HIPAA), I recommend adding:

1. Audit Log Rule
   Track all access to Patient Records collection
   [Add audit rule]

2. Data Retention Policy
   Automatically archive records older than 7 years
   [Add scheduled job]

3. Access Validation
   Prevent deletion of records with Status = "Active"
   [Add validation rule]

[Set up compliance package]  [Learn more]  [Dismiss]
```

### Suggestion Algorithm

```typescript
interface SuggestionScore {
    pattern: AutomationPattern;
    score: number;
    reasoning: string[];
    impact: {
        timeSaved: number; // minutes per day
        errorReduction: number; // percentage
        affectedRecords: number;
    };
}

function generateSuggestions(context: UserContext): SuggestionScore[] {
    const suggestions: SuggestionScore[] = [];

    // 1. Analyze user actions for patterns
    const patterns = detectRepetitiveActions(context.recentActions);

    // 2. Compare with common automations in similar organizations
    const industryPatterns = getIndustryBestPractices(context.industry);

    // 3. Analyze error logs for validation opportunities
    const errorPatterns = analyzeErrorLogs(context.errorLogs);

    // 4. Score and rank suggestions
    return rankSuggestions([...patterns, ...industryPatterns, ...errorPatterns]);
}
```

---

## Debugging Assistance

AVA helps troubleshoot failing rules by:
1. Analyzing execution logs
2. Identifying the root cause
3. Suggesting fixes
4. Providing step-by-step guidance

### Debug Flow Example

```
User: "Why did my rule fail?"

AVA: I found 3 failed executions of "Auto-assign Critical Incidents" in the past hour.

     Let me analyze the failures...

     ┌─────────────────────────────────────────────────────────────────┐
     │ 🔍 FAILURE ANALYSIS                                              │
     ├─────────────────────────────────────────────────────────────────┤
     │                                                                  │
     │ Rule: Auto-assign Critical Incidents                            │
     │ Failed: 3 times (2:15 PM, 2:18 PM, 2:22 PM)                     │
     │                                                                  │
     │ Root Cause:                                                      │
     │ ❌ Email notification action failed                             │
     │    Error: "SMTP server connection timeout"                      │
     │                                                                  │
     │ Impact:                                                          │
     │ • Assignment Group WAS set correctly                            │
     │ • Email notification DID NOT send                               │
     │                                                                  │
     │ Recommendation:                                                  │
     │ The issue is with the email server, not your rule. Your rule   │
     │ is working correctly. The assignments were made successfully.   │
     │                                                                  │
     │ Would you like me to:                                            │
     │ • Retry the failed email notifications  [Retry]                │
     │ • Make email notifications optional      [Modify rule]          │
     │ • Check email server status              [Diagnose]             │
     │                                                                  │
     └─────────────────────────────────────────────────────────────────┘
```

### Common Issues and AVA Responses

#### Issue: Infinite Loop
```
AVA: ⚠️ WARNING: Potential infinite loop detected!

     Your rule "Update Parent Task" modifies the Parent Task record,
     which triggers the same rule again, creating an infinite loop.

     How to fix:
     1. Add a condition to prevent re-execution:
        IF [Updated By Rule] is empty

     2. Use "Before Update" instead of "After Update" timing

     3. Disable recursive execution in Advanced Options

     [Fix automatically]  [Show me how]  [Learn more]
```

#### Issue: Performance Degradation
```
AVA: 📊 PERFORMANCE ALERT

     Your rule "Calculate Order Total" is taking 850ms on average,
     which is slower than the recommended 200ms threshold.

     Cause:
     The rule queries 15 related "Order Items" records on every execution.

     Recommendation:
     Convert this to a "Stored Calculation" that only recalculates
     when Order Items change, instead of on every Order update.

     Expected improvement: 850ms → 45ms (95% faster)

     [Apply optimization]  [View performance details]  [Dismiss]
```

#### Issue: Missing Properties
```
AVA: ❌ CONFIGURATION ERROR

     Your rule references property "Escalation Manager" which
     doesn't exist in the Incident collection.

     Did you mean:
     • Assignment Group Manager
     • Escalation Contact
     • Created By

     [Use "Assignment Group Manager"]  [Add new property]  [Cancel]
```

---

## Schedule Optimization

AVA analyzes scheduled job execution patterns and suggests optimizations:

### Peak Hour Detection

```
AVA: ⏰ SCHEDULE OPTIMIZATION

     Your job "Daily Report Generation" runs at 9:00 AM, which is
     during peak usage hours (8 AM - 11 AM).

     Performance Impact:
     • Current average runtime: 4.2 minutes
     • Affects 127 users during execution
     • Slows down other operations by ~15%

     Recommendation:
     Move this job to 2:00 AM when usage is minimal.

     Benefits:
     • Faster execution (estimated 2.1 minutes)
     • No impact on user operations
     • Results ready before work day starts

     [Reschedule to 2:00 AM]  [Choose different time]  [Keep current]
```

### Batch Optimization

```
AVA: 📦 BATCHING SUGGESTION

     You have 3 scheduled jobs that query the same Incident collection
     and run at similar times:

     • "Daily Cleanup" - 2:00 AM (processes ~500 records)
     • "SLA Check" - 2:15 AM (processes ~450 records)
     • "Assignment Review" - 2:30 AM (processes ~480 records)

     Recommendation:
     Combine these into a single job that processes each record once,
     applying all three operations.

     Benefits:
     • 73% reduction in database queries
     • Faster total execution (45 min → 12 min)
     • Reduced server load

     [Combine jobs]  [Show details]  [Keep separate]
```

### Timezone Awareness

```
AVA: 🌍 TIMEZONE ALERT

     Your job "Weekly Report" runs at 9:00 AM in multiple instances:
     • US Instance: 9:00 AM EST
     • UK Instance: 9:00 AM GMT (4:00 AM EST)
     • Asia Instance: 9:00 AM JST (7:00 PM EST previous day)

     This means the "weekly" report runs at 3 different times globally,
     making it difficult to compare data.

     Recommendation:
     Use UTC as the standard time (9:00 AM UTC = 4:00 AM EST).
     All instances will run simultaneously.

     [Standardize to UTC]  [Keep local times]  [Learn more]
```

---

## Formula Generation

AVA helps users create formulas without knowing the syntax:

### Conversational Formula Building

```
User: "Calculate the total price including tax and shipping"

AVA: I'll help you create that formula. Let me ask a few questions:

     1. What properties should I use?
        ☑ Unit Price
        ☑ Quantity
        ☑ Tax Rate (as percentage)
        ☑ Shipping Cost

     2. How should the calculation work?
        Subtotal = Unit Price × Quantity
        Tax Amount = Subtotal × (Tax Rate ÷ 100)
        Total = Subtotal + Tax Amount + Shipping Cost

        Is this correct? [Yes] [Modify]

User: Yes

AVA: Perfect! Here's your formula:

     ┌─────────────────────────────────────────────────────────────┐
     │ Total Price Formula                                          │
     ├─────────────────────────────────────────────────────────────┤
     │                                                              │
     │ ([Unit Price] * [Quantity]) *                               │
     │ (1 + [Tax Rate] / 100) +                                    │
     │ [Shipping Cost]                                              │
     │                                                              │
     ├─────────────────────────────────────────────────────────────┤
     │ Example calculation:                                         │
     │ Unit Price: $50                                              │
     │ Quantity: 10                                                 │
     │ Tax Rate: 8%                                                 │
     │ Shipping: $15                                                │
     │                                                              │
     │ Result: $555.00                                              │
     │ (Subtotal: $500 + Tax: $40 + Shipping: $15)                 │
     └─────────────────────────────────────────────────────────────┘

     [Apply formula]  [Test with different values]  [Modify]
```

### Formula Troubleshooting

```
User: "My formula isn't working"

AVA: Let me check your formula...

     ┌─────────────────────────────────────────────────────────────┐
     │ ❌ FORMULA ERROR DETECTED                                    │
     ├─────────────────────────────────────────────────────────────┤
     │                                                              │
     │ Your formula: [Quantity] * [Price] - [Discount]            │
     │                                                              │
     │ Issue: Division by zero error                               │
     │                                                              │
     │ Cause:                                                       │
     │ When Discount is a percentage, you're subtracting it        │
     │ directly instead of calculating the percentage of price.    │
     │                                                              │
     │ Example with your current formula:                          │
     │ 10 * $50 - 15 = $485 (incorrect)                            │
     │ Should be: 10 * $50 * (1 - 0.15) = $425                     │
     │                                                              │
     │ Corrected formula:                                           │
     │ [Quantity] * [Price] * (1 - [Discount] / 100)               │
     │                                                              │
     │ [Apply fix]  [Explain more]  [Cancel]                       │
     └─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### AVA Service Architecture

```typescript
// AVA Natural Language Processing Service

interface AVARequest {
    input: string;
    context: {
        instanceId: string;
        userId: string;
        currentCollection?: string;
        currentView?: 'form' | 'list' | 'builder';
    };
}

interface AVAResponse {
    intent: Intent;
    entities: Entity[];
    suggestedAction: AutomationConfig;
    confidence: number;
    clarificationNeeded?: ClarificationQuestion[];
}

class AVAService {
    /**
     * Process natural language input
     */
    async processInput(request: AVARequest): Promise<AVAResponse> {
        // 1. Detect intent
        const intent = await this.detectIntent(request.input);

        // 2. Extract entities
        const entities = await this.extractEntities(request.input, request.context);

        // 3. Build automation configuration
        const config = await this.buildAutomationConfig(intent, entities, request.context);

        // 4. Calculate confidence
        const confidence = this.calculateConfidence(config);

        // 5. Determine if clarification needed
        const clarification = confidence < 0.8
            ? await this.generateClarificationQuestions(config)
            : undefined;

        return {
            intent,
            entities,
            suggestedAction: config,
            confidence,
            clarificationNeeded: clarification,
        };
    }

    /**
     * Detect user intent
     */
    private async detectIntent(input: string): Promise<Intent> {
        // Use Claude API to classify intent
        const prompt = `
            Classify the following user input into one of these intents:
            - create_business_rule
            - create_scheduled_job
            - create_validation
            - create_calculated_property
            - create_client_script
            - debug_rule
            - optimize_schedule
            - generate_formula

            Input: "${input}"

            Respond with just the intent name.
        `;

        const response = await this.claudeAPI.complete(prompt);
        return response.trim() as Intent;
    }

    /**
     * Extract entities from input
     */
    private async extractEntities(input: string, context: AVAContext): Promise<Entity[]> {
        // Use Claude API with context to extract entities
        const prompt = `
            Extract automation entities from this input:
            "${input}"

            Context:
            - Current collection: ${context.currentCollection}
            - Available properties: ${this.getAvailableProperties(context)}

            Extract:
            - Collection name
            - Property names
            - Property values
            - Operators (equals, contains, greater than, etc.)
            - Actions (set property, send email, etc.)

            Return as JSON.
        `;

        const response = await this.claudeAPI.complete(prompt);
        return JSON.parse(response);
    }

    /**
     * Build automation configuration
     */
    private async buildAutomationConfig(
        intent: Intent,
        entities: Entity[],
        context: AVAContext
    ): Promise<AutomationConfig> {
        switch (intent) {
            case 'create_business_rule':
                return this.buildBusinessRule(entities, context);

            case 'create_scheduled_job':
                return this.buildScheduledJob(entities, context);

            case 'create_validation':
                return this.buildValidationRule(entities, context);

            case 'create_calculated_property':
                return this.buildCalculatedProperty(entities, context);

            case 'create_client_script':
                return this.buildClientScript(entities, context);

            default:
                throw new Error(`Unknown intent: ${intent}`);
        }
    }

    /**
     * Build business rule from entities
     */
    private buildBusinessRule(entities: Entity[], context: AVAContext): BusinessRuleConfig {
        const config: BusinessRuleConfig = {
            name: this.generateRuleName(entities),
            collection_id: this.resolveCollection(entities, context),
            trigger_type: this.resolveTriggerType(entities),
            trigger_timing: this.resolveTriggerTiming(entities),
            trigger_conditions: this.buildConditions(entities),
            actions: this.buildActions(entities),
        };

        return config;
    }

    /**
     * Generate appropriate rule name
     */
    private generateRuleName(entities: Entity[]): string {
        // Generate descriptive name from entities
        const action = entities.find(e => e.type === 'action')?.value;
        const condition = entities.find(e => e.type === 'condition')?.value;

        return `Auto-${action} when ${condition}`;
    }
}
```

### Claude API Integration

```typescript
// Integration with Claude API for NLP

class ClaudeNLPService {
    private apiKey: string;
    private model = 'claude-opus-4-5';

    /**
     * Process natural language with Claude
     */
    async processNaturalLanguage(prompt: string): Promise<string> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: prompt,
                }],
            }),
        });

        const data = await response.json();
        return data.content[0].text;
    }

    /**
     * Generate automation from description
     */
    async generateAutomation(description: string, context: AutomationContext): Promise<any> {
        const prompt = `
            You are AVA, an AI assistant for the HubbleWave platform.

            User wants to create automation with this description:
            "${description}"

            Platform context:
            - Instance: ${context.instanceId}
            - Collection: ${context.collectionName}
            - Available properties: ${JSON.stringify(context.properties)}
            - Available actions: Set Property, Send Notification, Create Record, etc.

            Generate a complete automation configuration as JSON following this schema:
            {
                "name": "descriptive name",
                "trigger_type": "insert|update|delete",
                "trigger_timing": "before|after|async",
                "trigger_conditions": {
                    "conditionGroups": [
                        {
                            "conditions": [
                                {
                                    "property": "property_name",
                                    "operator": "equals|contains|greater_than|etc",
                                    "value": "value"
                                }
                            ],
                            "operator": "AND|OR"
                        }
                    ],
                    "operator": "AND|OR"
                },
                "actions": [
                    {
                        "type": "set_property|send_notification|etc",
                        "config": { ... },
                        "order": 1
                    }
                ]
            }

            Return ONLY the JSON, no explanation.
        `;

        const response = await this.processNaturalLanguage(prompt);
        return JSON.parse(response);
    }
}
```

---

## Training Data Requirements

### Example Training Prompts

```json
{
    "training_examples": [
        {
            "input": "send an email when priority changes to critical",
            "output": {
                "intent": "create_business_rule",
                "trigger_type": "update",
                "condition_property": "priority",
                "condition_operator": "changed_to",
                "condition_value": "Critical",
                "action_type": "send_notification",
                "action_config": {
                    "type": "email",
                    "recipient": "assignment_group_manager"
                }
            }
        },
        {
            "input": "make sure end date is after start date",
            "output": {
                "intent": "create_validation",
                "validation_type": "record",
                "condition_property_1": "end_date",
                "condition_operator": "less_than",
                "condition_property_2": "start_date",
                "error_message": "End Date must be after Start Date"
            }
        },
        {
            "input": "calculate total as price times quantity",
            "output": {
                "intent": "create_calculated_property",
                "calculation_type": "formula",
                "formula": "[Price] * [Quantity]",
                "dependencies": ["price", "quantity"]
            }
        },
        {
            "input": "every monday at 9am send a report",
            "output": {
                "intent": "create_scheduled_job",
                "schedule_type": "weekly",
                "day_of_week": "monday",
                "time": "09:00",
                "action_type": "send_notification"
            }
        }
    ]
}
```

### Continuous Learning

```typescript
/**
 * Track user feedback to improve suggestions
 */
class AVALearningService {
    async recordFeedback(params: {
        suggestionId: string;
        accepted: boolean;
        modified: boolean;
        finalConfig?: any;
    }): Promise<void> {
        // Store feedback for model improvement
        await this.prisma.avaFeedback.create({
            data: {
                suggestion_id: params.suggestionId,
                accepted: params.accepted,
                modified: params.modified,
                final_config: params.finalConfig,
                created_at: new Date(),
            },
        });

        // Update suggestion scoring weights
        if (!params.accepted) {
            await this.adjustSuggestionWeights(params.suggestionId);
        }
    }

    /**
     * Analyze patterns in accepted vs rejected suggestions
     */
    async analyzeFeedbackPatterns(): Promise<LearningInsights> {
        const feedback = await this.prisma.avaFeedback.findMany({
            take: 1000,
            orderBy: { created_at: 'desc' },
        });

        return {
            acceptanceRate: this.calculateAcceptanceRate(feedback),
            commonModifications: this.findCommonModifications(feedback),
            improvedPatterns: this.identifyImprovedPatterns(feedback),
        };
    }
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**AI Model:** Claude Opus 4.5
**Integration Status:** Planning Phase
