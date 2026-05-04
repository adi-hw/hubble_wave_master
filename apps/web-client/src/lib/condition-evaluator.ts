/**
 * Re-export from `@hubblewave/shared-types`. The evaluator lives in
 * shared-types so the same function tree powers server-side resolvers
 * (Phase 2 §7.3 form-load resolution) and client-side runtime
 * (field-change re-evaluation). Plan: "no parallel implementation".
 *
 * Frontend code can keep using the unprefixed `Condition` /
 * `ConditionOperator` names locally — the shared-types index uses
 * `Runtime*` aliases to dodge a clash with phase2/form.ts's own
 * `ConditionGroup` (which is a different shape used by static form
 * rule definitions).
 */
import type {
  Condition as RuntimeCondition,
  ConditionGroup as RuntimeConditionGroup,
  ConditionOperator as RuntimeConditionOperator,
  SingleCondition as RuntimeSingleCondition,
} from '@hubblewave/shared-types/condition-evaluator';

export {
  evaluateCondition,
  composeDisplay,
  type DisplayAction,
  type DisplayActionKind,
  type ResolvedDisplay,
} from '@hubblewave/shared-types/condition-evaluator';

export type Condition = RuntimeCondition;
export type ConditionGroup = RuntimeConditionGroup;
export type ConditionOperator = RuntimeConditionOperator;
export type SingleCondition = RuntimeSingleCondition;
