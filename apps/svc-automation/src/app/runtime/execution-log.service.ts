import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AutomationExecutionLog } from '@hubblewave/instance-db';
import { AutomationExecutionStatus, TriggeredByPrincipalType } from './automation-runtime.types';

export interface LogOptions {
  automationId?: string;
  automationName: string;
  collectionId?: string;
  recordId?: string;
  triggerEvent?: string;
  triggerTiming?: string;
  status: AutomationExecutionStatus;
  skippedReason?: string;
  errorMessage?: string;
  errorStack?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  actionsExecuted?: Record<string, unknown>[];
  triggeredBy?: string | null;
  triggeredByPrincipalType?: TriggeredByPrincipalType;
  executionDepth?: number;
  durationMs?: number;
}

@Injectable()
export class ExecutionLogService {
  private readonly logger = new Logger(ExecutionLogService.name);

  constructor(
    @InjectRepository(AutomationExecutionLog)
    private readonly logRepo: Repository<AutomationExecutionLog>,
  ) {}

  async log(options: LogOptions): Promise<AutomationExecutionLog> {
    // The execution-log entity's persisted status enum predates the
    // 'partial_failure' bucket, so we keep the rich status in outputData and
    // map it to the closest persisted value for indexing/back-compat.
    const persistedStatus =
      options.status === 'partial_failure' ? 'error' : options.status;
    const enrichedOutput: Record<string, unknown> = {
      ...(options.outputData || {}),
      _runtimeStatus: options.status,
      _triggeredByPrincipalType: options.triggeredByPrincipalType,
    };

    const entry = this.logRepo.create({
      automationRuleId: options.automationId,
      automationType: 'data',
      automationName: options.automationName,
      collectionId: options.collectionId,
      recordId: options.recordId,
      triggerEvent: options.triggerEvent,
      triggerTiming: options.triggerTiming,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: persistedStatus as any,
      skippedReason: options.skippedReason,
      errorMessage: options.errorMessage,
      errorStack: options.errorStack,
      inputData: options.inputData,
      outputData: enrichedOutput,
      actionsExecuted: options.actionsExecuted,
      triggeredBy: options.triggeredBy ?? undefined,
      executionDepth: options.executionDepth || 1,
      durationMs: options.durationMs,
    } as Partial<AutomationExecutionLog>);

    try {
      return await this.logRepo.save(entry);
    } catch (error) {
      this.logger.error(`Automation execution log save failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
