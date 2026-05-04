import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContext } from '@hubblewave/auth-guard';
import { ExecutionContext, QueuedAction } from '../../types/automation.types';

/**
 * Per-call timeout. svc-automation enforces its own 5s ceiling on the
 * server side; this client adds a slightly larger budget for network +
 * serialization so that under normal latency the server-side timeout
 * fires first and the client sees a structured aborted result rather
 * than a network error.
 */
const SYNC_TRIGGER_HTTP_TIMEOUT_MS = 8000;

/**
 * Default svc-automation URL for local dev. Production deployments
 * MUST override via the `SVC_AUTOMATION_URL` env var (typically a
 * service-mesh DNS name).
 */
const DEFAULT_SVC_AUTOMATION_URL = 'http://localhost:3003';

interface SyncTriggerRequest {
  collectionId: string;
  timing: 'before' | 'after';
  operation: 'insert' | 'update' | 'delete' | 'query';
  record: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
  parentAutomationContext?: { depth: number; executionChain: string[] };
}

interface SyncTriggerResponse {
  modifiedRecord: Record<string, unknown>;
  errors: Array<{ property: string; message: string }>;
  warnings: Array<{ property: string; message: string }>;
  asyncQueue: Array<{
    action: { id: string; type: string; config: Record<string, unknown> };
    executeAsync: boolean;
    executeAfterCommit: boolean;
    output?: unknown;
  }>;
  aborted: boolean;
  abortMessage?: string;
}

/**
 * Result shape returned to the caller (`runBeforeAutomations`,
 * `runAfterAutomations`, `runBeforeQueryAutomations`). Mirrors the
 * existing local executor's return type so the call sites are a 1:1
 * swap when the feature flag is on.
 */
export interface SyncTriggerClientResult {
  modifiedRecord: Record<string, unknown>;
  errors: Array<{ property: string; message: string }>;
  warnings: Array<{ property: string; message: string }>;
  asyncQueue: QueuedAction[];
  aborted: boolean;
  abortMessage?: string;
}

/**
 * HTTP client for svc-automation's synchronous trigger endpoint.
 *
 * Used during PR 2 of Plan Fix 1 — when the
 * `AUTOMATION_SYNC_VIA_HTTP` feature flag is enabled, svc-data's
 * three sync-trigger call sites
 * (`runBeforeAutomations`, `runBeforeQueryAutomations`,
 * `runAfterAutomations`) route here instead of into the local
 * executor. The local executor stays in place for flag-off mode
 * until PR 4 deletes it.
 *
 * Failure policy (decided in plan §"Service-to-service authz"):
 * network or timeout failure converts to a synthetic before-trigger
 * abort with a clear "automation runtime unavailable" message. The
 * caller's existing abort-handling logic (throw 400 with
 * AUTOMATION_ABORT) then kicks in. We never silently skip — that
 * would be a worse failure mode than rejecting the user's write.
 *
 * The same conversion applies on `after`-trigger calls; the caller
 * (`runAfterAutomations`) already swallows after-trigger errors as
 * warnings, so the synthetic abort surfaces as a logged warning
 * rather than a thrown 400.
 */
@Injectable()
export class SyncTriggerClientService {
  private readonly logger = new Logger(SyncTriggerClientService.name);
  private readonly serviceUrl: string;

  constructor(private readonly config: ConfigService) {
    this.serviceUrl = this.config.get<string>(
      'SVC_AUTOMATION_URL',
      DEFAULT_SVC_AUTOMATION_URL,
    );
  }

  async executeSyncTrigger(
    ctx: RequestContext,
    args: {
      collectionId: string;
      timing: 'before' | 'after';
      operation: 'insert' | 'update' | 'delete' | 'query';
      record: Record<string, unknown>;
      previousRecord?: Record<string, unknown>;
      userContext: ExecutionContext['user'];
      parentContext?: { depth?: number; executionChain?: string[] };
    },
  ): Promise<SyncTriggerClientResult> {
    if (!ctx.bearerToken) {
      // The plan-fix decision was to forward the original user's JWT.
      // If we don't have one (e.g. system-actor flows that never went
      // through JwtAuthGuard), we cannot make the HTTP call. Fail
      // closed via abort rather than silently skip — the caller's
      // abort-handling logic will surface it as a 400.
      return this.abortedResult(args.record, 'Sync trigger unavailable: no caller credential to forward');
    }

    const request: SyncTriggerRequest = {
      collectionId: args.collectionId,
      timing: args.timing,
      operation: args.operation,
      record: args.record,
      previousRecord: args.previousRecord,
      parentAutomationContext: args.parentContext
        ? {
            depth: args.parentContext.depth ?? 0,
            executionChain: args.parentContext.executionChain ?? [],
          }
        : undefined,
    };

    const url = `${this.serviceUrl.replace(/\/+$/, '')}/api/automation/sync-trigger/execute`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SYNC_TRIGGER_HTTP_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.bearerToken}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '<no body>');
        this.logger.error(
          `Sync trigger HTTP call returned ${response.status} for collection ${args.collectionId}: ${text}`,
        );
        return this.abortedResult(
          args.record,
          `Automation runtime returned ${response.status}: see server logs for detail`,
        );
      }

      const body = (await response.json()) as SyncTriggerResponse;
      return this.toClientResult(body);
    } catch (err) {
      const message = (err as Error).message ?? 'unknown';
      const isTimeout = (err as Error).name === 'AbortError';
      this.logger.error(
        `Sync trigger ${isTimeout ? 'timed out' : 'failed'} for collection ${args.collectionId}: ${message}`,
      );
      return this.abortedResult(
        args.record,
        isTimeout
          ? 'Automation runtime did not respond within timeout'
          : 'Automation runtime unavailable',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private toClientResult(body: SyncTriggerResponse): SyncTriggerClientResult {
    const result: SyncTriggerClientResult = {
      modifiedRecord: body.modifiedRecord,
      errors: body.errors,
      warnings: body.warnings,
      asyncQueue: body.asyncQueue.map((q) => ({
        action: {
          id: q.action.id,
          type: q.action.type,
          config: q.action.config,
          continueOnError: false,
        },
        executeAsync: q.executeAsync,
        executeAfterCommit: q.executeAfterCommit,
        output: q.output,
      })),
      aborted: body.aborted,
    };
    if (body.abortMessage !== undefined) {
      result.abortMessage = body.abortMessage;
    }
    return result;
  }

  private abortedResult(
    record: Record<string, unknown>,
    message: string,
  ): SyncTriggerClientResult {
    return {
      modifiedRecord: { ...record },
      errors: [],
      warnings: [],
      asyncQueue: [],
      aborted: true,
      abortMessage: message,
    };
  }
}
