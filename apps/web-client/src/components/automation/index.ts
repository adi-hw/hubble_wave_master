/**
 * Automation Components
 * HubbleWave Platform - Phase 3
 *
 * Exports all automation-related UI components.
 */

export { RuleBuilder } from './RuleBuilder';
export type { RuleConfig, ConditionRule, ConditionGroup, TriggerTiming, TriggerOperation } from './RuleBuilder';

export { TriggerBuilder } from './TriggerBuilder';

export { AutomationConditionBuilder } from './AutomationConditionBuilder';
export type { ConditionType } from './AutomationConditionBuilder';

export { ActionBuilder } from './ActionBuilder';
export type { ActionType, AutomationActionConfig } from './ActionBuilder';

export { ScheduleBuilder } from './ScheduleBuilder';
export type { ScheduleFrequency, ScheduleConfig } from './ScheduleBuilder';
