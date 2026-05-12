import { Injectable, Logger } from '@nestjs/common';
import { UserRequestContext } from '@hubblewave/auth-guard';
import { AutomationRuntimeService } from '../runtime/automation-runtime.service';
import {
  ExecuteSyncTriggerRequestDto,
  ExecuteSyncTriggerResponseDto,
} from './sync-trigger.dto';

const SYNC_TRIGGER_TIMEOUT_MS = 5000;

/**
 * Adapter between the HTTP DTO surface and the runtime's
 * `executeSyncTrigger()` method. Resolves the user identity from the
 * propagated JWT-derived UserRequestContext, applies the hard server-side
 * timeout, and translates the runtime's structured result back to the
 * wire DTO.
 *
 * The 5-second timeout is a hard ceiling on a single sync trigger
 * invocation, applied at this boundary so a runaway script or
 * unbounded condition evaluation cannot stall the caller's request
 * beyond a budget the caller can plan around. On timeout, the
 * response is shaped as an aborted run with a clear message rather
 * than thrown — callers must observe a structured outcome to make
 * the right user-facing decision.
 */
@Injectable()
export class SyncTriggerService {
  private readonly logger = new Logger(SyncTriggerService.name);

  constructor(private readonly runtime: AutomationRuntimeService) {}

  async execute(
    request: ExecuteSyncTriggerRequestDto,
    ctx: UserRequestContext,
  ): Promise<ExecuteSyncTriggerResponseDto> {
    const userContext = {
      id: ctx.userId,
      email: ctx.username,
      roles: ctx.roles,
    };

    const parent = request.parentAutomationContext
      ? {
          depth: request.parentAutomationContext.depth,
          executionChain: request.parentAutomationContext.executionChain,
        }
      : undefined;

    return this.runWithTimeout(
      this.runtime.executeSyncTrigger({
        collectionId: request.collectionId,
        timing: request.timing,
        operation: request.operation,
        record: request.record,
        previousRecord: request.previousRecord,
        userContext,
        parentContext: parent,
      }),
      SYNC_TRIGGER_TIMEOUT_MS,
      request.collectionId,
    );
  }

  private async runWithTimeout(
    work: Promise<ExecuteSyncTriggerResponseDto>,
    timeoutMs: number,
    collectionId: string,
  ): Promise<ExecuteSyncTriggerResponseDto> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<ExecuteSyncTriggerResponseDto>((resolve) => {
      timer = setTimeout(() => {
        this.logger.warn(
          `Sync trigger exceeded ${timeoutMs}ms for collection ${collectionId}; ` +
            'returning aborted result so the caller can refuse the write.',
        );
        resolve({
          modifiedRecord: {},
          errors: [],
          warnings: [],
          asyncQueue: [],
          aborted: true,
          abortMessage: `Automation runtime timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);
    });

    try {
      return await Promise.race([work, timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
