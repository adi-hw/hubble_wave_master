import { Injectable, Logger } from '@nestjs/common';

export type ExecutionStatus = 'success' | 'error' | 'skipped';
export type AutomationType = 'data' | 'scheduled' | 'event';

interface LogOptions {
  automationId: string;
  automationType: AutomationType;
  automationName?: string;
  collectionId?: string;
  recordId?: string;
  triggerEvent?: string;
  triggerTiming?: string;
  status: ExecutionStatus;
  skippedReason?: string;
  errorMessage?: string;
  errorStack?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  actionsExecuted?: Record<string, unknown>[];
  triggeredBy?: string;
  executionDepth?: number;
  durationMs?: number;
}

@Injectable()
export class ExecutionLogService {
  private readonly logger = new Logger(ExecutionLogService.name);

  async log(options: LogOptions): Promise<void> {
    // Log to console for now - in production this should write to a database
    const logLevel = options.status === 'error' ? 'error' : 'debug';

    const logEntry = {
      timestamp: new Date().toISOString(),
      automationId: options.automationId,
      automationName: options.automationName,
      automationType: options.automationType,
      collectionId: options.collectionId,
      recordId: options.recordId,
      triggerEvent: options.triggerEvent,
      status: options.status,
      durationMs: options.durationMs,
      executionDepth: options.executionDepth,
    };

    if (logLevel === 'error') {
      this.logger.error(
        `Automation execution failed: ${options.automationName || options.automationId}`,
        {
          ...logEntry,
          errorMessage: options.errorMessage,
          errorStack: options.errorStack,
        },
      );
    } else {
      this.logger.debug(
        `Automation executed: ${options.automationName || options.automationId} - ${options.status}`,
        logEntry,
      );
    }
  }
}
