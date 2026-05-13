// libs/instance-db/src/lib/entities/automation.ts
//
// Automation-area entities: business rules, scheduled jobs, client scripts,
// execution logs, process flows, approvals, SLA definitions and instances,
// state machines, decision tables, guided processes (playbooks), connectors,
// and the instance-level event outbox.
//
// Public API surface is unchanged — entities continue to be exported via
// the package barrel `@hubblewave/instance-db`. This file exists to make
// area ownership explicit and to ease future code navigation. See Plan
// Fix 24 PR-A for the restructure rationale.

export {
  AutomationRule,
  AutomationRuleRevision,
  ScheduledJob,
  AutomationExecutionLog,
  ClientScript,
} from './automation.entity';
export type {
  TriggerTiming,
  TriggerOperation,
  AutomationConditionType,
  AutomationActionType,
  ExecutionStatus,
  ScheduleFrequency,
  AutomationAction,
  ClientScriptTrigger,
  ClientScriptAction,
  AutomationRuleStatus,
  AutomationRuleRevisionStatus,
} from './automation.entity';

export {
  ProcessFlowDefinition,
  ProcessFlowDefinitionRevision,
  ProcessFlowInstance,
  ProcessFlowExecutionHistory,
  Approval,
} from './process-flow.entity';
export type {
  TriggerType,
  ProcessFlowRunAs,
  ProcessFlowNode,
  ProcessFlowConnection,
  ProcessFlowCanvas,
  ProcessFlowInstanceState,
  ExecutionHistoryStatus,
  ApprovalStatus,
  ApproverType,
  ApprovalType,
  ProcessFlowDefinitionStatus,
  ProcessFlowDefinitionRevisionStatus,
} from './process-flow.entity';

export {
  BusinessHours,
  SLADefinition,
  SLAInstance,
  SLABreach,
  StateMachineDefinition,
  StateChangeHistory,
} from './sla.entity';
export type {
  DaySchedule,
  WeeklySchedule,
  Holiday,
  SLAType,
  SLAEscalation,
  SLAInstanceState,
  StateMachineState,
  StateMachineTransition,
} from './sla.entity';

export {
  DecisionTable,
  DecisionInput,
  DecisionRow,
  DecisionTableRevision,
} from './decision-table.entity';
export type {
  DecisionTableStatus,
  DecisionInputType,
  DecisionRowOperator,
  DecisionRowCondition,
  DecisionTableRevisionStatus,
} from './decision-table.entity';

export {
  GuidedProcessDefinition,
  GuidedProcessStage,
  GuidedProcessActivity,
  GuidedProcessRevision,
} from './guided-process.entity';
export type {
  GuidedProcessStatus,
  GuidedActivityKind,
  GuidedProcessRevisionStatus,
} from './guided-process.entity';

export { Connector } from './connector.entity';
export type { ConnectorKind, ConnectorStatus } from './connector.entity';

export { InstanceEventOutbox, OutboxStatus } from './event-outbox.entity';
