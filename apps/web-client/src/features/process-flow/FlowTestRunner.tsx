import React, { useState } from 'react';
import { Loader2, Play, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
  processFlowsService,
  type ProcessFlowTestRunResult,
} from '../../services/process-flows.service';

type TestRunResult = ProcessFlowTestRunResult;

export interface FlowTestRunnerProps {
  flowId: string;
  flowCode: string;
  /**
   * Pre-populated input keys derived from the flow's collection
   * properties. The runner shows them as a hint at the top of the
   * sidebar but doesn't constrain the textarea — authors can supply
   * arbitrary mock JSON.
   */
  expectedInputKeys?: string[];
  open: boolean;
  onClose: () => void;
}

/**
 * Plan §8.1.8 — Flow Test Runner sidebar.
 *
 * Sidebar surface inside `ProcessFlowEditorPage`. Author types a JSON
 * input payload, picks dry-run vs wet-run, and clicks Run. The
 * backend at `POST /api/workflows/definitions/:id/test-run` walks
 * the canvas, interpolates each action's bindings against the mock,
 * and returns a step-by-step trace.
 *
 * Test mode (dry-run) is the default — record-mutating actions
 * never reach the SQL layer; the trace shows what each node WOULD
 * do. The wet-run toggle delegates to the engine for true execution
 * (gated by the same `metadata:flow:manage` permission as the editor
 * itself; you can't escalate via the test runner).
 */
export const FlowTestRunner: React.FC<FlowTestRunnerProps> = ({
  flowId,
  flowCode,
  expectedInputKeys = [],
  open,
  onClose,
}) => {
  const initialJson = JSON.stringify(
    Object.fromEntries(expectedInputKeys.map((k) => [k, ''])),
    null,
    2,
  );
  const [inputJson, setInputJson] = useState(initialJson || '{}');
  const [recordId, setRecordId] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestRunResult | null>(null);

  const onRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(inputJson || '{}');
      } catch (err) {
        setError(`Input is not valid JSON: ${(err as Error).message}`);
        setRunning(false);
        return;
      }
      setResult(
        await processFlowsService.testRun(flowId, {
          input: parsed,
          recordId: recordId || undefined,
          dryRun,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test run failed');
    } finally {
      setRunning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-96 flex-col border-l border-border bg-card shadow-xl">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Test runner</h3>
          <p className="text-xs text-muted-foreground">
            Flow: <code>{flowCode}</code>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-3">
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Mock input (JSON)
          </label>
          <textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            rows={8}
            className="w-full rounded border border-border bg-card px-2 py-1 font-mono text-xs"
            placeholder={'{ "amount": 1500, "tier": "gold" }'}
          />
          {expectedInputKeys.length > 0 ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Suggested keys (from collection): {expectedInputKeys.join(', ')}
            </p>
          ) : null}
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Record id (optional, for record-scoped flows)
          </label>
          <input
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            placeholder="uuid"
            className="w-full rounded border border-border bg-card px-2 py-1 font-mono text-xs"
          />
        </div>

        <label className="mb-3 inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          <span>
            Dry run <span className="text-muted-foreground">(no record writes - recommended)</span>
          </span>
        </label>

        <Button size="sm" onClick={() => void onRun()} disabled={running}>
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Run
        </Button>

        {error ? (
          <div className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              Mode: <strong>{result.mode}</strong>{' '}
              {result.warning ? <em>| {result.warning}</em> : null}
            </div>
            {result.steps.length === 0 ? (
              <div className="rounded border border-border bg-muted/30 p-2 text-xs">
                No steps traced.
              </div>
            ) : (
              <ol className="space-y-2">
                {result.steps.map((step, idx) => (
                  <li
                    key={`${step.nodeId}-${idx}`}
                    className="rounded border border-border bg-muted/20 p-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {idx + 1}. {step.nodeName || step.nodeId}
                      </div>
                      <code className="text-[10px] text-muted-foreground">
                        {step.actionType ?? step.nodeType}
                      </code>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {step.wouldExecute}
                    </div>
                    {Object.keys(step.resolvedConfig).length > 0 ? (
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded bg-card p-1 text-[10px]">
                        {JSON.stringify(step.resolvedConfig, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
