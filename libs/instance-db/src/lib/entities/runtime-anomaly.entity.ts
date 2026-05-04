import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

/**
 * RuntimeAnomaly captures structured records of runtime conditions that the
 * platform tolerated rather than failed on — partial bulk failures, swallowed
 * after-automation errors, terminal outbox drops, etc.
 *
 * The intent is to replace the "log warn and continue" pattern with a
 * queryable, alertable trail so operators can see when the runtime is being
 * collegial in ways the audit log cannot reflect. Anomalies are written in
 * addition to (not instead of) the existing logger output.
 */
@Entity('runtime_anomaly')
@Index(['kind', 'occurredAt'])
@Index(['serviceCode', 'occurredAt'])
export class RuntimeAnomaly {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Categorical identifier for the anomaly. Examples:
   *  - 'bulk_partial_failure'
   *  - 'after_automation_swallowed'
   *  - 'outbox_terminal_drop'
   *  - 'record_lookup_missing'
   */
  @Column({ type: 'varchar', length: 80 })
  kind!: string;

  /** Service that detected the anomaly, e.g. 'svc-data', 'svc-automation', 'svc-notify'. */
  @Column({ name: 'service_code', type: 'varchar', length: 80 })
  serviceCode!: string;

  @Column({ name: 'collection_code', type: 'varchar', length: 120, nullable: true })
  collectionCode?: string | null;

  @Column({ name: 'record_id', type: 'varchar', length: 120, nullable: true })
  recordId?: string | null;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, unknown> | null;

  /** Serialized Error: { name, message, stack }. Null when the anomaly is not error-bound. */
  @Column({ name: 'error_payload', type: 'jsonb', nullable: true })
  errorPayload?: Record<string, unknown> | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
