/**
 * Plan §9.1 — canonical structured action set for Automation Rules.
 * Mirrors the Flow-side `BUILT_IN_ACTIONS` (action-contract.ts) but
 * with a deliberately smaller surface: the rule engine fires
 * synchronously inside the data-change pipeline, so heavy actions
 * (HTTPRequest, RunAVAPrompt, MakeDecision) belong on Process Flows
 * which can pause/queue. Five canonical actions cover the
 * declarative business-rule surface:
 *
 *   - SetField     — mutate one property on the current record
 *   - CreateRecord — emit a record into another collection
 *   - FireEvent    — publish a named event for downstream consumers
 *   - CallFlow     — invoke a published Process Flow asynchronously
 *   - Abort        — refuse the change with an operator-visible reason
 */

import type { ActionIOType, ActionParameterSpec, ActionDefinition } from './action-contract';

export type AutomationActionDefinition = ActionDefinition;
export type AutomationActionParameterSpec = ActionParameterSpec;
export type AutomationActionIOType = ActionIOType;

export const BUILT_IN_AUTOMATION_ACTIONS: AutomationActionDefinition[] = [
  {
    code: 'SetField',
    name: 'Set Property',
    description: "Mutate one property on the rule's record.",
    category: 'record',
    inputs: [
      { name: 'property', type: 'string', required: true, description: 'Property code on the current collection' },
      { name: 'value', type: 'json', required: true, description: 'Value or @record / @output binding' },
      { name: 'onlyIfEmpty', type: 'boolean', required: false, description: 'Skip the write when the property already has a value' },
    ],
    outputs: [{ name: 'property', type: 'string', required: true }],
  },
  {
    code: 'CreateRecord',
    name: 'Create Record',
    description: 'Insert a record into a target collection after the parent commits.',
    category: 'record',
    inputs: [
      { name: 'collectionCode', type: 'string', required: true },
      { name: 'values', type: 'json', required: true },
    ],
    outputs: [{ name: 'recordId', type: 'uuid', required: true }],
  },
  {
    code: 'FireEvent',
    name: 'Fire Event',
    description: 'Publish a named event onto the platform event bus.',
    category: 'integration',
    inputs: [
      { name: 'event', type: 'string', required: true },
      { name: 'data', type: 'json', required: false },
    ],
    outputs: [{ name: 'event', type: 'string', required: true }],
  },
  {
    code: 'CallFlow',
    name: 'Call Flow',
    description: 'Trigger a published Process Flow with the rule context.',
    category: 'flow',
    inputs: [
      { name: 'flowCode', type: 'string', required: true },
      { name: 'inputs', type: 'json', required: false },
    ],
    outputs: [{ name: 'queued', type: 'boolean', required: true }],
  },
  {
    code: 'Abort',
    name: 'Abort',
    description: 'Reject the data change with an operator-visible reason.',
    category: 'record',
    inputs: [
      { name: 'message', type: 'string', required: true },
      { name: 'code', type: 'string', required: false, description: 'Optional machine-readable error code' },
    ],
    outputs: [],
  },
  {
    // Plan §9.1 named the canonical 5 (SetField / CreateRecord /
    // FireEvent / CallFlow / Abort). SendNotification is a stable
    // platform action both runtimes have always supported; surfacing
    // it in the catalog lets the canvas + AI build agent author it
    // by code, and gives the alias `send_notification` a target so
    // the drain step normalizes correctly.
    code: 'SendNotification',
    name: 'Send Notification',
    description: 'Send a templated notification to one or more recipients.',
    category: 'notification',
    inputs: [
      { name: 'templateCode', type: 'string', required: true },
      { name: 'recipients', type: 'array', itemType: 'reference', required: true, referenceCollectionCode: 'user' },
      { name: 'channels', type: 'array', itemType: 'string', required: false },
      { name: 'data', type: 'json', required: false },
    ],
    outputs: [{ name: 'queued', type: 'boolean', required: true }],
  },
];

/**
 * Snake_case alias codes the engine also accepts. Both write
 * paths (the AutomationRuleBuilder editor and the Action handler
 * dispatcher) treat these as aliases for the canonical PascalCase
 * actions above. New rules should be authored with the PascalCase
 * codes; existing rows continue to dispatch correctly.
 */
export const AUTOMATION_CODE_ALIASES: Record<string, string> = {
  set_value: 'SetField',
  // set_values is intentionally NOT aliased to SetField — they have
  // distinct semantics (single-property vs multi-property write) and
  // are dispatched to different handler branches. Aliasing would
  // cause the reverse-map step in svc-data and svc-automation to
  // squash multi-property writes onto the single-property handler,
  // losing every property except the one set_value reads.
  create_record: 'CreateRecord',
  log_event: 'FireEvent',
  send_notification: 'SendNotification',
  trigger_flow: 'CallFlow',
  // The visual ActionBuilder writes the workflow action as
  // `start_workflow`. svc-automation's handler reads that alias
  // directly (no normalization needed), but svc-data's handler keys
  // off `trigger_flow` after canonical normalization. Aliasing
  // start_workflow → CallFlow lets BOTH runtimes route to their own
  // handler branch via their respective canonical-to-dispatch
  // reverse maps without UI changes.
  start_workflow: 'CallFlow',
  abort: 'Abort',
};

export const findAutomationActionByCode = (
  code: string,
): AutomationActionDefinition | undefined => {
  const canonical = AUTOMATION_CODE_ALIASES[code] ?? code;
  return BUILT_IN_AUTOMATION_ACTIONS.find((a) => a.code === canonical);
};
