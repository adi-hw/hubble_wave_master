import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuntimeAnomaly } from '../entities/runtime-anomaly.entity';

export interface RuntimeAnomalyEvent {
  /** Categorical identifier for the anomaly (see RuntimeAnomaly.kind). */
  kind: string;
  /** Service detecting the anomaly. */
  serviceCode: string;
  /** Human-readable summary describing what was tolerated. */
  message: string;
  collectionCode?: string;
  recordId?: string;
  context?: Record<string, unknown>;
  /** Original error if the anomaly was triggered by a thrown exception. */
  error?: Error;
}

/**
 * RuntimeAnomalyService persists structured anomaly events.
 *
 * Anomalies represent runtime conditions where the platform deliberately
 * continued past a failure (bulk partial skip, after-automation swallow,
 * outbox terminal drop, etc.). Recording is best-effort: if the underlying
 * write fails, we log to the platform logger but never re-throw — losing the
 * anomaly write must not propagate as a new exception that masks the original
 * runtime decision.
 *
 * Anomaly writes are intentionally outside the surrounding business
 * transaction so they survive a rollback.
 */
@Injectable()
export class RuntimeAnomalyService {
  private readonly logger = new Logger(RuntimeAnomalyService.name);

  constructor(
    @InjectRepository(RuntimeAnomaly)
    private readonly repo: Repository<RuntimeAnomaly>,
  ) {}

  async record(event: RuntimeAnomalyEvent): Promise<void> {
    try {
      const entity = this.repo.create({
        kind: event.kind,
        serviceCode: event.serviceCode,
        collectionCode: event.collectionCode ?? null,
        recordId: event.recordId ?? null,
        message: event.message,
        context: event.context ?? null,
        errorPayload: event.error
          ? {
              name: event.error.name,
              message: event.error.message,
              stack: event.error.stack ?? null,
            }
          : null,
        occurredAt: new Date(),
      });
      await this.repo.save(entity);
    } catch (writeErr) {
      // Best-effort. The platform must continue even if the anomaly table
      // is unreachable (e.g. boot before migrations have run). Re-throwing
      // here would mask the original runtime decision we were trying to
      // record.
      this.logger.error(
        `Failed to persist runtime anomaly (kind=${event.kind}, service=${event.serviceCode}): ${(writeErr as Error).message}`,
      );
    }
  }
}
