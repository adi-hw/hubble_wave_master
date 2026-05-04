import { useMemo } from 'react';
import type { DataPillCategory } from './DataPillPicker';

/**
 * Plan §8.1.4 — canonical DataPill categories.
 *
 * Token syntax matters: each runtime resolves bindings differently.
 *
 *  - **flow** runtime (`libs/automation/process-flow-engine`): the
 *    engine's `interpolateString` matches `\{\{(\w+(\.\w+)*)\}\}` so
 *    pills emit `{{trigger.x}}` / `{{steps.N.x}}` / `{{user.x}}` /
 *    `{{system.x}}`. Used by Flow Action panels.
 *
 *  - **automation** runtime (`apps/svc-data/automation/action-handler`):
 *    `resolveValue` matches the `@record.` / `@currentUser.` /
 *    `@output.` prefix, so pills emit `@record.x` / `@currentUser.x`.
 *    Used by Automation Rule conditions and actions.
 *
 *  Pass `runtime` so each builder gets tokens that the runtime
 *  actually interpolates. Single-brace tokens (`{x}`) are NOT
 *  resolved by either runtime — earlier the hook emitted those and
 *  the pills were saved as literals. The default is `'flow'` for
 *  back-compat (no caller passed `runtime` before this fix).
 */
export type DataPillRuntime = 'flow' | 'automation';

export interface DataPillSchemaProperty {
  code: string;
  label: string;
  type?: 'string' | 'integer' | 'boolean' | 'date' | 'datetime' | 'reference' | 'json';
}

export const useDataPillCategories = (options: {
  triggerProperties?: DataPillSchemaProperty[];
  stepPills?: Array<{ token: string; label: string; preview?: string }>;
  runtime?: DataPillRuntime;
}): DataPillCategory[] => {
  const runtime: DataPillRuntime = options.runtime ?? 'flow';
  return useMemo(() => {
    // Token shape per runtime — see file header for the contract.
    const triggerToken = (code: string): string =>
      runtime === 'automation' ? `@record.${code}` : `{{trigger.${code}}}`;
    const userToken = (path: string): string =>
      runtime === 'automation' ? `@currentUser.${path}` : `{{user.${path}}}`;
    // Automation runtime resolvers handle `@now` / `@today` /
    // `@instanceCode` literally (no `@system.` namespace exists in
    // `apps/svc-data/automation/action-handler.service.resolveValue`).
    // Flow runtime resolves `{{system.x}}` because the engine's
    // `ProcessFlowContext` carries a `system` namespace.
    const systemToken = (path: string): string => {
      if (runtime === 'automation') {
        return path === 'now' || path === 'today' || path === 'instanceCode'
          ? `@${path}`
          : `@${path}`; // fallback — extra system pills should map 1:1 to runtime resolvers
      }
      return `{{system.${path}}}`;
    };

    const categories: DataPillCategory[] = [];
    if (options.triggerProperties && options.triggerProperties.length > 0) {
      categories.push({
        kind: 'trigger',
        label: runtime === 'automation' ? 'Record (this collection)' : 'Trigger record',
        description:
          runtime === 'automation'
            ? 'Properties of the record being inserted/updated. Resolved at automation execution time.'
            : 'Properties of the record that triggered the flow.',
        pills: options.triggerProperties.map((p) => ({
          token: triggerToken(p.code),
          label: p.label,
          kind: 'trigger',
          type: p.type,
        })),
      });
    }
    if (options.stepPills && options.stepPills.length > 0) {
      // Step outputs are flow-only — automation rules don't have a
      // step graph. Skip emitting these for the automation runtime.
      if (runtime === 'flow') {
        categories.push({
          kind: 'step',
          label: 'Step outputs',
          description: 'Outputs of upstream flow steps.',
          pills: options.stepPills.map((p) => ({
            token: p.token,
            label: p.label,
            kind: 'step',
            preview: p.preview,
          })),
        });
      }
    }
    categories.push({
      kind: 'user',
      label: 'Current user',
      description: 'The authenticated user invoking the rule.',
      pills: [
        { token: userToken('id'), label: 'User id', kind: 'user', type: 'reference' },
        { token: userToken('email'), label: 'User email', kind: 'user', type: 'string' },
        { token: userToken('username'), label: 'Username', kind: 'user', type: 'string' },
      ],
    });
    categories.push({
      kind: 'system',
      label: 'System',
      description: 'Runtime / platform values.',
      pills: [
        { token: systemToken('now'), label: 'Now (timestamp)', kind: 'system', type: 'datetime' },
        { token: systemToken('today'), label: 'Today (date)', kind: 'system', type: 'date' },
        {
          token: systemToken('instanceCode'),
          label: 'Instance code',
          kind: 'system',
          type: 'string',
        },
      ],
    });
    return categories;
  }, [options.triggerProperties, options.stepPills, runtime]);
};
