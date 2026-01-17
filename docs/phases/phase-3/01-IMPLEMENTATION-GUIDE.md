# Phase 3: Implementation Guide

**Document Type:** Technical Specification
**Audience:** Backend & Frontend Developers
**Status:** Planning Phase

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [API Specifications](#api-specifications)
6. [Performance Optimization](#performance-optimization)
7. [Security Considerations](#security-considerations)
8. [Deployment Guidelines](#deployment-guidelines)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Rule Builder │  │   Schedule   │  │  Validation  │              │
│  │      UI      │  │   Builder    │  │   Designer   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                      │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API Gateway                                 │
│                      (Express + GraphQL)                             │
└─────────────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Service Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐     │
│  │ Business Rules │  │  Scheduled Jobs │  │   Validation     │     │
│  │    Service     │  │     Service     │  │     Service      │     │
│  └────────┬───────┘  └────────┬────────┘  └────────┬─────────┘     │
│           │                   │                     │               │
│  ┌────────┴───────────────────┴─────────────────────┴─────────┐    │
│  │              Rule Evaluation Engine                         │    │
│  │  - Condition Parser                                         │    │
│  │  - Action Executor                                          │    │
│  │  - Formula Evaluator                                        │    │
│  │  - Sandbox Runtime                                          │    │
│  └────────┬────────────────────────────────────────────────────┘    │
│           │                                                          │
└───────────┼──────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Event System                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐      ┌───────────────┐      ┌─────────────┐      │
│  │  PostgreSQL  │─────▶│ Event Emitter │─────▶│    Redis    │      │
│  │   Triggers   │      │   (Node.js)   │      │    Queue    │      │
│  └──────────────┘      └───────────────┘      └─────────────┘      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Data & Cache Layer                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐      ┌───────────────┐      ┌─────────────┐      │
│  │  PostgreSQL  │      │     Redis     │      │   Bull      │      │
│  │  (Primary)   │      │    (Cache)    │      │ (Scheduler) │      │
│  └──────────────┘      └───────────────┘      └─────────────┘      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Express.js for REST, Apollo Server for GraphQL
- **Database:** PostgreSQL 15+ with row-level security
- **Cache:** Redis 7+ for rule caching and session management
- **Queue:** Bull 4+ (Redis-based) for job scheduling
- **ORM:** Prisma for database access
- **Validation:** Joi for schema validation
- **Security:** Helmet, CORS, rate limiting

**Frontend:**
- **Framework:** React 18+ with TypeScript
- **State Management:** Zustand + React Query
- **UI Components:** Custom component library (Phase 2)
- **Visual Designer:** React Flow for rule visualization
- **Code Editor:** Monaco Editor for formula editing
- **Styling:** CSS Modules + CSS Custom Properties

**DevOps:**
- **Containerization:** Docker + Docker Compose
- **Orchestration:** Kubernetes (production)
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana
- **Logging:** Winston + ELK Stack

---

## Database Schema

### Core Tables

#### 1. Business Rules Table
```sql
CREATE TABLE business_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

    -- Rule Configuration
    trigger_type VARCHAR(50) NOT NULL, -- 'insert', 'update', 'delete', 'manual'
    trigger_timing VARCHAR(20) NOT NULL, -- 'before', 'after', 'async'
    trigger_conditions JSONB, -- Array of condition groups

    -- Execution Control
    is_active BOOLEAN DEFAULT true,
    execution_order INTEGER DEFAULT 100,
    run_async BOOLEAN DEFAULT false,

    -- Actions
    actions JSONB NOT NULL, -- Array of action definitions

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_executed_at TIMESTAMP,
    execution_count INTEGER DEFAULT 0,

    -- Version Control
    version INTEGER DEFAULT 1,
    parent_version_id UUID REFERENCES business_rules(id),

    CONSTRAINT unique_rule_name UNIQUE (instance_id, collection_id, name)
);

-- Indexes for performance
CREATE INDEX idx_business_rules_instance ON business_rules(instance_id);
CREATE INDEX idx_business_rules_collection ON business_rules(collection_id);
CREATE INDEX idx_business_rules_active ON business_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_business_rules_trigger ON business_rules(trigger_type, trigger_timing);
```

#### 2. Scheduled Jobs Table
```sql
CREATE TABLE scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Schedule Configuration
    schedule_type VARCHAR(50) NOT NULL, -- 'cron', 'interval', 'once'
    cron_expression VARCHAR(100), -- For cron-based schedules
    interval_minutes INTEGER, -- For interval-based schedules
    scheduled_time TIMESTAMP, -- For one-time execution
    timezone VARCHAR(100) DEFAULT 'UTC',

    -- Job Configuration
    job_type VARCHAR(50) NOT NULL, -- 'collection_query', 'script', 'api_call'
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    query_conditions JSONB, -- Filter conditions for records
    actions JSONB NOT NULL, -- Actions to perform

    -- Execution Control
    is_active BOOLEAN DEFAULT true,
    max_retries INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 300,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER DEFAULT 0,

    CONSTRAINT unique_job_name UNIQUE (instance_id, name)
);

CREATE INDEX idx_scheduled_jobs_instance ON scheduled_jobs(instance_id);
CREATE INDEX idx_scheduled_jobs_next_run ON scheduled_jobs(next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_jobs_active ON scheduled_jobs(is_active) WHERE is_active = true;
```

#### 3. Calculated Properties Table
```sql
CREATE TABLE calculated_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Calculation Configuration
    calculation_type VARCHAR(50) NOT NULL, -- 'formula', 'rollup', 'duration'
    formula TEXT, -- Formula expression
    formula_compiled JSONB, -- Compiled/optimized formula

    -- Rollup Configuration (for aggregations)
    related_collection_id UUID REFERENCES collections(id),
    related_property_id UUID REFERENCES properties(id),
    aggregation_function VARCHAR(50), -- 'sum', 'avg', 'count', 'min', 'max'
    rollup_filter JSONB, -- Filter conditions for related records

    -- Execution Control
    is_stored BOOLEAN DEFAULT false, -- If false, calculate on read
    recalculate_on_update BOOLEAN DEFAULT true,
    dependencies JSONB, -- Array of property IDs this depends on

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_calculated_property UNIQUE (property_id)
);

CREATE INDEX idx_calculated_properties_collection ON calculated_properties(collection_id);
CREATE INDEX idx_calculated_properties_dependencies ON calculated_properties USING GIN (dependencies);
```

#### 4. Validation Rules Table
```sql
CREATE TABLE validation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Validation Configuration
    validation_type VARCHAR(50) NOT NULL, -- 'property', 'record', 'collection'
    property_id UUID REFERENCES properties(id), -- For property-level validation
    validation_conditions JSONB NOT NULL, -- Validation rules
    error_message TEXT NOT NULL,

    -- Execution Control
    is_active BOOLEAN DEFAULT true,
    trigger_on_create BOOLEAN DEFAULT true,
    trigger_on_update BOOLEAN DEFAULT true,
    execution_order INTEGER DEFAULT 100,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_validation_name UNIQUE (instance_id, collection_id, name)
);

CREATE INDEX idx_validation_rules_collection ON validation_rules(collection_id);
CREATE INDEX idx_validation_rules_property ON validation_rules(property_id);
CREATE INDEX idx_validation_rules_active ON validation_rules(is_active) WHERE is_active = true;
```

#### 5. Client Scripts Table
```sql
CREATE TABLE client_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Script Configuration
    script_type VARCHAR(50) NOT NULL, -- 'onLoad', 'onChange', 'onSubmit', 'onCellEdit'
    applies_to VARCHAR(50) NOT NULL, -- 'form', 'list', 'both'
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id), -- For onChange scripts

    -- Script Definition (no-code)
    script_actions JSONB NOT NULL, -- Array of declarative actions
    trigger_conditions JSONB, -- Optional conditions for execution

    -- Execution Control
    is_active BOOLEAN DEFAULT true,
    execution_order INTEGER DEFAULT 100,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_client_script_name UNIQUE (instance_id, collection_id, name)
);

CREATE INDEX idx_client_scripts_collection ON client_scripts(collection_id);
CREATE INDEX idx_client_scripts_type ON client_scripts(script_type, applies_to);
CREATE INDEX idx_client_scripts_active ON client_scripts(is_active) WHERE is_active = true;
```

#### 6. Rule Execution Log Table
```sql
CREATE TABLE rule_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,

    -- Rule Information
    rule_type VARCHAR(50) NOT NULL, -- 'business_rule', 'scheduled_job', 'validation', 'client_script'
    rule_id UUID NOT NULL,
    rule_name VARCHAR(255),

    -- Execution Context
    collection_id UUID REFERENCES collections(id),
    record_id UUID,
    triggered_by UUID REFERENCES users(id),
    trigger_event VARCHAR(50), -- 'insert', 'update', 'delete', 'schedule', 'manual'

    -- Execution Details
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    status VARCHAR(50) NOT NULL, -- 'success', 'error', 'skipped'
    error_message TEXT,

    -- Execution Data
    input_data JSONB, -- Record state before execution
    output_data JSONB, -- Record state after execution
    actions_executed JSONB, -- Array of actions that were executed

    -- Metadata
    execution_id UUID, -- For correlating related executions
    parent_execution_id UUID REFERENCES rule_execution_logs(id), -- For cascading rules

    -- Partitioning hint
    created_at TIMESTAMP DEFAULT NOW()
);

-- Partition by month for better performance
CREATE INDEX idx_rule_execution_logs_instance ON rule_execution_logs(instance_id, created_at DESC);
CREATE INDEX idx_rule_execution_logs_rule ON rule_execution_logs(rule_id, created_at DESC);
CREATE INDEX idx_rule_execution_logs_record ON rule_execution_logs(record_id, created_at DESC);
CREATE INDEX idx_rule_execution_logs_status ON rule_execution_logs(status) WHERE status = 'error';
```

### JSONB Schema Definitions

#### Business Rule Trigger Conditions
```typescript
interface TriggerConditions {
    conditionGroups: ConditionGroup[];
    operator: 'AND' | 'OR'; // How to combine groups
}

interface ConditionGroup {
    conditions: Condition[];
    operator: 'AND' | 'OR'; // How to combine conditions within group
}

interface Condition {
    property: string; // Property system name
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' |
              'contains' | 'starts_with' | 'ends_with' | 'is_empty' |
              'is_not_empty' | 'in' | 'not_in' | 'changed' | 'changed_to' |
              'changed_from';
    value: any; // Comparison value
    valueType: 'static' | 'property' | 'formula'; // How to interpret value
}
```

#### Business Rule Actions
```typescript
interface RuleAction {
    type: 'set_property' | 'create_record' | 'update_record' |
          'delete_record' | 'send_notification' | 'call_api' |
          'add_to_queue' | 'run_script';
    config: ActionConfig;
    order: number;
    stopOnError: boolean;
}

interface SetPropertyAction extends RuleAction {
    type: 'set_property';
    config: {
        property: string;
        valueType: 'static' | 'formula' | 'property';
        value: any;
    };
}

interface CreateRecordAction extends RuleAction {
    type: 'create_record';
    config: {
        collection: string;
        propertyValues: Record<string, any>;
        linkToCurrentRecord?: {
            referenceProperty: string;
        };
    };
}

interface SendNotificationAction extends RuleAction {
    type: 'send_notification';
    config: {
        notificationType: 'email' | 'push' | 'in_app';
        recipients: {
            type: 'users' | 'roles' | 'property' | 'email';
            value: string | string[];
        };
        template: string;
        subject?: string;
        body?: string;
    };
}
```

#### Scheduled Job Query Conditions
```typescript
interface QueryConditions {
    conditions: Condition[];
    operator: 'AND' | 'OR';
    limit?: number;
    orderBy?: {
        property: string;
        direction: 'ASC' | 'DESC';
    };
}
```

#### Calculated Property Formula
```typescript
interface FormulaExpression {
    type: 'formula';
    expression: string; // Human-readable formula
    compiled: {
        ast: any; // Abstract Syntax Tree
        dependencies: string[]; // Property dependencies
        optimized: boolean;
    };
}

interface RollupExpression {
    type: 'rollup';
    relatedCollection: string;
    relatedProperty: string;
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
    filter?: QueryConditions;
}
```

#### Client Script Actions
```typescript
interface ClientScriptAction {
    type: 'show_property' | 'hide_property' | 'set_required' |
          'set_optional' | 'set_readonly' | 'set_editable' |
          'set_value' | 'show_message' | 'enable_action' |
          'disable_action';
    config: ClientScriptActionConfig;
}

interface ShowPropertyAction extends ClientScriptAction {
    type: 'show_property' | 'hide_property';
    config: {
        properties: string[]; // Array of property system names
    };
}

interface SetRequiredAction extends ClientScriptAction {
    type: 'set_required' | 'set_optional';
    config: {
        properties: string[];
    };
}

interface SetValueAction extends ClientScriptAction {
    type: 'set_value';
    config: {
        property: string;
        valueType: 'static' | 'formula' | 'property';
        value: any;
    };
}
```

---

## Backend Implementation

### 1. Business Rules Service

#### Service Structure
```typescript
// src/services/business-rules/BusinessRulesService.ts

import { EventEmitter } from 'events';
import { RuleEvaluator } from './RuleEvaluator';
import { ActionExecutor } from './ActionExecutor';
import { RuleCache } from './RuleCache';

export class BusinessRulesService extends EventEmitter {
    private ruleEvaluator: RuleEvaluator;
    private actionExecutor: ActionExecutor;
    private ruleCache: RuleCache;

    constructor() {
        super();
        this.ruleEvaluator = new RuleEvaluator();
        this.actionExecutor = new ActionExecutor();
        this.ruleCache = new RuleCache();
    }

    /**
     * Execute rules for a specific trigger event
     */
    async executeRules(params: {
        instanceId: string;
        collectionId: string;
        triggerType: TriggerType;
        triggerTiming: 'before' | 'after';
        record: Record<string, any>;
        oldRecord?: Record<string, any>; // For updates
        userId: string;
    }): Promise<RuleExecutionResult> {
        const { instanceId, collectionId, triggerType, triggerTiming, record, oldRecord, userId } = params;

        // 1. Get applicable rules from cache
        const rules = await this.getApplicableRules(
            instanceId,
            collectionId,
            triggerType,
            triggerTiming
        );

        if (rules.length === 0) {
            return { success: true, actionsExecuted: [] };
        }

        // 2. Sort by execution order
        rules.sort((a, b) => a.execution_order - b.execution_order);

        const executionId = this.generateExecutionId();
        const results: ActionResult[] = [];
        let modifiedRecord = { ...record };

        try {
            // 3. Execute each rule
            for (const rule of rules) {
                const ruleResult = await this.executeRule({
                    rule,
                    record: modifiedRecord,
                    oldRecord,
                    userId,
                    executionId,
                });

                if (!ruleResult.success) {
                    throw new Error(`Rule "${rule.name}" failed: ${ruleResult.error}`);
                }

                // Update record with changes from this rule
                if (ruleResult.recordChanges) {
                    modifiedRecord = { ...modifiedRecord, ...ruleResult.recordChanges };
                }

                results.push(...ruleResult.actionsExecuted);

                // Log execution
                await this.logExecution({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    ruleType: 'business_rule',
                    instanceId,
                    collectionId,
                    recordId: record.id,
                    triggeredBy: userId,
                    triggerEvent: triggerType,
                    status: 'success',
                    actionsExecuted: ruleResult.actionsExecuted,
                    inputData: record,
                    outputData: modifiedRecord,
                    executionId,
                });
            }

            return {
                success: true,
                recordChanges: modifiedRecord,
                actionsExecuted: results,
            };

        } catch (error) {
            // Log error
            await this.logExecution({
                instanceId,
                ruleType: 'business_rule',
                status: 'error',
                errorMessage: error.message,
                executionId,
            });

            throw error;
        }
    }

    /**
     * Execute a single rule
     */
    private async executeRule(params: {
        rule: BusinessRule;
        record: Record<string, any>;
        oldRecord?: Record<string, any>;
        userId: string;
        executionId: string;
    }): Promise<RuleResult> {
        const { rule, record, oldRecord, userId, executionId } = params;
        const startTime = Date.now();

        try {
            // 1. Evaluate conditions
            const conditionsMet = await this.ruleEvaluator.evaluate({
                conditions: rule.trigger_conditions,
                record,
                oldRecord,
            });

            if (!conditionsMet) {
                return {
                    success: true,
                    skipped: true,
                    actionsExecuted: [],
                };
            }

            // 2. Execute actions
            const actionResults = await this.actionExecutor.executeActions({
                actions: rule.actions,
                record,
                userId,
                executionId,
            });

            return {
                success: true,
                recordChanges: actionResults.recordChanges,
                actionsExecuted: actionResults.actions,
                duration: Date.now() - startTime,
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Get applicable rules from cache
     */
    private async getApplicableRules(
        instanceId: string,
        collectionId: string,
        triggerType: TriggerType,
        triggerTiming: 'before' | 'after'
    ): Promise<BusinessRule[]> {
        const cacheKey = `rules:${instanceId}:${collectionId}:${triggerType}:${triggerTiming}`;

        // Try cache first
        const cached = await this.ruleCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Load from database
        const rules = await this.prisma.businessRules.findMany({
            where: {
                instance_id: instanceId,
                collection_id: collectionId,
                trigger_type: triggerType,
                trigger_timing: triggerTiming,
                is_active: true,
            },
            orderBy: {
                execution_order: 'asc',
            },
        });

        // Cache for 5 minutes
        await this.ruleCache.set(cacheKey, rules, 300);

        return rules;
    }

    /**
     * Invalidate rule cache when rules change
     */
    async invalidateCache(params: {
        instanceId: string;
        collectionId?: string;
    }): Promise<void> {
        const { instanceId, collectionId } = params;

        if (collectionId) {
            await this.ruleCache.deletePattern(`rules:${instanceId}:${collectionId}:*`);
        } else {
            await this.ruleCache.deletePattern(`rules:${instanceId}:*`);
        }
    }
}
```

#### Rule Evaluator
```typescript
// src/services/business-rules/RuleEvaluator.ts

export class RuleEvaluator {
    /**
     * Evaluate rule conditions
     */
    async evaluate(params: {
        conditions: TriggerConditions;
        record: Record<string, any>;
        oldRecord?: Record<string, any>;
    }): Promise<boolean> {
        const { conditions, record, oldRecord } = params;

        if (!conditions || !conditions.conditionGroups || conditions.conditionGroups.length === 0) {
            return true; // No conditions means always execute
        }

        const groupResults = await Promise.all(
            conditions.conditionGroups.map(group =>
                this.evaluateConditionGroup(group, record, oldRecord)
            )
        );

        // Combine group results based on operator
        if (conditions.operator === 'OR') {
            return groupResults.some(result => result);
        } else {
            return groupResults.every(result => result);
        }
    }

    /**
     * Evaluate a condition group
     */
    private async evaluateConditionGroup(
        group: ConditionGroup,
        record: Record<string, any>,
        oldRecord?: Record<string, any>
    ): Promise<boolean> {
        const conditionResults = await Promise.all(
            group.conditions.map(condition =>
                this.evaluateCondition(condition, record, oldRecord)
            )
        );

        // Combine condition results based on operator
        if (group.operator === 'OR') {
            return conditionResults.some(result => result);
        } else {
            return conditionResults.every(result => result);
        }
    }

    /**
     * Evaluate a single condition
     */
    private async evaluateCondition(
        condition: Condition,
        record: Record<string, any>,
        oldRecord?: Record<string, any>
    ): Promise<boolean> {
        const actualValue = this.getPropertyValue(record, condition.property);
        const expectedValue = this.resolveValue(condition.value, condition.valueType, record);

        switch (condition.operator) {
            case 'equals':
                return actualValue === expectedValue;

            case 'not_equals':
                return actualValue !== expectedValue;

            case 'greater_than':
                return actualValue > expectedValue;

            case 'less_than':
                return actualValue < expectedValue;

            case 'contains':
                return String(actualValue).includes(String(expectedValue));

            case 'starts_with':
                return String(actualValue).startsWith(String(expectedValue));

            case 'ends_with':
                return String(actualValue).endsWith(String(expectedValue));

            case 'is_empty':
                return !actualValue || actualValue === '';

            case 'is_not_empty':
                return actualValue && actualValue !== '';

            case 'in':
                return Array.isArray(expectedValue) && expectedValue.includes(actualValue);

            case 'not_in':
                return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);

            case 'changed':
                if (!oldRecord) return false;
                const oldValue = this.getPropertyValue(oldRecord, condition.property);
                return actualValue !== oldValue;

            case 'changed_to':
                if (!oldRecord) return false;
                const oldValueTo = this.getPropertyValue(oldRecord, condition.property);
                return oldValueTo !== expectedValue && actualValue === expectedValue;

            case 'changed_from':
                if (!oldRecord) return false;
                const oldValueFrom = this.getPropertyValue(oldRecord, condition.property);
                return oldValueFrom === expectedValue && actualValue !== expectedValue;

            default:
                throw new Error(`Unknown operator: ${condition.operator}`);
        }
    }

    /**
     * Get property value from record (supports nested properties)
     */
    private getPropertyValue(record: Record<string, any>, property: string): any {
        const parts = property.split('.');
        let value = record;

        for (const part of parts) {
            if (value == null) return null;
            value = value[part];
        }

        return value;
    }

    /**
     * Resolve value based on type
     */
    private resolveValue(value: any, valueType: string, record: Record<string, any>): any {
        switch (valueType) {
            case 'static':
                return value;

            case 'property':
                return this.getPropertyValue(record, value);

            case 'formula':
                return this.evaluateFormula(value, record);

            default:
                return value;
        }
    }

    /**
     * Evaluate formula expression using FormulaEngine
     */
    private evaluateFormula(formula: string, record: Record<string, any>): any {
        const engine = new FormulaEngine();
        return engine.evaluate(formula, { record });
    }
}
```

#### Action Executor
```typescript
// src/services/business-rules/ActionExecutor.ts

export class ActionExecutor {
    /**
     * Execute all actions for a rule
     */
    async executeActions(params: {
        actions: RuleAction[];
        record: Record<string, any>;
        userId: string;
        executionId: string;
    }): Promise<ActionExecutionResult> {
        const { actions, record, userId, executionId } = params;

        // Sort actions by order
        const sortedActions = [...actions].sort((a, b) => a.order - b.order);

        const executedActions: ActionResult[] = [];
        let recordChanges: Record<string, any> = {};

        for (const action of sortedActions) {
            try {
                const result = await this.executeAction(action, record, recordChanges, userId, executionId);

                if (result.recordChanges) {
                    recordChanges = { ...recordChanges, ...result.recordChanges };
                }

                executedActions.push({
                    type: action.type,
                    success: true,
                    result: result.data,
                });

            } catch (error) {
                executedActions.push({
                    type: action.type,
                    success: false,
                    error: error.message,
                });

                if (action.stopOnError) {
                    throw error;
                }
            }
        }

        return {
            recordChanges,
            actions: executedActions,
        };
    }

    /**
     * Execute a single action
     */
    private async executeAction(
        action: RuleAction,
        record: Record<string, any>,
        currentChanges: Record<string, any>,
        userId: string,
        executionId: string
    ): Promise<{ recordChanges?: Record<string, any>; data?: any }> {
        // Merge current changes with record for context
        const contextRecord = { ...record, ...currentChanges };

        switch (action.type) {
            case 'set_property':
                return this.executeSetProperty(action as SetPropertyAction, contextRecord);

            case 'create_record':
                return this.executeCreateRecord(action as CreateRecordAction, contextRecord, userId);

            case 'update_record':
                return this.executeUpdateRecord(action as UpdateRecordAction, contextRecord, userId);

            case 'delete_record':
                return this.executeDeleteRecord(action as DeleteRecordAction, contextRecord);

            case 'send_notification':
                return this.executeSendNotification(action as SendNotificationAction, contextRecord);

            case 'call_api':
                return this.executeCallApi(action as CallApiAction, contextRecord);

            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Execute set property action
     */
    private async executeSetProperty(
        action: SetPropertyAction,
        record: Record<string, any>
    ): Promise<{ recordChanges: Record<string, any> }> {
        const value = this.resolveValue(action.config.value, action.config.valueType, record);

        return {
            recordChanges: {
                [action.config.property]: value,
            },
        };
    }

    /**
     * Execute create record action
     */
    private async executeCreateRecord(
        action: CreateRecordAction,
        record: Record<string, any>,
        userId: string
    ): Promise<{ data: any }> {
        const propertyValues: Record<string, any> = {};

        // Resolve all property values
        for (const [prop, value] of Object.entries(action.config.propertyValues)) {
            propertyValues[prop] = this.resolveValue(value.value, value.valueType, record);
        }

        // Add link to current record if specified
        if (action.config.linkToCurrentRecord) {
            propertyValues[action.config.linkToCurrentRecord.referenceProperty] = record.id;
        }

        // Create the record
        const newRecord = await this.dataService.createRecord({
            collectionName: action.config.collection,
            data: propertyValues,
            userId,
        });

        return { data: newRecord };
    }

    /**
     * Execute send notification action
     */
    private async executeSendNotification(
        action: SendNotificationAction,
        record: Record<string, any>
    ): Promise<{ data: any }> {
        const recipients = this.resolveRecipients(action.config.recipients, record);
        const subject = this.interpolateTemplate(action.config.subject, record);
        const body = this.interpolateTemplate(action.config.body, record);

        const result = await this.notificationService.send({
            type: action.config.notificationType,
            recipients,
            subject,
            body,
        });

        return { data: result };
    }

    // Additional helper methods...
}
```

### 2. Scheduled Jobs Service

```typescript
// src/services/scheduled-jobs/ScheduledJobsService.ts

import Bull, { Queue, Job } from 'bull';
import { CronParser } from './CronParser';

export class ScheduledJobsService {
    private jobQueue: Queue;
    private cronParser: CronParser;

    constructor() {
        // Initialize Bull queue
        this.jobQueue = new Bull('scheduled-jobs', {
            redis: {
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT || '6379'),
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: 100, // Keep last 100 completed jobs
                removeOnFail: 500, // Keep last 500 failed jobs
            },
        });

        this.cronParser = new CronParser();

        // Set up job processor
        this.jobQueue.process(async (job: Job) => {
            return this.processJob(job);
        });
    }

    /**
     * Schedule a job
     */
    async scheduleJob(scheduledJob: ScheduledJob): Promise<void> {
        const { id, schedule_type, cron_expression, interval_minutes, scheduled_time } = scheduledJob;

        switch (schedule_type) {
            case 'cron':
                // Add repeatable job with cron
                await this.jobQueue.add(
                    { scheduledJobId: id },
                    {
                        jobId: id,
                        repeat: {
                            cron: cron_expression,
                            tz: scheduledJob.timezone,
                        },
                    }
                );
                break;

            case 'interval':
                // Add repeatable job with interval
                await this.jobQueue.add(
                    { scheduledJobId: id },
                    {
                        jobId: id,
                        repeat: {
                            every: interval_minutes * 60 * 1000, // Convert to milliseconds
                        },
                    }
                );
                break;

            case 'once':
                // Add one-time job
                const delay = new Date(scheduled_time).getTime() - Date.now();
                await this.jobQueue.add(
                    { scheduledJobId: id },
                    {
                        jobId: id,
                        delay: Math.max(0, delay),
                    }
                );
                break;
        }

        // Update next_run_at
        const nextRun = await this.calculateNextRun(scheduledJob);
        await this.prisma.scheduledJobs.update({
            where: { id },
            data: { next_run_at: nextRun },
        });
    }

    /**
     * Process a scheduled job
     */
    private async processJob(job: Job): Promise<any> {
        const { scheduledJobId } = job.data;

        // Load job configuration
        const scheduledJob = await this.prisma.scheduledJobs.findUnique({
            where: { id: scheduledJobId },
        });

        if (!scheduledJob || !scheduledJob.is_active) {
            return { skipped: true, reason: 'Job inactive or deleted' };
        }

        const startTime = Date.now();

        try {
            // Execute job based on type
            let result;
            switch (scheduledJob.job_type) {
                case 'collection_query':
                    result = await this.executeCollectionQuery(scheduledJob);
                    break;

                case 'script':
                    result = await this.executeScript(scheduledJob);
                    break;

                case 'api_call':
                    result = await this.executeApiCall(scheduledJob);
                    break;

                default:
                    throw new Error(`Unknown job type: ${scheduledJob.job_type}`);
            }

            // Update job metadata
            await this.prisma.scheduledJobs.update({
                where: { id: scheduledJobId },
                data: {
                    last_run_at: new Date(),
                    next_run_at: await this.calculateNextRun(scheduledJob),
                    run_count: { increment: 1 },
                },
            });

            // Log execution
            await this.logExecution({
                ruleId: scheduledJobId,
                ruleName: scheduledJob.name,
                ruleType: 'scheduled_job',
                instanceId: scheduledJob.instance_id,
                status: 'success',
                duration: Date.now() - startTime,
                outputData: result,
            });

            return result;

        } catch (error) {
            // Log error
            await this.logExecution({
                ruleId: scheduledJobId,
                ruleName: scheduledJob.name,
                ruleType: 'scheduled_job',
                instanceId: scheduledJob.instance_id,
                status: 'error',
                errorMessage: error.message,
                duration: Date.now() - startTime,
            });

            throw error;
        }
    }

    /**
     * Execute collection query job
     */
    private async executeCollectionQuery(job: ScheduledJob): Promise<any> {
        // 1. Query records based on conditions
        const records = await this.dataService.queryRecords({
            collectionId: job.collection_id,
            conditions: job.query_conditions,
        });

        // 2. Execute actions on each record
        const results = [];
        for (const record of records) {
            const actionResult = await this.actionExecutor.executeActions({
                actions: job.actions,
                record,
                userId: 'system',
                executionId: this.generateExecutionId(),
            });

            results.push(actionResult);
        }

        return {
            recordsProcessed: records.length,
            results,
        };
    }

    /**
     * Calculate next run time
     */
    private async calculateNextRun(job: ScheduledJob): Promise<Date | null> {
        switch (job.schedule_type) {
            case 'cron':
                return this.cronParser.getNextRun(job.cron_expression, job.timezone);

            case 'interval':
                return new Date(Date.now() + job.interval_minutes * 60 * 1000);

            case 'once':
                return null; // One-time jobs don't have a next run

            default:
                return null;
        }
    }
}
```

### 3. Validation Service

```typescript
// src/services/validation/ValidationService.ts

export class ValidationService {
    /**
     * Validate a record before create/update
     */
    async validateRecord(params: {
        instanceId: string;
        collectionId: string;
        record: Record<string, any>;
        oldRecord?: Record<string, any>;
        operation: 'create' | 'update';
    }): Promise<ValidationResult> {
        const { instanceId, collectionId, record, oldRecord, operation } = params;

        // Load applicable validation rules
        const rules = await this.getValidationRules(instanceId, collectionId, operation);

        const errors: ValidationError[] = [];

        // Execute each validation rule
        for (const rule of rules) {
            const result = await this.executeValidationRule(rule, record, oldRecord);

            if (!result.isValid) {
                errors.push({
                    property: rule.property_id ? await this.getPropertyName(rule.property_id) : null,
                    message: rule.error_message,
                    rule: rule.name,
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Execute a single validation rule
     */
    private async executeValidationRule(
        rule: ValidationRule,
        record: Record<string, any>,
        oldRecord?: Record<string, any>
    ): Promise<{ isValid: boolean }> {
        // Evaluate validation conditions
        const conditionsMet = await this.evaluateConditions(
            rule.validation_conditions,
            record,
            oldRecord
        );

        // If conditions are met, validation fails
        // (conditions define when record is INVALID)
        return { isValid: !conditionsMet };
    }
}
```

---

## Frontend Implementation

### 1. Rule Builder Component

```typescript
// src/components/automation/RuleBuilder/RuleBuilder.tsx

import React, { useState } from 'react';
import { ReactFlow, Node, Edge } from 'react-flow-renderer';
import { ConditionBuilder } from './ConditionBuilder';
import { ActionBuilder } from './ActionBuilder';
import styles from './RuleBuilder.module.css';

interface RuleBuilderProps {
    collectionId: string;
    onSave: (rule: BusinessRule) => Promise<void>;
    initialRule?: BusinessRule;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
    collectionId,
    onSave,
    initialRule,
}) => {
    const [rule, setRule] = useState<BusinessRule>(initialRule || {
        name: '',
        description: '',
        collection_id: collectionId,
        trigger_type: 'insert',
        trigger_timing: 'before',
        trigger_conditions: { conditionGroups: [], operator: 'AND' },
        actions: [],
        is_active: true,
        execution_order: 100,
    });

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    // Build visual flow representation
    React.useEffect(() => {
        const flowNodes = buildFlowNodes(rule);
        const flowEdges = buildFlowEdges(rule);
        setNodes(flowNodes);
        setEdges(flowEdges);
    }, [rule]);

    const handleSave = async () => {
        await onSave(rule);
    };

    return (
        <div className={styles.ruleBuilder}>
            <div className={styles.header}>
                <input
                    type="text"
                    className={styles.ruleName}
                    placeholder="Rule Name"
                    value={rule.name}
                    onChange={(e) => setRule({ ...rule, name: e.target.value })}
                />
                <button onClick={handleSave} className={styles.saveButton}>
                    Save Rule
                </button>
            </div>

            <div className={styles.configuration}>
                <div className={styles.configSection}>
                    <label>When</label>
                    <select
                        value={rule.trigger_type}
                        onChange={(e) => setRule({ ...rule, trigger_type: e.target.value })}
                    >
                        <option value="insert">Record is created</option>
                        <option value="update">Record is updated</option>
                        <option value="delete">Record is deleted</option>
                    </select>

                    <label>Execute</label>
                    <select
                        value={rule.trigger_timing}
                        onChange={(e) => setRule({ ...rule, trigger_timing: e.target.value })}
                    >
                        <option value="before">Before operation</option>
                        <option value="after">After operation</option>
                        <option value="async">After operation (async)</option>
                    </select>
                </div>

                <div className={styles.configSection}>
                    <label>If (Conditions)</label>
                    <ConditionBuilder
                        conditions={rule.trigger_conditions}
                        onChange={(conditions) => setRule({ ...rule, trigger_conditions: conditions })}
                        collectionId={collectionId}
                    />
                </div>

                <div className={styles.configSection}>
                    <label>Then (Actions)</label>
                    <ActionBuilder
                        actions={rule.actions}
                        onChange={(actions) => setRule({ ...rule, actions })}
                        collectionId={collectionId}
                    />
                </div>
            </div>

            <div className={styles.visualFlow}>
                <h3>Visual Flow</h3>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    fitView
                    className={styles.flowCanvas}
                />
            </div>
        </div>
    );
};
```

### 2. Condition Builder Component

```typescript
// src/components/automation/RuleBuilder/ConditionBuilder.tsx

import React from 'react';
import { Property } from '../../../types';
import { useProperties } from '../../../hooks/useProperties';
import styles from './ConditionBuilder.module.css';

interface ConditionBuilderProps {
    conditions: TriggerConditions;
    onChange: (conditions: TriggerConditions) => void;
    collectionId: string;
}

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
    conditions,
    onChange,
    collectionId,
}) => {
    const { properties } = useProperties(collectionId);

    const addConditionGroup = () => {
        onChange({
            ...conditions,
            conditionGroups: [
                ...conditions.conditionGroups,
                { conditions: [], operator: 'AND' },
            ],
        });
    };

    const addCondition = (groupIndex: number) => {
        const newGroups = [...conditions.conditionGroups];
        newGroups[groupIndex].conditions.push({
            property: '',
            operator: 'equals',
            value: '',
            valueType: 'static',
        });
        onChange({ ...conditions, conditionGroups: newGroups });
    };

    const updateCondition = (
        groupIndex: number,
        conditionIndex: number,
        updates: Partial<Condition>
    ) => {
        const newGroups = [...conditions.conditionGroups];
        newGroups[groupIndex].conditions[conditionIndex] = {
            ...newGroups[groupIndex].conditions[conditionIndex],
            ...updates,
        };
        onChange({ ...conditions, conditionGroups: newGroups });
    };

    return (
        <div className={styles.conditionBuilder}>
            {conditions.conditionGroups.map((group, groupIndex) => (
                <div key={groupIndex} className={styles.conditionGroup}>
                    {groupIndex > 0 && (
                        <div className={styles.groupOperator}>
                            <select
                                value={conditions.operator}
                                onChange={(e) => onChange({
                                    ...conditions,
                                    operator: e.target.value as 'AND' | 'OR',
                                })}
                            >
                                <option value="AND">AND</option>
                                <option value="OR">OR</option>
                            </select>
                        </div>
                    )}

                    {group.conditions.map((condition, conditionIndex) => (
                        <div key={conditionIndex} className={styles.condition}>
                            {conditionIndex > 0 && (
                                <span className={styles.conditionOperator}>
                                    {group.operator}
                                </span>
                            )}

                            <select
                                value={condition.property}
                                onChange={(e) => updateCondition(groupIndex, conditionIndex, {
                                    property: e.target.value,
                                })}
                                className={styles.propertySelect}
                            >
                                <option value="">Select property...</option>
                                {properties.map(prop => (
                                    <option key={prop.id} value={prop.system_name}>
                                        {prop.label}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={condition.operator}
                                onChange={(e) => updateCondition(groupIndex, conditionIndex, {
                                    operator: e.target.value,
                                })}
                                className={styles.operatorSelect}
                            >
                                <option value="equals">equals</option>
                                <option value="not_equals">does not equal</option>
                                <option value="greater_than">greater than</option>
                                <option value="less_than">less than</option>
                                <option value="contains">contains</option>
                                <option value="starts_with">starts with</option>
                                <option value="ends_with">ends with</option>
                                <option value="is_empty">is empty</option>
                                <option value="is_not_empty">is not empty</option>
                                <option value="changed">changed</option>
                                <option value="changed_to">changed to</option>
                                <option value="changed_from">changed from</option>
                            </select>

                            {!['is_empty', 'is_not_empty', 'changed'].includes(condition.operator) && (
                                <input
                                    type="text"
                                    value={condition.value}
                                    onChange={(e) => updateCondition(groupIndex, conditionIndex, {
                                        value: e.target.value,
                                    })}
                                    className={styles.valueInput}
                                    placeholder="Value"
                                />
                            )}

                            <button
                                onClick={() => {
                                    const newGroups = [...conditions.conditionGroups];
                                    newGroups[groupIndex].conditions.splice(conditionIndex, 1);
                                    onChange({ ...conditions, conditionGroups: newGroups });
                                }}
                                className={styles.removeButton}
                            >
                                Remove
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={() => addCondition(groupIndex)}
                        className={styles.addConditionButton}
                    >
                        + Add Condition
                    </button>
                </div>
            ))}

            <button onClick={addConditionGroup} className={styles.addGroupButton}>
                + Add Condition Group
            </button>
        </div>
    );
};
```

### 3. Styling with CSS Custom Properties

```css
/* src/components/automation/RuleBuilder/RuleBuilder.module.css */

.ruleBuilder {
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    padding: var(--hw-spacing-6);
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--hw-spacing-6);
    padding-bottom: var(--hw-spacing-4);
    border-bottom: 1px solid var(--hw-border-subtle);
}

.ruleName {
    flex: 1;
    font-size: var(--hw-font-size-xl);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-text-primary);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--hw-spacing-2);
    transition: border-color 0.2s;
}

.ruleName:focus {
    outline: none;
    border-bottom-color: var(--hw-accent-primary);
}

.saveButton {
    background: var(--hw-accent-primary);
    color: var(--hw-text-on-accent);
    padding: var(--hw-spacing-3) var(--hw-spacing-6);
    border: none;
    border-radius: var(--hw-radius-md);
    font-weight: var(--hw-font-weight-medium);
    cursor: pointer;
    transition: background-color 0.2s;
}

.saveButton:hover {
    background: var(--hw-accent-hover);
}

.configuration {
    display: flex;
    flex-direction: column;
    gap: var(--hw-spacing-6);
}

.configSection {
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-subtle);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-4);
}

.configSection label {
    display: block;
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-text-secondary);
    margin-bottom: var(--hw-spacing-2);
}

.configSection select {
    width: 100%;
    padding: var(--hw-spacing-2) var(--hw-spacing-3);
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-md);
    margin-bottom: var(--hw-spacing-3);
}

.visualFlow {
    margin-top: var(--hw-spacing-8);
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-subtle);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-4);
    height: 400px;
}

.flowCanvas {
    background: var(--hw-surface-primary);
    border-radius: var(--hw-radius-sm);
}
```

---

## API Specifications

### REST API Endpoints

#### Business Rules

```
POST   /api/v1/instances/:instanceId/business-rules
GET    /api/v1/instances/:instanceId/business-rules
GET    /api/v1/instances/:instanceId/business-rules/:ruleId
PUT    /api/v1/instances/:instanceId/business-rules/:ruleId
DELETE /api/v1/instances/:instanceId/business-rules/:ruleId
POST   /api/v1/instances/:instanceId/business-rules/:ruleId/test
POST   /api/v1/instances/:instanceId/business-rules/:ruleId/activate
POST   /api/v1/instances/:instanceId/business-rules/:ruleId/deactivate
GET    /api/v1/instances/:instanceId/business-rules/:ruleId/execution-logs
```

#### Scheduled Jobs

```
POST   /api/v1/instances/:instanceId/scheduled-jobs
GET    /api/v1/instances/:instanceId/scheduled-jobs
GET    /api/v1/instances/:instanceId/scheduled-jobs/:jobId
PUT    /api/v1/instances/:instanceId/scheduled-jobs/:jobId
DELETE /api/v1/instances/:instanceId/scheduled-jobs/:jobId
POST   /api/v1/instances/:instanceId/scheduled-jobs/:jobId/run-now
GET    /api/v1/instances/:instanceId/scheduled-jobs/:jobId/execution-history
```

#### Validation Rules

```
POST   /api/v1/instances/:instanceId/validation-rules
GET    /api/v1/instances/:instanceId/validation-rules
GET    /api/v1/instances/:instanceId/validation-rules/:ruleId
PUT    /api/v1/instances/:instanceId/validation-rules/:ruleId
DELETE /api/v1/instances/:instanceId/validation-rules/:ruleId
POST   /api/v1/instances/:instanceId/validation-rules/:ruleId/test
```

### GraphQL Schema

```graphql
type BusinessRule {
    id: ID!
    instanceId: ID!
    name: String!
    description: String
    collection: Collection!
    triggerType: TriggerType!
    triggerTiming: TriggerTiming!
    triggerConditions: TriggerConditions
    actions: [RuleAction!]!
    isActive: Boolean!
    executionOrder: Int!
    createdBy: User
    createdAt: DateTime!
    updatedAt: DateTime!
    lastExecutedAt: DateTime
    executionCount: Int!
}

enum TriggerType {
    INSERT
    UPDATE
    DELETE
    MANUAL
}

enum TriggerTiming {
    BEFORE
    AFTER
    ASYNC
}

type Mutation {
    createBusinessRule(input: CreateBusinessRuleInput!): BusinessRule!
    updateBusinessRule(id: ID!, input: UpdateBusinessRuleInput!): BusinessRule!
    deleteBusinessRule(id: ID!): Boolean!
    testBusinessRule(id: ID!, testData: JSON!): TestResult!
    activateBusinessRule(id: ID!): BusinessRule!
    deactivateBusinessRule(id: ID!): BusinessRule!
}

type Query {
    businessRules(instanceId: ID!, collectionId: ID): [BusinessRule!]!
    businessRule(id: ID!): BusinessRule
    businessRuleExecutionLogs(ruleId: ID!, limit: Int, offset: Int): [ExecutionLog!]!
}
```

---

## Performance Optimization

### 1. Rule Caching Strategy

```typescript
// Cache active rules by collection and trigger type
// Key format: rules:{instanceId}:{collectionId}:{triggerType}:{triggerTiming}
// TTL: 5 minutes

// Invalidate cache when:
// - Rule is created/updated/deleted
// - Rule is activated/deactivated
// - Collection schema changes
```

### 2. Database Indexing

```sql
-- Critical indexes for rule execution
CREATE INDEX CONCURRENTLY idx_business_rules_lookup
    ON business_rules(instance_id, collection_id, trigger_type, trigger_timing)
    WHERE is_active = true;

-- Index for execution logs with partitioning
CREATE INDEX CONCURRENTLY idx_execution_logs_recent
    ON rule_execution_logs(instance_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '30 days';
```

### 3. Async Execution

```typescript
// Execute non-critical rules asynchronously
// - After triggers (unless explicitly synchronous)
// - Rules marked as async
// - Rules that call external APIs
// - Rules that process large datasets

// Use Bull queue for async execution
await ruleQueue.add('execute-rule', {
    ruleId,
    recordId,
    instanceId,
}, {
    priority: rule.priority || 1,
    attempts: 3,
});
```

### 4. Batch Processing

```typescript
// For scheduled jobs processing many records
// Process in batches to avoid memory issues

const BATCH_SIZE = 100;
const records = await queryRecords(conditions);

for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(record => processRecord(record)));
}
```

---

## Security Considerations

### 1. Sandbox Execution

```typescript
// Execute rules in isolated VM context
// Prevent access to:
// - File system
// - Network (except approved APIs)
// - Process management
// - Other instances

import { VM } from 'vm2';

const vm = new VM({
    timeout: 30000, // 30 second timeout
    sandbox: {
        // Only provide safe context
        record: sanitizeRecord(record),
        helpers: safHelpers,
    },
});

const result = vm.run(compiledRule);
```

### 2. Resource Limits

```typescript
// Prevent resource exhaustion
const LIMITS = {
    MAX_EXECUTION_TIME: 30000, // 30 seconds
    MAX_MEMORY: 256 * 1024 * 1024, // 256 MB
    MAX_RULE_CHAIN_DEPTH: 5, // Prevent infinite loops
    MAX_ACTIONS_PER_RULE: 20,
    MAX_RECORDS_PER_JOB: 10000,
};
```

### 3. Audit Trail

```typescript
// Log all rule executions for compliance
// Include:
// - Who triggered the rule (user or system)
// - What data was accessed/modified
// - When it executed
// - Why it executed (which conditions were met)
// - Result (success/failure)

// Retain logs based on compliance requirements
// - 90 days for standard instances
// - 7 years for regulated industries (FINRA, SOX, etc.)
```

---

## Deployment Guidelines

### 1. Database Migrations

```bash
# Run migrations in order
npx prisma migrate deploy

# Verify migrations
npx prisma migrate status
```

### 2. Environment Variables

```bash
# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Bull queue configuration
BULL_CONCURRENCY=5
BULL_MAX_JOBS_PER_WORKER=100

# Rule execution limits
MAX_RULE_EXECUTION_TIME=30000
MAX_RULE_CHAIN_DEPTH=5
```

### 3. Monitoring

```yaml
# Prometheus metrics to monitor
- rule_executions_total (counter)
- rule_execution_duration_seconds (histogram)
- rule_execution_errors_total (counter)
- scheduled_job_runs_total (counter)
- scheduled_job_duration_seconds (histogram)
- active_rules_count (gauge)
- queued_jobs_count (gauge)
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Next Review:** Week 21 Sprint Planning
