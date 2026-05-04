/**
 * Typed input/output contract for every Flow Action and Automation
 * Action across the platform. Plan §8.1.5 — every action declares
 * its inputs and outputs from a fixed taxonomy, validated at
 * canvas-save time AND at execution time. AI callability is a
 * derived property: an action is `aiCallable` when every input and
 * output type belongs to the AI-callable subset (no `any`, no
 * unconstrained `json`).
 */

export type ActionIOType =
  | 'boolean'
  | 'choice'
  | 'date'
  | 'datetime'
  | 'email'
  | 'integer'
  | 'reference'
  | 'string'
  | 'uuid'
  | 'json'
  | 'array';

export interface ActionParameterSpec {
  /** Stable identifier the canvas binds to. */
  name: string;
  type: ActionIOType;
  /**
   * For `array` type — element type. For `reference` type — target
   * collection code. For `choice` type — list of permitted string
   * values. Ignored otherwise.
   */
  itemType?: ActionIOType;
  referenceCollectionCode?: string;
  choices?: string[];
  required: boolean;
  description?: string;
}

export interface ActionDefinition {
  /** Stable code persisted in canvas JSON (e.g. 'CreateRecord'). */
  code: string;
  name: string;
  description: string;
  category: 'record' | 'notification' | 'approval' | 'flow' | 'integration' | 'ai' | 'decision';
  inputs: ActionParameterSpec[];
  outputs: ActionParameterSpec[];
  /**
   * Derived flag — the AI Build Agent surfaces only actions where
   * every input/output is a typed primitive (no unconstrained `json`).
   * Computed by `isAiCallable(definition)` so it never drifts from
   * the actual specs.
   */
  conversationalCompatible?: boolean;
}

const AI_CALLABLE_TYPES: ReadonlySet<ActionIOType> = new Set([
  'boolean',
  'choice',
  'date',
  'datetime',
  'email',
  'integer',
  'reference',
  'string',
  'uuid',
]);

export const isAiCallable = (definition: ActionDefinition): boolean => {
  const allParams = [...definition.inputs, ...definition.outputs];
  return allParams.every(
    (p) =>
      AI_CALLABLE_TYPES.has(p.type) &&
      (p.type !== 'array' || (p.itemType ? AI_CALLABLE_TYPES.has(p.itemType) : false)),
  );
};

/**
 * Validate that a runtime payload conforms to the declared parameter
 * specs. Returns null on success or a string describing the first
 * mismatch. The canvas validates the same payloads when bindings are
 * authored; the engine validates them again on execution. Two
 * checkpoints because metadata can drift between save and execute
 * (a property gets renamed, a referenced collection deprecated).
 */
export const validateActionPayload = (
  specs: ReadonlyArray<ActionParameterSpec>,
  payload: Readonly<Record<string, unknown>>,
): string | null => {
  for (const spec of specs) {
    const value = payload[spec.name];
    if (value === undefined || value === null) {
      if (spec.required) {
        return `Missing required parameter: ${spec.name}`;
      }
      continue;
    }
    const error = validateAgainstType(spec, value);
    if (error) return error;
  }
  return null;
};

const validateAgainstType = (
  spec: ActionParameterSpec,
  value: unknown,
): string | null => {
  switch (spec.type) {
    case 'boolean':
      return typeof value === 'boolean' ? null : `${spec.name} must be a boolean`;
    case 'integer':
      return Number.isInteger(value) ? null : `${spec.name} must be an integer`;
    case 'string':
    case 'email':
    case 'uuid':
    case 'date':
    case 'datetime':
      return typeof value === 'string' ? null : `${spec.name} must be a string`;
    case 'reference':
      return typeof value === 'string' ? null : `${spec.name} must be a reference UUID string`;
    case 'choice':
      if (typeof value !== 'string') return `${spec.name} must be a string`;
      if (spec.choices && !spec.choices.includes(value)) {
        return `${spec.name} must be one of: ${spec.choices.join(', ')}`;
      }
      return null;
    case 'array':
      if (!Array.isArray(value)) return `${spec.name} must be an array`;
      return null;
    case 'json':
      return null;
    default:
      return null;
  }
};

/**
 * Built-in Flow Action library. Plan §8.1.3. Each entry declares
 * its typed inputs/outputs so the canvas can wire data pills and
 * the engine can validate at execution time.
 */
