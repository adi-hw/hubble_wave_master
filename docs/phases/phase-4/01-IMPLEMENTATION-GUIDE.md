# Phase 4: Implementation Guide

**Audience:** Backend Engineers, Integration Engineers, DevOps
**Prerequisites:** Phase 1, 2, 3 completed
**Estimated Effort:** 8 weeks (6 backend engineers)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Workflow Engine](#workflow-engine)
3. [State Machine Implementation](#state-machine-implementation)
4. [SLA Timer Service](#sla-timer-service)
5. [Notification Service](#notification-service)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Integration Details](#integration-details)
9. [Performance Optimization](#performance-optimization)
10. [Deployment & Monitoring](#deployment--monitoring)

---

## Architecture Overview

### System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                      HubbleWave Platform                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│   │   Frontend  │   │  API Gateway│   │   Backend   │          │
│   │   (React)   │──→│   (Express) │──→│  Services   │          │
│   └─────────────┘   └─────────────┘   └─────────────┘          │
│                                               │                  │
│   ┌───────────────────────────────────────────┘                 │
│   │                                                               │
│   │   ┌─────────────────┐   ┌──────────────────┐               │
│   ├──→│ Workflow Engine │   │ Notification Svc │               │
│   │   └─────────────────┘   └──────────────────┘               │
│   │                                  │                           │
│   │   ┌─────────────────┐   ┌──────────────────┐               │
│   ├──→│  SLA Service    │   │  State Machine   │               │
│   │   └─────────────────┘   └──────────────────┘               │
│   │                                                               │
│   │   ┌─────────────────────────────────────────┐               │
│   └──→│        PostgreSQL Database              │               │
│       └─────────────────────────────────────────┘               │
│                                                                   │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│   │   SendGrid   │   │    Twilio    │   │     FCM      │       │
│   │   (Email)    │   │    (SMS)     │   │   (Push)     │       │
│   └──────────────┘   └──────────────┘   └──────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- Node.js 20+ with TypeScript
- Express.js for API endpoints
- Bull Queue for job processing
- Redis for caching and queue storage
- Socket.io for real-time notifications

**Database:**
- PostgreSQL 15+ for primary data storage
- JSONB columns for flexible workflow definitions
- Partitioned tables for history/logs

**External Services:**
- SendGrid API for email delivery
- Twilio API for SMS delivery
- Firebase Cloud Messaging for push notifications

**Infrastructure:**
- Docker containers
- Kubernetes orchestration
- Horizontal pod autoscaling
- Load balancing

---

## Workflow Engine

### Core Components

#### 1. Workflow Definition Model

```typescript
// models/WorkflowDefinition.ts

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  table: string; // Target table (incident, request, etc.)
  active: boolean;
  version: number;

  // Visual designer data
  canvas: {
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
  };

  // Trigger configuration
  trigger: {
    type: 'record_created' | 'record_updated' | 'field_changed' | 'scheduled';
    conditions?: ConditionGroup;
    schedule?: CronExpression;
    filter?: RecordFilter;
  };

  // Metadata
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
}

interface WorkflowNode {
  id: string;
  type: 'start' | 'action' | 'approval' | 'condition' | 'wait' | 'end' | 'subflow';
  position: { x: number; y: number };
  config: NodeConfig;
}

interface WorkflowConnection {
  id: string;
  from_node: string;
  to_node: string;
  from_port?: string; // For conditional branches
  label?: string;
}

type NodeConfig =
  | ActionNodeConfig
  | ApprovalNodeConfig
  | ConditionNodeConfig
  | WaitNodeConfig
  | SubflowNodeConfig;

interface ActionNodeConfig {
  action: 'update_record' | 'create_record' | 'send_notification' | 'call_api';
  fields?: Record<string, any>;
  api_endpoint?: string;
  api_method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

interface ApprovalNodeConfig {
  approver_type: 'user' | 'group' | 'role' | 'dynamic';
  approver_id?: string;
  approver_field?: string; // For dynamic assignment
  approval_type: 'sequential' | 'parallel_any' | 'parallel_all';
  timeout_hours?: number;
  escalation?: {
    after_hours: number;
    action: 'notify_manager' | 'auto_approve' | 'auto_reject';
  };
}

interface ConditionNodeConfig {
  conditions: ConditionGroup;
  branches: {
    true_branch: string; // Node ID
    false_branch: string; // Node ID
  };
}

interface WaitNodeConfig {
  wait_type: 'duration' | 'field_change' | 'external_event';
  duration_hours?: number;
  field?: string;
  expected_value?: any;
  timeout_hours?: number;
}
```

#### 2. Workflow Execution Engine

```typescript
// services/WorkflowEngine.ts

class WorkflowEngine {
  private db: Database;
  private queue: Queue;
  private eventBus: EventBus;

  /**
   * Start a new workflow instance
   */
  async execute(
    workflowId: string,
    recordId: string,
    userId: string
  ): Promise<WorkflowInstance> {
    // Load workflow definition
    const workflow = await this.loadWorkflow(workflowId);

    // Create instance
    const instance = await this.createInstance(workflow, recordId, userId);

    // Find start node
    const startNode = workflow.canvas.nodes.find(n => n.type === 'start');
    if (!startNode) throw new Error('No start node found');

    // Begin execution
    await this.executeNode(instance, startNode);

    return instance;
  }

  /**
   * Execute a single workflow node
   */
  private async executeNode(
    instance: WorkflowInstance,
    node: WorkflowNode
  ): Promise<void> {
    // Log execution
    await this.logNodeExecution(instance.id, node.id, 'started');

    try {
      // Execute based on node type
      switch (node.type) {
        case 'action':
          await this.executeActionNode(instance, node);
          break;
        case 'approval':
          await this.executeApprovalNode(instance, node);
          return; // Pause until approval
        case 'condition':
          await this.executeConditionNode(instance, node);
          return; // Will branch to appropriate path
        case 'wait':
          await this.executeWaitNode(instance, node);
          return; // Pause until condition met
        case 'subflow':
          await this.executeSubflowNode(instance, node);
          break;
        case 'end':
          await this.completeWorkflow(instance);
          return;
      }

      // Find next node
      const nextNode = await this.getNextNode(instance, node);

      if (nextNode) {
        await this.executeNode(instance, nextNode);
      } else {
        // No more nodes, complete workflow
        await this.completeWorkflow(instance);
      }

      // Log success
      await this.logNodeExecution(instance.id, node.id, 'completed');

    } catch (error) {
      // Log error
      await this.logNodeExecution(instance.id, node.id, 'failed', error);

      // Handle error based on configuration
      await this.handleNodeError(instance, node, error);
    }
  }

  /**
   * Execute action node (update record, create record, etc.)
   */
  private async executeActionNode(
    instance: WorkflowInstance,
    node: WorkflowNode
  ): Promise<void> {
    const config = node.config as ActionNodeConfig;
    const record = await this.loadRecord(instance.record_id, instance.table);

    switch (config.action) {
      case 'update_record':
        await this.updateRecord(instance.record_id, config.fields, record);
        break;

      case 'create_record':
        const newRecord = await this.createRecord(config.fields, record);
        // Store created record ID in context
        instance.context[`${node.id}_created_record`] = newRecord.id;
        break;

      case 'send_notification':
        await this.sendNotification(config, record);
        break;

      case 'call_api':
        const response = await this.callExternalAPI(config, record);
        // Store response in context
        instance.context[`${node.id}_api_response`] = response;
        break;
    }

    // Update instance context
    await this.updateInstanceContext(instance);
  }

  /**
   * Execute approval node
   */
  private async executeApprovalNode(
    instance: WorkflowInstance,
    node: WorkflowNode
  ): Promise<void> {
    const config = node.config as ApprovalNodeConfig;

    // Determine approvers
    const approvers = await this.resolveApprovers(config, instance);

    // Create approval records
    const approvals = await Promise.all(
      approvers.map(approver => this.createApproval({
        workflow_instance_id: instance.id,
        node_id: node.id,
        approver_id: approver,
        status: 'pending',
        due_date: config.timeout_hours
          ? new Date(Date.now() + config.timeout_hours * 3600000)
          : null
      }))
    );

    // Send notification to approvers
    await this.notifyApprovers(approvals);

    // Set up timeout if configured
    if (config.timeout_hours) {
      await this.scheduleApprovalTimeout(
        instance.id,
        node.id,
        config.timeout_hours
      );
    }

    // Update instance state to waiting
    await this.updateInstanceState(instance.id, 'waiting_approval');
  }

  /**
   * Execute condition node (branching logic)
   */
  private async executeConditionNode(
    instance: WorkflowInstance,
    node: WorkflowNode
  ): Promise<void> {
    const config = node.config as ConditionNodeConfig;
    const record = await this.loadRecord(instance.record_id, instance.table);

    // Evaluate conditions
    const result = await this.evaluateConditions(config.conditions, record);

    // Get next node based on result
    const nextNodeId = result
      ? config.branches.true_branch
      : config.branches.false_branch;

    const nextNode = await this.getNodeById(instance.workflow_id, nextNodeId);

    // Continue execution
    await this.executeNode(instance, nextNode);
  }

  /**
   * Resume workflow after approval
   */
  async resumeAfterApproval(
    instanceId: string,
    nodeId: string,
    approved: boolean
  ): Promise<void> {
    const instance = await this.loadInstance(instanceId);
    const node = await this.getNodeById(instance.workflow_id, nodeId);

    if (approved) {
      // Continue to next node
      const nextNode = await this.getNextNode(instance, node);
      if (nextNode) {
        await this.executeNode(instance, nextNode);
      } else {
        await this.completeWorkflow(instance);
      }
    } else {
      // Rejected - end workflow
      await this.updateInstanceState(instance.id, 'rejected');
      await this.completeWorkflow(instance, 'rejected');
    }
  }

  /**
   * Evaluate condition group
   */
  private async evaluateConditions(
    conditionGroup: ConditionGroup,
    record: any
  ): Promise<boolean> {
    const results = await Promise.all(
      conditionGroup.conditions.map(async condition => {
        const fieldValue = this.getFieldValue(record, condition.field);
        return this.evaluateCondition(fieldValue, condition.operator, condition.value);
      })
    );

    // Combine results based on operator (AND/OR)
    return conditionGroup.operator === 'AND'
      ? results.every(r => r)
      : results.some(r => r);
  }

  private evaluateCondition(
    fieldValue: any,
    operator: string,
    targetValue: any
  ): boolean {
    switch (operator) {
      case '=': return fieldValue === targetValue;
      case '!=': return fieldValue !== targetValue;
      case '>': return fieldValue > targetValue;
      case '>=': return fieldValue >= targetValue;
      case '<': return fieldValue < targetValue;
      case '<=': return fieldValue <= targetValue;
      case 'contains': return String(fieldValue).includes(targetValue);
      case 'starts_with': return String(fieldValue).startsWith(targetValue);
      case 'ends_with': return String(fieldValue).endsWith(targetValue);
      case 'is_empty': return !fieldValue || fieldValue === '';
      case 'is_not_empty': return !!fieldValue && fieldValue !== '';
      default: return false;
    }
  }
}
```

#### 3. Trigger Manager

```typescript
// services/TriggerManager.ts

class TriggerManager {
  private db: Database;
  private eventBus: EventBus;
  private workflowEngine: WorkflowEngine;

  /**
   * Initialize trigger listeners
   */
  async initialize(): Promise<void> {
    // Listen to all record events
    this.eventBus.on('record.created', this.handleRecordCreated.bind(this));
    this.eventBus.on('record.updated', this.handleRecordUpdated.bind(this));

    // Initialize scheduled workflows
    await this.initializeScheduledWorkflows();
  }

  /**
   * Handle record created event
   */
  private async handleRecordCreated(event: RecordEvent): Promise<void> {
    // Find workflows triggered by record creation
    const workflows = await this.db.query(`
      SELECT * FROM workflow_definitions
      WHERE active = true
        AND table = $1
        AND trigger->>'type' = 'record_created'
    `, [event.table]);

    // Execute matching workflows
    for (const workflow of workflows) {
      // Check trigger conditions
      if (await this.checkTriggerConditions(workflow, event.record)) {
        await this.workflowEngine.execute(
          workflow.id,
          event.record.id,
          event.user_id
        );
      }
    }
  }

  /**
   * Handle record updated event
   */
  private async handleRecordUpdated(event: RecordEvent): Promise<void> {
    // Find workflows triggered by record update
    const workflows = await this.db.query(`
      SELECT * FROM workflow_definitions
      WHERE active = true
        AND table = $1
        AND trigger->>'type' IN ('record_updated', 'field_changed')
    `, [event.table]);

    for (const workflow of workflows) {
      // For field_changed triggers, check if specific field changed
      if (workflow.trigger.type === 'field_changed') {
        const field = workflow.trigger.filter?.field;
        if (!this.fieldChanged(event.previous, event.record, field)) {
          continue;
        }
      }

      // Check trigger conditions
      if (await this.checkTriggerConditions(workflow, event.record)) {
        await this.workflowEngine.execute(
          workflow.id,
          event.record.id,
          event.user_id
        );
      }
    }
  }

  /**
   * Initialize scheduled workflows (cron)
   */
  private async initializeScheduledWorkflows(): Promise<void> {
    const workflows = await this.db.query(`
      SELECT * FROM workflow_definitions
      WHERE active = true
        AND trigger->>'type' = 'scheduled'
    `);

    for (const workflow of workflows) {
      const schedule = workflow.trigger.schedule;

      // Register cron job
      cron.schedule(schedule, async () => {
        // Find records matching filter
        const records = await this.findRecords(
          workflow.table,
          workflow.trigger.filter
        );

        // Execute workflow for each record
        for (const record of records) {
          await this.workflowEngine.execute(
            workflow.id,
            record.id,
            'system'
          );
        }
      });
    }
  }
}
```

---

## State Machine Implementation

### State Machine Model

```typescript
// models/StateMachine.ts

interface StateMachineDefinition {
  id: string;
  name: string;
  table: string;
  state_field: string; // Field that holds current state

  states: State[];
  transitions: Transition[];

  created_at: Date;
  updated_at: Date;
}

interface State {
  id: string;
  name: string;
  display_name: string;
  is_initial: boolean;
  is_final: boolean;

  // Actions to perform when entering/exiting state
  on_entry?: Action[];
  on_exit?: Action[];

  // Metadata
  color?: string;
  order?: number;
}

interface Transition {
  id: string;
  from_state: string;
  to_state: string;
  name: string; // e.g., "Approve", "Reject", "Escalate"

  // Conditions that must be met
  conditions?: ConditionGroup;

  // Required role/permission
  required_role?: string;

  // Actions to perform during transition
  actions?: Action[];
}

interface Action {
  type: 'update_field' | 'send_notification' | 'create_record' | 'run_workflow';
  config: ActionConfig;
}
```

### State Machine Service

```typescript
// services/StateMachineService.ts

class StateMachineService {
  private db: Database;

  /**
   * Transition a record to a new state
   */
  async transition(
    recordId: string,
    table: string,
    transitionName: string,
    userId: string
  ): Promise<void> {
    // Load state machine definition
    const stateMachine = await this.loadStateMachine(table);

    // Load current record
    const record = await this.loadRecord(recordId, table);
    const currentState = record[stateMachine.state_field];

    // Find valid transition
    const transition = stateMachine.transitions.find(t =>
      t.from_state === currentState && t.name === transitionName
    );

    if (!transition) {
      throw new Error(`Invalid transition: ${transitionName} from ${currentState}`);
    }

    // Check user permissions
    if (transition.required_role) {
      const hasRole = await this.checkUserRole(userId, transition.required_role);
      if (!hasRole) {
        throw new Error('Insufficient permissions for this transition');
      }
    }

    // Check transition conditions
    if (transition.conditions) {
      const conditionsMet = await this.evaluateConditions(
        transition.conditions,
        record
      );
      if (!conditionsMet) {
        throw new Error('Transition conditions not met');
      }
    }

    // Begin transaction
    await this.db.transaction(async (trx) => {
      // Execute exit actions from current state
      const currentStateObj = stateMachine.states.find(s => s.id === currentState);
      if (currentStateObj?.on_exit) {
        await this.executeActions(currentStateObj.on_exit, record);
      }

      // Execute transition actions
      if (transition.actions) {
        await this.executeActions(transition.actions, record);
      }

      // Update record state
      await trx.query(`
        UPDATE ${table}
        SET ${stateMachine.state_field} = $1,
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $3
      `, [transition.to_state, userId, recordId]);

      // Execute entry actions for new state
      const newStateObj = stateMachine.states.find(s => s.id === transition.to_state);
      if (newStateObj?.on_entry) {
        await this.executeActions(newStateObj.on_entry, record);
      }

      // Log state change
      await trx.query(`
        INSERT INTO state_change_history
          (record_id, table_name, from_state, to_state, transition, user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [recordId, table, currentState, transition.to_state, transitionName, userId]);
    });

    // Emit state change event
    await this.eventBus.emit('state.changed', {
      record_id: recordId,
      table,
      from_state: currentState,
      to_state: transition.to_state,
      user_id: userId
    });
  }

  /**
   * Get allowed transitions for current state
   */
  async getAllowedTransitions(
    recordId: string,
    table: string,
    userId: string
  ): Promise<Transition[]> {
    const stateMachine = await this.loadStateMachine(table);
    const record = await this.loadRecord(recordId, table);
    const currentState = record[stateMachine.state_field];

    // Find transitions from current state
    const possibleTransitions = stateMachine.transitions.filter(
      t => t.from_state === currentState
    );

    // Filter by permissions and conditions
    const allowedTransitions = [];
    for (const transition of possibleTransitions) {
      // Check role
      if (transition.required_role) {
        const hasRole = await this.checkUserRole(userId, transition.required_role);
        if (!hasRole) continue;
      }

      // Check conditions
      if (transition.conditions) {
        const conditionsMet = await this.evaluateConditions(
          transition.conditions,
          record
        );
        if (!conditionsMet) continue;
      }

      allowedTransitions.push(transition);
    }

    return allowedTransitions;
  }
}
```

---

## SLA Timer Service

### SLA Models

```typescript
// models/SLA.ts

interface SLADefinition {
  id: string;
  name: string;
  table: string;
  sla_type: 'response' | 'resolution' | 'custom';

  // Target duration in minutes
  target_minutes: number;

  // Warning thresholds (percentage of target)
  warning_threshold_1?: number; // e.g., 75%
  warning_threshold_2?: number; // e.g., 90%

  // Business hours calendar
  business_hours_id?: string;

  // Conditions for this SLA to apply
  conditions?: ConditionGroup;

  // Pause conditions
  pause_conditions?: ConditionGroup;

  // Escalation actions
  escalations?: SLAEscalation[];

  active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface SLAInstance {
  id: string;
  sla_definition_id: string;
  record_id: string;
  table: string;

  // Timer state
  state: 'active' | 'paused' | 'completed' | 'breached';

  // Time tracking (in seconds)
  elapsed_seconds: number;
  remaining_seconds: number;
  target_seconds: number;

  // Timestamps
  start_time: Date;
  pause_time?: Date;
  complete_time?: Date;
  breach_time?: Date;
  target_time: Date; // When SLA will breach

  // Pause tracking
  total_pause_seconds: number;
  pause_count: number;

  // Warning tracking
  warning_1_sent: boolean;
  warning_2_sent: boolean;

  created_at: Date;
  updated_at: Date;
}

interface SLAEscalation {
  threshold_percent: number; // Trigger at X% of target
  actions: Action[];
}
```

### SLA Timer Service Implementation

```typescript
// services/SLATimerService.ts

class SLATimerService {
  private db: Database;
  private redis: Redis;
  private eventBus: EventBus;

  /**
   * Start SLA timer for a record
   */
  async startSLA(recordId: string, table: string): Promise<void> {
    // Find applicable SLA definitions
    const record = await this.loadRecord(recordId, table);
    const definitions = await this.findApplicableSLAs(table, record);

    for (const definition of definitions) {
      // Create SLA instance
      const targetSeconds = definition.target_minutes * 60;
      const targetTime = this.calculateTargetTime(
        new Date(),
        targetSeconds,
        definition.business_hours_id
      );

      await this.db.query(`
        INSERT INTO sla_instances
          (sla_definition_id, record_id, table_name, state,
           elapsed_seconds, remaining_seconds, target_seconds,
           start_time, target_time)
        VALUES ($1, $2, $3, 'active', 0, $4, $4, NOW(), $5)
      `, [definition.id, recordId, table, targetSeconds, targetTime]);

      // Schedule timer updates
      await this.scheduleTimerUpdates(recordId, definition.id);
    }
  }

  /**
   * Pause SLA timer
   */
  async pauseSLA(instanceId: string): Promise<void> {
    await this.db.query(`
      UPDATE sla_instances
      SET state = 'paused',
          pause_time = NOW(),
          pause_count = pause_count + 1
      WHERE id = $1 AND state = 'active'
    `, [instanceId]);

    // Cancel scheduled updates
    await this.cancelTimerUpdates(instanceId);
  }

  /**
   * Resume SLA timer
   */
  async resumeSLA(instanceId: string): Promise<void> {
    const instance = await this.loadInstance(instanceId);

    // Calculate pause duration
    const pauseDuration = Date.now() - instance.pause_time.getTime();
    const pauseSeconds = Math.floor(pauseDuration / 1000);

    // Update target time
    const newTargetTime = new Date(
      instance.target_time.getTime() + pauseDuration
    );

    await this.db.query(`
      UPDATE sla_instances
      SET state = 'active',
          pause_time = NULL,
          total_pause_seconds = total_pause_seconds + $1,
          target_time = $2
      WHERE id = $3
    `, [pauseSeconds, newTargetTime, instanceId]);

    // Resume timer updates
    await this.scheduleTimerUpdates(
      instance.record_id,
      instance.sla_definition_id
    );
  }

  /**
   * Complete SLA timer
   */
  async completeSLA(instanceId: string): Promise<void> {
    const instance = await this.loadInstance(instanceId);

    await this.db.query(`
      UPDATE sla_instances
      SET state = 'completed',
          complete_time = NOW()
      WHERE id = $1
    `, [instanceId]);

    // Cancel scheduled updates
    await this.cancelTimerUpdates(instanceId);

    // Record success
    if (instance.state !== 'breached') {
      await this.recordSLASuccess(instance);
    }
  }

  /**
   * Update timer (called by background job)
   */
  async updateTimer(instanceId: string): Promise<void> {
    const instance = await this.loadInstance(instanceId);

    if (instance.state !== 'active') return;

    // Calculate elapsed time
    const now = new Date();
    const elapsedMs = now.getTime() - instance.start_time.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000) - instance.total_pause_seconds;
    const remainingSeconds = instance.target_seconds - elapsedSeconds;

    // Update instance
    await this.db.query(`
      UPDATE sla_instances
      SET elapsed_seconds = $1,
          remaining_seconds = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [elapsedSeconds, remainingSeconds, instanceId]);

    // Check for breach
    if (remainingSeconds <= 0 && instance.state !== 'breached') {
      await this.handleSLABreach(instance);
      return;
    }

    // Check for warning thresholds
    const definition = await this.loadDefinition(instance.sla_definition_id);
    const percentElapsed = (elapsedSeconds / instance.target_seconds) * 100;

    if (!instance.warning_1_sent && definition.warning_threshold_1) {
      if (percentElapsed >= definition.warning_threshold_1) {
        await this.sendWarningNotification(instance, definition, 1);
        await this.db.query(`
          UPDATE sla_instances SET warning_1_sent = true WHERE id = $1
        `, [instanceId]);
      }
    }

    if (!instance.warning_2_sent && definition.warning_threshold_2) {
      if (percentElapsed >= definition.warning_threshold_2) {
        await this.sendWarningNotification(instance, definition, 2);
        await this.db.query(`
          UPDATE sla_instances SET warning_2_sent = true WHERE id = $1
        `, [instanceId]);
      }
    }

    // Execute escalations if configured
    if (definition.escalations) {
      for (const escalation of definition.escalations) {
        if (percentElapsed >= escalation.threshold_percent) {
          await this.executeEscalation(instance, escalation);
        }
      }
    }
  }

  /**
   * Handle SLA breach
   */
  private async handleSLABreach(instance: SLAInstance): Promise<void> {
    // Update instance state
    await this.db.query(`
      UPDATE sla_instances
      SET state = 'breached',
          breach_time = NOW()
      WHERE id = $1
    `, [instance.id]);

    // Record breach
    await this.db.query(`
      INSERT INTO sla_breaches
        (sla_instance_id, sla_definition_id, record_id, table_name,
         target_seconds, elapsed_seconds, breach_amount_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      instance.id,
      instance.sla_definition_id,
      instance.record_id,
      instance.table,
      instance.target_seconds,
      instance.elapsed_seconds,
      instance.elapsed_seconds - instance.target_seconds
    ]);

    // Send breach notification
    await this.sendBreachNotification(instance);

    // Emit breach event
    await this.eventBus.emit('sla.breached', {
      instance_id: instance.id,
      record_id: instance.record_id,
      table: instance.table
    });
  }

  /**
   * Calculate target time accounting for business hours
   */
  private calculateTargetTime(
    startTime: Date,
    targetSeconds: number,
    businessHoursId?: string
  ): Date {
    if (!businessHoursId) {
      // Simple calculation: just add seconds
      return new Date(startTime.getTime() + targetSeconds * 1000);
    }

    // Load business hours calendar
    const calendar = await this.loadBusinessHours(businessHoursId);

    // Calculate target time accounting for business hours
    return this.calculateBusinessHoursTarget(startTime, targetSeconds, calendar);
  }

  /**
   * Schedule periodic timer updates
   */
  private async scheduleTimerUpdates(
    recordId: string,
    slaDefinitionId: string
  ): Promise<void> {
    // Use Bull queue for reliable job scheduling
    await this.queue.add('sla-timer-update', {
      record_id: recordId,
      sla_definition_id: slaDefinitionId
    }, {
      repeat: {
        every: 30000 // Update every 30 seconds
      }
    });
  }
}
```

---

## Notification Service

### Notification Models

```typescript
// models/Notification.ts

interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  category: string; // assignment, approval, sla_warning, etc.

  // Channel-specific content
  email?: EmailTemplate;
  sms?: SMSTemplate;
  push?: PushTemplate;
  in_app?: InAppTemplate;

  // Variables available in template
  variables: TemplateVariable[];

  active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface EmailTemplate {
  subject: string;
  body_html: string;
  body_text: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
}

interface SMSTemplate {
  body: string; // Max 160 characters
  short_link?: boolean; // Use link shortener
}

interface PushTemplate {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  sound?: string;
  actions?: PushAction[];
}

interface InAppTemplate {
  title: string;
  body: string;
  icon?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actions?: InAppAction[];
  deep_link?: string;
}

interface NotificationQueue {
  id: string;
  template_id: string;
  recipient_id: string;
  channels: ('email' | 'sms' | 'push' | 'in_app')[];

  // Context data for variable substitution
  context: Record<string, any>;

  // Scheduling
  scheduled_for?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Status
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  max_attempts: number;

  created_at: Date;
  updated_at: Date;
}

interface NotificationHistory {
  id: string;
  notification_queue_id: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  recipient_id: string;

  // Delivery tracking
  sent_at?: Date;
  delivered_at?: Date;
  opened_at?: Date;
  clicked_at?: Date;
  failed_at?: Date;
  error_message?: string;

  // Provider response
  provider_id?: string; // SendGrid message ID, etc.
  provider_response?: any;

  created_at: Date;
}
```

### Notification Service Implementation

```typescript
// services/NotificationService.ts

class NotificationService {
  private db: Database;
  private queue: Queue;
  private templateEngine: TemplateEngine;
  private sendgrid: SendGridService;
  private twilio: TwilioService;
  private fcm: FCMService;
  private socketio: SocketIO;

  /**
   * Send notification
   */
  async send(
    templateId: string,
    recipientId: string,
    context: Record<string, any>,
    options?: {
      channels?: ('email' | 'sms' | 'push' | 'in_app')[];
      scheduledFor?: Date;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    }
  ): Promise<string> {
    // Load template and recipient
    const template = await this.loadTemplate(templateId);
    const recipient = await this.loadUser(recipientId);

    // Determine channels based on user preferences
    let channels = options?.channels;
    if (!channels) {
      channels = await this.getPreferredChannels(
        recipientId,
        template.category
      );
    }

    // Check quiet hours
    if (await this.isQuietHours(recipientId)) {
      // Defer non-urgent notifications
      if (!options?.priority || options.priority !== 'urgent') {
        options = options || {};
        options.scheduledFor = await this.getNextActiveHours(recipientId);
      }
    }

    // Create notification queue entry
    const queueEntry = await this.db.query(`
      INSERT INTO notification_queue
        (template_id, recipient_id, channels, context, scheduled_for, priority, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id
    `, [
      templateId,
      recipientId,
      JSON.stringify(channels),
      JSON.stringify(context),
      options?.scheduledFor || null,
      options?.priority || 'medium'
    ]);

    const notificationId = queueEntry.rows[0].id;

    // Add to processing queue
    await this.queue.add('process-notification', {
      notification_id: notificationId
    }, {
      delay: options?.scheduledFor
        ? options.scheduledFor.getTime() - Date.now()
        : 0,
      priority: this.getPriorityScore(options?.priority || 'medium')
    });

    return notificationId;
  }

  /**
   * Process notification (worker function)
   */
  async processNotification(notificationId: string): Promise<void> {
    const notification = await this.loadNotification(notificationId);
    const template = await this.loadTemplate(notification.template_id);
    const recipient = await this.loadUser(notification.recipient_id);

    // Render templates for each channel
    const renderedContent: Record<string, any> = {};

    for (const channel of notification.channels) {
      try {
        renderedContent[channel] = await this.renderTemplate(
          template[channel],
          notification.context
        );
      } catch (error) {
        console.error(`Failed to render ${channel} template:`, error);
        continue;
      }
    }

    // Send via each channel
    const results = await Promise.allSettled(
      notification.channels.map(async (channel) => {
        const content = renderedContent[channel];
        if (!content) return;

        switch (channel) {
          case 'email':
            return await this.sendEmail(recipient, content, notification.id);
          case 'sms':
            return await this.sendSMS(recipient, content, notification.id);
          case 'push':
            return await this.sendPush(recipient, content, notification.id);
          case 'in_app':
            return await this.sendInApp(recipient, content, notification.id);
        }
      })
    );

    // Check if at least one channel succeeded
    const anySuccess = results.some(r => r.status === 'fulfilled');

    if (anySuccess) {
      await this.db.query(`
        UPDATE notification_queue
        SET status = 'sent', updated_at = NOW()
        WHERE id = $1
      `, [notificationId]);
    } else {
      // All channels failed - retry or mark as failed
      await this.handleNotificationFailure(notification);
    }
  }

  /**
   * Send email via SendGrid
   */
  private async sendEmail(
    recipient: User,
    content: EmailTemplate,
    notificationId: string
  ): Promise<void> {
    try {
      const response = await this.sendgrid.send({
        to: recipient.email,
        from: {
          email: content.from_email || 'notifications@hubblewave.com',
          name: content.from_name || 'HubbleWave'
        },
        replyTo: content.reply_to,
        subject: content.subject,
        text: content.body_text,
        html: content.body_html,
        customArgs: {
          notification_id: notificationId,
          user_id: recipient.id
        },
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      });

      // Record success
      await this.recordDelivery({
        notification_queue_id: notificationId,
        channel: 'email',
        recipient_id: recipient.id,
        sent_at: new Date(),
        provider_id: response.messageId,
        provider_response: response
      });

    } catch (error) {
      // Record failure
      await this.recordDelivery({
        notification_queue_id: notificationId,
        channel: 'email',
        recipient_id: recipient.id,
        failed_at: new Date(),
        error_message: error.message,
        provider_response: error
      });

      throw error;
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendSMS(
    recipient: User,
    content: SMSTemplate,
    notificationId: string
  ): Promise<void> {
    if (!recipient.phone) {
      throw new Error('Recipient has no phone number');
    }

    try {
      const message = await this.twilio.messages.create({
        to: recipient.phone,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: content.body,
        statusCallback: `${process.env.API_URL}/api/webhooks/twilio/status`
      });

      // Record success
      await this.recordDelivery({
        notification_queue_id: notificationId,
        channel: 'sms',
        recipient_id: recipient.id,
        sent_at: new Date(),
        provider_id: message.sid,
        provider_response: message
      });

    } catch (error) {
      await this.recordDelivery({
        notification_queue_id: notificationId,
        channel: 'sms',
        recipient_id: recipient.id,
        failed_at: new Date(),
        error_message: error.message,
        provider_response: error
      });

      throw error;
    }
  }

  /**
   * Send push notification via FCM
   */
  private async sendPush(
    recipient: User,
    content: PushTemplate,
    notificationId: string
  ): Promise<void> {
    // Get user's device tokens
    const tokens = await this.getUserDeviceTokens(recipient.id);

    if (tokens.length === 0) {
      throw new Error('Recipient has no registered devices');
    }

    try {
      const response = await this.fcm.sendMulticast({
        tokens,
        notification: {
          title: content.title,
          body: content.body,
          icon: content.icon,
          badge: content.badge
        },
        data: {
          notification_id: notificationId,
          deep_link: content.deep_link || ''
        },
        android: {
          priority: 'high',
          notification: {
            sound: content.sound || 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: content.sound || 'default',
              badge: parseInt(content.badge || '0')
            }
          }
        }
      });

      // Record success
      await this.recordDelivery({
        notification_queue_id: notificationId,
        channel: 'push',
        recipient_id: recipient.id,
        sent_at: new Date(),
        provider_response: response
      });

    } catch (error) {
      await this.recordDelivery({
        notification_queue_id: notificationId,
        channel: 'push',
        recipient_id: recipient.id,
        failed_at: new Date(),
        error_message: error.message,
        provider_response: error
      });

      throw error;
    }
  }

  /**
   * Send in-app notification via WebSocket
   */
  private async sendInApp(
    recipient: User,
    content: InAppTemplate,
    notificationId: string
  ): Promise<void> {
    try {
      // Store in database
      const notification = await this.db.query(`
        INSERT INTO in_app_notifications
          (user_id, title, body, icon, priority, actions, deep_link, read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, false)
        RETURNING *
      `, [
        recipient.id,
        content.title,
        content.body,
        content.icon,
        content.priority,
        JSON.stringify(content.actions || []),
        content.deep_link
      ]);

      // Send via WebSocket if user is online
      this.socketio.to(`user:${recipient.id}`).emit('notification', {
        id: notification.rows[0].id,
        title: content.title,
        body: content.body,
        icon: content.icon,
        priority: content.priority,
        actions: content.actions,
        deep_link: content.deep_link,
        timestamp: new Date()
      });

      // Record success
      await this.recordDelivery({
        notification_queue_id: notificationId,
        channel: 'in_app',
        recipient_id: recipient.id,
        sent_at: new Date(),
        delivered_at: new Date() // In-app is instant
      });

    } catch (error) {
      await this.recordDelivery({
        notification_queue_id: notificationId,
        channel: 'in_app',
        recipient_id: recipient.id,
        failed_at: new Date(),
        error_message: error.message
      });

      throw error;
    }
  }

  /**
   * Render template with variable substitution
   */
  private async renderTemplate(
    template: any,
    context: Record<string, any>
  ): Promise<any> {
    // Use Handlebars for template rendering
    const rendered = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string') {
        const compiledTemplate = Handlebars.compile(value);
        rendered[key] = compiledTemplate(context);
      } else {
        rendered[key] = value;
      }
    }

    return rendered;
  }
}
```

---

## Database Schema

```sql
-- Workflow Definitions
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  table_name VARCHAR(100) NOT NULL,
  active BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  canvas JSONB NOT NULL, -- Nodes and connections
  trigger JSONB NOT NULL, -- Trigger configuration
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_definitions_table ON workflow_definitions(table_name) WHERE active = true;
CREATE INDEX idx_workflow_definitions_trigger ON workflow_definitions USING gin(trigger);

-- Workflow Instances
CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflow_definitions(id),
  record_id UUID NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  state VARCHAR(50) DEFAULT 'running', -- running, waiting_approval, completed, failed, cancelled
  current_node_id VARCHAR(100),
  context JSONB DEFAULT '{}', -- Runtime variables
  error_message TEXT,
  started_by UUID REFERENCES users(id),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_instances_workflow ON workflow_instances(workflow_id);
CREATE INDEX idx_workflow_instances_record ON workflow_instances(table_name, record_id);
CREATE INDEX idx_workflow_instances_state ON workflow_instances(state);

-- Workflow History (audit log)
CREATE TABLE workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  node_type VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL, -- started, completed, failed
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_history_instance ON workflow_history(instance_id, created_at DESC);

-- Approvals
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID REFERENCES workflow_instances(id),
  node_id VARCHAR(100) NOT NULL,
  approver_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, delegated
  comments TEXT,
  due_date TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  delegated_to UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_approvals_approver ON approvals(approver_id, status);
CREATE INDEX idx_approvals_workflow ON approvals(workflow_instance_id);

-- State Machine Definitions
CREATE TABLE state_machine_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  table_name VARCHAR(100) NOT NULL UNIQUE,
  state_field VARCHAR(100) NOT NULL,
  states JSONB NOT NULL,
  transitions JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- State Change History
CREATE TABLE state_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  from_state VARCHAR(100),
  to_state VARCHAR(100) NOT NULL,
  transition VARCHAR(100),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_state_change_history_record ON state_change_history(table_name, record_id, created_at DESC);

-- SLA Definitions
CREATE TABLE sla_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  sla_type VARCHAR(50) NOT NULL, -- response, resolution, custom
  target_minutes INTEGER NOT NULL,
  warning_threshold_1 INTEGER, -- percentage
  warning_threshold_2 INTEGER, -- percentage
  business_hours_id UUID REFERENCES business_hours(id),
  conditions JSONB,
  pause_conditions JSONB,
  escalations JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sla_definitions_table ON sla_definitions(table_name) WHERE active = true;

-- SLA Instances
CREATE TABLE sla_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_definition_id UUID REFERENCES sla_definitions(id),
  record_id UUID NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  state VARCHAR(50) DEFAULT 'active', -- active, paused, completed, breached
  elapsed_seconds INTEGER DEFAULT 0,
  remaining_seconds INTEGER NOT NULL,
  target_seconds INTEGER NOT NULL,
  start_time TIMESTAMP NOT NULL,
  pause_time TIMESTAMP,
  complete_time TIMESTAMP,
  breach_time TIMESTAMP,
  target_time TIMESTAMP NOT NULL,
  total_pause_seconds INTEGER DEFAULT 0,
  pause_count INTEGER DEFAULT 0,
  warning_1_sent BOOLEAN DEFAULT false,
  warning_2_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sla_instances_record ON sla_instances(table_name, record_id);
CREATE INDEX idx_sla_instances_state ON sla_instances(state);
CREATE INDEX idx_sla_instances_target ON sla_instances(target_time) WHERE state = 'active';

-- SLA Breaches
CREATE TABLE sla_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_instance_id UUID REFERENCES sla_instances(id),
  sla_definition_id UUID REFERENCES sla_definitions(id),
  record_id UUID NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  target_seconds INTEGER NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  breach_amount_seconds INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sla_breaches_record ON sla_breaches(table_name, record_id);
CREATE INDEX idx_sla_breaches_created ON sla_breaches(created_at DESC);

-- Notification Templates
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- assignment, approval, sla_warning, etc.
  email JSONB,
  sms JSONB,
  push JSONB,
  in_app JSONB,
  variables JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_templates_category ON notification_templates(category) WHERE active = true;

-- Notification Queue
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES notification_templates(id),
  recipient_id UUID REFERENCES users(id),
  channels JSONB NOT NULL, -- array of channels
  context JSONB NOT NULL,
  scheduled_for TIMESTAMP,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, cancelled
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_status ON notification_queue(status, scheduled_for);
CREATE INDEX idx_notification_queue_recipient ON notification_queue(recipient_id);

-- Notification History
CREATE TABLE notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_queue_id UUID REFERENCES notification_queue(id),
  channel VARCHAR(20) NOT NULL,
  recipient_id UUID REFERENCES users(id),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  provider_id VARCHAR(255),
  provider_response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_history_queue ON notification_history(notification_queue_id);
CREATE INDEX idx_notification_history_recipient ON notification_history(recipient_id, sent_at DESC);

-- In-App Notifications
CREATE TABLE in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  icon VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'medium',
  actions JSONB,
  deep_link VARCHAR(500),
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_in_app_notifications_user ON in_app_notifications(user_id, read, created_at DESC);

-- User Notification Preferences
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  preferences JSONB NOT NULL, -- channel preferences by category
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone VARCHAR(50),
  digest_mode BOOLEAN DEFAULT false,
  digest_frequency VARCHAR(20), -- daily, weekly
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Business Hours
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  schedule JSONB NOT NULL, -- weekly schedule
  holidays JSONB, -- holiday dates
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Workflow APIs

```typescript
// POST /api/workflows/definitions
// Create workflow definition
POST /api/workflows/definitions
{
  "name": "Incident Assignment Workflow",
  "table": "incident",
  "trigger": {
    "type": "record_created",
    "conditions": { ... }
  },
  "canvas": {
    "nodes": [ ... ],
    "connections": [ ... ]
  }
}

// GET /api/workflows/definitions
// List workflows
GET /api/workflows/definitions?table=incident&active=true

// PUT /api/workflows/definitions/:id
// Update workflow
PUT /api/workflows/definitions/:id

// POST /api/workflows/definitions/:id/activate
// Activate workflow
POST /api/workflows/definitions/:id/activate

// POST /api/workflows/definitions/:id/test
// Test workflow with sample data
POST /api/workflows/definitions/:id/test

// GET /api/workflows/instances
// List workflow instances
GET /api/workflows/instances?record_id=xxx&state=running

// GET /api/workflows/instances/:id
// Get instance details
GET /api/workflows/instances/:id

// GET /api/workflows/instances/:id/history
// Get execution history
GET /api/workflows/instances/:id/history

// POST /api/workflows/instances/:id/cancel
// Cancel running workflow
POST /api/workflows/instances/:id/cancel
```

### Approval APIs

```typescript
// GET /api/approvals/pending
// Get pending approvals for current user
GET /api/approvals/pending

// GET /api/approvals/:id
// Get approval details
GET /api/approvals/:id

// POST /api/approvals/:id/approve
// Approve
POST /api/approvals/:id/approve
{
  "comments": "Approved for deployment"
}

// POST /api/approvals/:id/reject
// Reject
POST /api/approvals/:id/reject
{
  "comments": "Missing required documentation"
}

// POST /api/approvals/:id/delegate
// Delegate to another user
POST /api/approvals/:id/delegate
{
  "delegated_to": "user-id",
  "comments": "Delegating while on vacation"
}
```

### SLA APIs

```typescript
// GET /api/sla/definitions
// List SLA definitions
GET /api/sla/definitions?table=incident

// POST /api/sla/definitions
// Create SLA definition
POST /api/sla/definitions

// GET /api/sla/instances
// Get SLA instances for record
GET /api/sla/instances?record_id=xxx

// POST /api/sla/instances/:id/pause
// Pause SLA timer
POST /api/sla/instances/:id/pause

// POST /api/sla/instances/:id/resume
// Resume SLA timer
POST /api/sla/instances/:id/resume

// GET /api/sla/breaches
// List SLA breaches
GET /api/sla/breaches?from=2025-01-01&to=2025-01-31

// GET /api/sla/metrics
// Get SLA compliance metrics
GET /api/sla/metrics?table=incident&period=last_30_days
```

### Notification APIs

```typescript
// POST /api/notifications/send
// Send notification
POST /api/notifications/send
{
  "template_id": "xxx",
  "recipient_id": "xxx",
  "context": { ... },
  "channels": ["email", "push"]
}

// GET /api/notifications/templates
// List templates
GET /api/notifications/templates?category=assignment

// POST /api/notifications/templates
// Create template
POST /api/notifications/templates

// GET /api/notifications/history
// Get notification history
GET /api/notifications/history?recipient_id=xxx

// GET /api/notifications/in-app
// Get in-app notifications
GET /api/notifications/in-app?read=false

// PUT /api/notifications/in-app/:id/read
// Mark as read
PUT /api/notifications/in-app/:id/read

// GET /api/notifications/preferences
// Get user preferences
GET /api/notifications/preferences

// PUT /api/notifications/preferences
// Update preferences
PUT /api/notifications/preferences
{
  "preferences": {
    "assignment": ["email", "in_app"],
    "approval": ["email", "sms", "push"]
  },
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00"
}
```

---

## Integration Details

### SendGrid Integration

```typescript
// config/sendgrid.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Webhook handler for email events
app.post('/api/webhooks/sendgrid', async (req, res) => {
  const events = req.body;

  for (const event of events) {
    const notificationId = event.notification_id;

    switch (event.event) {
      case 'delivered':
        await db.query(`
          UPDATE notification_history
          SET delivered_at = $1
          WHERE provider_id = $2
        `, [new Date(event.timestamp * 1000), event.sg_message_id]);
        break;

      case 'open':
        await db.query(`
          UPDATE notification_history
          SET opened_at = $1
          WHERE provider_id = $2 AND opened_at IS NULL
        `, [new Date(event.timestamp * 1000), event.sg_message_id]);
        break;

      case 'click':
        await db.query(`
          UPDATE notification_history
          SET clicked_at = $1
          WHERE provider_id = $2 AND clicked_at IS NULL
        `, [new Date(event.timestamp * 1000), event.sg_message_id]);
        break;

      case 'bounce':
      case 'dropped':
        await db.query(`
          UPDATE notification_history
          SET failed_at = $1, error_message = $2
          WHERE provider_id = $3
        `, [new Date(event.timestamp * 1000), event.reason, event.sg_message_id]);
        break;
    }
  }

  res.sendStatus(200);
});
```

### Twilio Integration

```typescript
// config/twilio.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Webhook handler for SMS status
app.post('/api/webhooks/twilio/status', async (req, res) => {
  const { MessageSid, MessageStatus, ErrorCode } = req.body;

  switch (MessageStatus) {
    case 'delivered':
      await db.query(`
        UPDATE notification_history
        SET delivered_at = NOW()
        WHERE provider_id = $1
      `, [MessageSid]);
      break;

    case 'failed':
    case 'undelivered':
      await db.query(`
        UPDATE notification_history
        SET failed_at = NOW(), error_message = $1
        WHERE provider_id = $2
      `, [`Error code: ${ErrorCode}`, MessageSid]);
      break;
  }

  res.sendStatus(200);
});
```

### Firebase Cloud Messaging

```typescript
// config/fcm.ts
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )
});

// Handle token registration
app.post('/api/device-tokens', async (req, res) => {
  const { user_id, token, platform } = req.body;

  await db.query(`
    INSERT INTO device_tokens (user_id, token, platform, active)
    VALUES ($1, $2, $3, true)
    ON CONFLICT (token)
    DO UPDATE SET active = true, updated_at = NOW()
  `, [user_id, token, platform]);

  res.sendStatus(201);
});

// Handle token unregistration
app.delete('/api/device-tokens/:token', async (req, res) => {
  await db.query(`
    UPDATE device_tokens
    SET active = false
    WHERE token = $1
  `, [req.params.token]);

  res.sendStatus(204);
});
```

---

## Performance Optimization

### Workflow Engine Optimization

1. **Parallel Execution**: Execute independent nodes in parallel
2. **Connection Pooling**: Reuse database connections
3. **Caching**: Cache workflow definitions in Redis
4. **Queue Batching**: Process multiple workflows in batches
5. **Horizontal Scaling**: Run multiple workflow engine instances

### SLA Timer Optimization

1. **Batch Updates**: Update multiple timers in single query
2. **Partitioned Tables**: Partition sla_instances by month
3. **Indexed Queries**: Ensure all queries use appropriate indexes
4. **Background Jobs**: Use Bull queue for timer updates
5. **Timer Reconciliation**: Periodic job to fix any timer drift

### Notification Optimization

1. **Queue Prioritization**: High-priority notifications first
2. **Batch Sending**: Send multiple emails/SMS in batch requests
3. **Template Caching**: Cache compiled templates
4. **Rate Limiting**: Respect provider rate limits
5. **Retry Strategy**: Exponential backoff for failed deliveries

---

## Deployment & Monitoring

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Redis instance running
- [ ] Bull queue workers running
- [ ] SendGrid API key configured and verified
- [ ] Twilio credentials configured and verified
- [ ] Firebase service account configured
- [ ] Webhook endpoints publicly accessible
- [ ] SSL certificates installed
- [ ] Load balancer configured
- [ ] Auto-scaling rules configured
- [ ] Monitoring dashboards created
- [ ] Alerts configured

### Monitoring Metrics

**Workflow Engine:**
- Workflow executions per minute
- Average execution time
- Error rate
- Queue depth
- Active instances count

**SLA Service:**
- Active SLA timers count
- Timer accuracy (drift)
- Breach rate
- Warning delivery rate

**Notification Service:**
- Notifications sent per minute
- Delivery success rate by channel
- Average delivery time
- Queue depth
- Provider API errors

### Logging

Use structured logging with these fields:
- `service`: workflow-engine, sla-service, notification-service
- `operation`: execute, update, send, etc.
- `record_id`: Affected record
- `user_id`: User performing action
- `duration_ms`: Operation duration
- `error`: Error message if failed

---

## Conclusion

This implementation guide provides the technical foundation for Phase 4. Follow the architecture patterns, use the provided code samples as reference, and ensure comprehensive testing before deployment.

**Next Steps:**
1. Review with technical lead
2. Set up development environment
3. Create database migrations
4. Implement core services
5. Build API endpoints
6. Integrate external services
7. Test thoroughly
8. Deploy to staging
9. Performance testing
10. Production deployment
