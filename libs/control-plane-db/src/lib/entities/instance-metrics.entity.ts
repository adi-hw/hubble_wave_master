import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Instance } from './instance.entity';

/**
 * InstanceMetrics entity - time-series metrics for customer instances
 * Stored in Control Plane database (eam_control)
 * 
 * This table should be partitioned by time for efficient querying
 * and automatic data retention.
 */
@Entity('instance_metrics')
@Index(['instanceId', 'recordedAt'])
@Index(['recordedAt'])
export class InstanceMetrics {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Instance this metric belongs to */
  @Column({ name: 'instance_id', type: 'uuid' })
  instanceId!: string;

  @ManyToOne(() => Instance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instance_id' })
  instance?: Instance;

  /** When this metric was recorded */
  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' })
  recordedAt!: Date;

  // ─────────────────────────────────────────────────────────────────
  // Usage Metrics
  // ─────────────────────────────────────────────────────────────────

  /** Active users in the last hour */
  @Column({ name: 'active_users', type: 'integer', nullable: true })
  activeUsers?: number | null;

  /** Total registered users */
  @Column({ name: 'total_users', type: 'integer', nullable: true })
  totalUsers?: number | null;

  /** Total assets in the system */
  @Column({ name: 'total_assets', type: 'integer', nullable: true })
  totalAssets?: number | null;

  /** API requests in the last hour */
  @Column({ name: 'api_requests_1h', type: 'integer', nullable: true })
  apiRequests1h?: number | null;

  /** Current database connections */
  @Column({ name: 'db_connections', type: 'integer', nullable: true })
  dbConnections?: number | null;

  /** Total storage used in bytes */
  @Column({ name: 'storage_bytes', type: 'bigint', nullable: true })
  storageBytes?: string | null; // bigint comes as string in TypeORM

  // ─────────────────────────────────────────────────────────────────
  // Performance Metrics
  // ─────────────────────────────────────────────────────────────────

  /** Average response time in milliseconds */
  @Column({ name: 'avg_response_time_ms', type: 'decimal', precision: 10, scale: 2, nullable: true })
  avgResponseTimeMs?: number | null;

  /** P95 response time in milliseconds */
  @Column({ name: 'p95_response_time_ms', type: 'decimal', precision: 10, scale: 2, nullable: true })
  p95ResponseTimeMs?: number | null;

  /** P99 response time in milliseconds */
  @Column({ name: 'p99_response_time_ms', type: 'decimal', precision: 10, scale: 2, nullable: true })
  p99ResponseTimeMs?: number | null;

  /** Error rate (0.0 to 1.0) */
  @Column({ name: 'error_rate', type: 'decimal', precision: 5, scale: 4, nullable: true })
  errorRate?: number | null;

  // ─────────────────────────────────────────────────────────────────
  // Resource Metrics
  // ─────────────────────────────────────────────────────────────────

  /** CPU usage percentage */
  @Column({ name: 'cpu_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  cpuPercent?: number | null;

  /** Memory usage percentage */
  @Column({ name: 'memory_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  memoryPercent?: number | null;

  /** Disk usage percentage */
  @Column({ name: 'disk_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  diskPercent?: number | null;

  /** Network I/O in bytes/second */
  @Column({ name: 'network_io_bytes', type: 'bigint', nullable: true })
  networkIoBytes?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Database Metrics
  // ─────────────────────────────────────────────────────────────────

  /** Database size in bytes */
  @Column({ name: 'db_size_bytes', type: 'bigint', nullable: true })
  dbSizeBytes?: string | null;

  /** Database query count in last hour */
  @Column({ name: 'db_queries_1h', type: 'integer', nullable: true })
  dbQueries1h?: number | null;

  /** Slow query count in last hour */
  @Column({ name: 'slow_queries_1h', type: 'integer', nullable: true })
  slowQueries1h?: number | null;
}