export const BUILT_IN_ACTIONS: ActionDefinition[] = [
  {
    code: 'CreateRecord',
    name: 'Create Record',
    description: 'Create a new record in a Collection.',
    category: 'record',
    inputs: [
      { name: 'collectionCode', type: 'string', required: true, description: 'Target Collection code' },
      { name: 'values', type: 'json', required: true, description: 'Property values to set' },
    ],
    outputs: [
      { name: 'recordId', type: 'uuid', required: true, description: 'Id of the created record' },
    ],
  },
  {
    code: 'UpdateRecord',
    name: 'Update Record',
    description: 'Update an existing record.',
    category: 'record',
    inputs: [
      { name: 'collectionCode', type: 'string', required: true },
      { name: 'recordId', type: 'uuid', required: true },
      { name: 'values', type: 'json', required: true },
    ],
    outputs: [{ name: 'recordId', type: 'uuid', required: true }],
  },
  {
    code: 'DeleteRecord',
    name: 'Delete Record',
    description: 'Soft-delete a record.',
    category: 'record',
    inputs: [
      { name: 'collectionCode', type: 'string', required: true },
      { name: 'recordId', type: 'uuid', required: true },
    ],
    outputs: [{ name: 'deleted', type: 'boolean', required: true }],
  },
  {
    code: 'LookUpRecord',
    name: 'Look Up Record',
    description: 'Fetch a single record by id.',
    category: 'record',
    inputs: [
      { name: 'collectionCode', type: 'string', required: true },
      { name: 'recordId', type: 'uuid', required: true },
    ],
    outputs: [{ name: 'record', type: 'json', required: true }],
  },
  {
    code: 'SetFieldValue',
    name: 'Set Property Value',
    description: 'Mutate a single property on a record.',
    category: 'record',
    inputs: [
      { name: 'collectionCode', type: 'string', required: true },
      { name: 'recordId', type: 'uuid', required: true },
      { name: 'propertyCode', type: 'string', required: true },
      { name: 'value', type: 'json', required: true },
    ],
    outputs: [{ name: 'recordId', type: 'uuid', required: true }],
  },
  {
    code: 'SendNotification',
    name: 'Send Notification',
    description: 'Send a notification using a template.',
    category: 'notification',
    inputs: [
      { name: 'templateCode', type: 'string', required: true },
      { name: 'recipientUserId', type: 'reference', required: true, referenceCollectionCode: 'user' },
      { name: 'data', type: 'json', required: false },
    ],
    outputs: [{ name: 'notificationId', type: 'uuid', required: true }],
  },
  {
    code: 'CreateApproval',
    name: 'Create Approval',
    description: 'Create an approval request and route to assignees.',
    category: 'approval',
    inputs: [
      { name: 'subject', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'assigneeUserIds', type: 'array', itemType: 'reference', required: true, referenceCollectionCode: 'user' },
    ],
    outputs: [{ name: 'approvalId', type: 'uuid', required: true }],
  },
  {
    code: 'WaitForApproval',
    name: 'Wait For Approval',
    description: 'Pause flow until the named approval resolves.',
    category: 'approval',
    inputs: [{ name: 'approvalId', type: 'uuid', required: true }],
    outputs: [
      { name: 'decision', type: 'choice', required: true, choices: ['approved', 'rejected'] },
      { name: 'comment', type: 'string', required: false },
    ],
  },
  {
    code: 'CallFlowModule',
    name: 'Call Flow Module',
    description: 'Invoke a sub-flow synchronously and inherit its outputs.',
    category: 'flow',
    inputs: [
      { name: 'flowCode', type: 'string', required: true },
      { name: 'inputs', type: 'json', required: false },
    ],
    outputs: [{ name: 'outputs', type: 'json', required: true }],
  },
  {
    code: 'HTTPRequest',
    name: 'HTTP Request',
    description: 'Call an external HTTP endpoint via a registered Connector.',
    category: 'integration',
    inputs: [
      { name: 'connectorCode', type: 'string', required: true },
      { name: 'method', type: 'choice', required: true, choices: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { name: 'path', type: 'string', required: true },
      { name: 'body', type: 'json', required: false },
    ],
    outputs: [
      { name: 'status', type: 'integer', required: true },
      { name: 'body', type: 'json', required: false },
    ],
  },
  {
    code: 'RunAVAPrompt',
    name: 'Run AVA Prompt',
    description: 'Execute an AVA prompt with structured inputs.',
    category: 'ai',
    inputs: [
      { name: 'promptCode', type: 'string', required: true },
      { name: 'inputs', type: 'json', required: false },
    ],
    outputs: [{ name: 'response', type: 'json', required: true }],
  },
  {
    code: 'MakeDecision',
    name: 'Make Decision',
    description: 'Evaluate a Decision Table and return the matched answer.',
    category: 'decision',
    inputs: [
      { name: 'tableCode', type: 'string', required: true },
      { name: 'inputs', type: 'json', required: true },
    ],
    outputs: [
      { name: 'matched', type: 'boolean', required: true },
      { name: 'answer', type: 'json', required: false },
    ],
  },
];

export const findActionByCode = (code: string): ActionDefinition | undefined =>
  BUILT_IN_ACTIONS.find((a) => a.code === code);
