import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Cross-service contract: sync-trigger request and response.
 *
 * This file IS the public contract between svc-data and svc-automation
 * for synchronous (in-request, before/after) automation execution. The
 * shapes mirror svc-data's existing `executeAutomations()` signature so
 * the migration in PR 2 is a 1:1 swap of "local executor call" for
 * "HTTP client call" with no semantic change at the call site.
 *
 * User identity is propagated via the forwarded JWT (Bearer header) and
 * extracted from the RequestContext on the server side. It does NOT
 * appear in this DTO, because allowing the request body to override the
 * caller's JWT would create an impersonation surface. If a future
 * use-case needs delegated execution (svc-data running an automation
 * on behalf of someone other than the JWT subject), it gets a separate
 * permission slug and a separate endpoint.
 */

export type TriggerTiming = 'before' | 'after';
export type TriggerOperation = 'insert' | 'update' | 'delete' | 'query';

/**
 * Cycle / depth state forwarded from the caller. Outbox-emitted
 * recursive triggers carry this so the runtime can detect chains
 * already in progress and enforce MAX_DEPTH across the chain.
 *
 * Wire format is an array because JSON has no Set; svc-automation's
 * runtime reconstructs a Set internally on entry.
 */
export class ParentAutomationContextDto {
  @IsInt()
  @Min(0)
  @Max(50)
  depth!: number;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  executionChain!: string[];
}

export class ExecuteSyncTriggerRequestDto {
  @IsUUID()
  collectionId!: string;

  @IsIn(['before', 'after'])
  timing!: TriggerTiming;

  @IsIn(['insert', 'update', 'delete', 'query'])
  operation!: TriggerOperation;

  /**
   * For 'query' operations this is the query options object; for
   * 'insert' / 'update' / 'delete' it is the record. Validation of
   * the shape itself is the caller's responsibility — the runtime
   * trusts the structure (it cannot meaningfully validate arbitrary
   * record shapes against a collection's dynamic schema at this
   * boundary without a round-trip to svc-metadata, which would
   * defeat the latency budget).
   */
  @IsObject()
  record!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  previousRecord?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => ParentAutomationContextDto)
  parentAutomationContext?: ParentAutomationContextDto;
}

/**
 * The response shape mirrors svc-data's existing
 * `Promise<{modifiedRecord, errors, warnings, asyncQueue, aborted, abortMessage}>`
 * exactly. Adding fields is allowed; renaming or restructuring is a
 * contract-breaking change and requires a versioned endpoint.
 */
export interface ExecuteSyncTriggerResponseDto {
  /**
   * The record after all `before`-trigger mutations have been applied.
   * For `after`-triggers this is the same record the caller passed in
   * (svc-automation does not modify post-commit state from the sync
   * path — that lives on the async outbox path).
   */
  modifiedRecord: Record<string, unknown>;

  errors: Array<{ property: string; message: string }>;
  warnings: Array<{ property: string; message: string }>;

  /**
   * Actions queued for post-commit async execution (notifications,
   * downstream record creates, fired events). The caller is
   * responsible for draining this queue after committing its
   * primary write — typically by emitting an outbox event that the
   * async path picks up. Carried in the response so a `before`-
   * trigger can register post-commit work atomically with the
   * mutation it just decided to allow.
   */
  asyncQueue: QueuedActionDto[];

  /**
   * `true` iff a `before`-trigger executed an `abort` action. The
   * caller MUST reject its own write when this is true; the
   * `abortMessage` is the user-facing reason.
   */
  aborted: boolean;
  abortMessage?: string;
}

export interface QueuedActionDto {
  action: {
    id: string;
    type: string;
    config: Record<string, unknown>;
  };
  executeAsync: boolean;
  executeAfterCommit: boolean;
  output?: unknown;
}
