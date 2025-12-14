import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

// ============ Business Schedule & Holidays ============

@Entity('business_schedule')
export class BusinessSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  @Index()
  name!: string;

  @Column({ length: 50, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 50, default: 'UTC' })
  timezone!: string;

  @Column({ type: 'jsonb', default: '{}' })
  workingHours!: {
    monday?: { start: string; end: string; enabled: boolean };
    tuesday?: { start: string; end: string; enabled: boolean };
    wednesday?: { start: string; end: string; enabled: boolean };
    thursday?: { start: string; end: string; enabled: boolean };
    friday?: { start: string; end: string; enabled: boolean };
    saturday?: { start: string; end: string; enabled: boolean };
    sunday?: { start: string; end: string; enabled: boolean };
  };

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isDefault!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('holiday_calendar')
export class HolidayCalendar {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 50, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 50, nullable: true })
  region?: string;

  @Column({ length: 10, nullable: true })
  countryCode?: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('holiday')
export class Holiday {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  calendarId!: string;

  @ManyToOne(() => HolidayCalendar, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calendar_id' })
  calendar!: HolidayCalendar;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'date' })
  @Index()
  date!: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ default: false })
  isRecurring!: boolean;

  @Column({ length: 20, nullable: true })
  recurrencePattern?: string; // 'yearly', 'relative' (e.g., "4th Thursday of November")

  @Column({ type: 'jsonb', nullable: true })
  recurrenceConfig?: {
    month?: number;
    day?: number;
    weekOfMonth?: number;
    dayOfWeek?: number;
  };

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}

// ============ Commitment Definition ============

export type CommitmentType = 'sla' | 'ola' | 'uc';
export type CommitmentTrigger = 'on_create' | 'on_status_change' | 'on_assignment' | 'on_field_change' | 'manual';
export type CommitmentStopCondition = 'on_status_change' | 'on_resolution' | 'on_closure' | 'on_field_change' | 'manual';
export type CommitmentAction = 'notify' | 'escalate' | 'reassign' | 'update_field' | 'webhook';

@Entity('commitment_definition')
export class CommitmentDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  @Index()
  name!: string;

  @Column({ length: 50, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, default: 'sla' })
  type!: CommitmentType;

  @Column({ length: 100, nullable: true })
  @Index()
  collectionCode?: string;

  @Column({ type: 'jsonb', nullable: true })
  applicableConditions?: {
    field: string;
    operator: string;
    value: unknown;
  }[];

  @Column({ type: 'varchar', length: 50, default: 'on_create' })
  triggerType!: CommitmentTrigger;

  @Column({ type: 'jsonb', nullable: true })
  triggerConfig?: {
    field?: string;
    fromValues?: string[];
    toValues?: string[];
  };

  @Column({ type: 'varchar', length: 50, default: 'on_resolution' })
  stopCondition!: CommitmentStopCondition;

  @Column({ type: 'jsonb', nullable: true })
  stopConfig?: {
    field?: string;
    values?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  pauseConditions?: {
    field: string;
    values: string[];
  }[];

  // Target time configuration
  @Column({ type: 'int', default: 0 })
  targetMinutes!: number;

  @Column({ default: true })
  useBusinessHours!: boolean;

  @Column({ type: 'uuid', nullable: true })
  businessScheduleId?: string;

  @ManyToOne(() => BusinessSchedule, { nullable: true })
  @JoinColumn({ name: 'business_schedule_id' })
  businessSchedule?: BusinessSchedule;

  @Column({ type: 'uuid', nullable: true })
  holidayCalendarId?: string;

  @ManyToOne(() => HolidayCalendar, { nullable: true })
  @JoinColumn({ name: 'holiday_calendar_id' })
  holidayCalendar?: HolidayCalendar;

  // Warning threshold (percentage of target)
  @Column({ type: 'int', default: 75 })
  warningThresholdPercent!: number;

  @Column({ type: 'jsonb', default: '[]' })
  warningActions!: {
    action: CommitmentAction;
    config: Record<string, unknown>;
  }[];

  @Column({ type: 'jsonb', default: '[]' })
  breachActions!: {
    action: CommitmentAction;
    config: Record<string, unknown>;
  }[];

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// ============ Commitment Tracker ============

export type CommitmentStatus = 'active' | 'paused' | 'warning' | 'breached' | 'met' | 'cancelled';

@Entity('commitment_tracker')
export class CommitmentTracker {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  commitmentDefinitionId!: string;

  @ManyToOne(() => CommitmentDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commitment_definition_id' })
  commitmentDefinition!: CommitmentDefinition;

  @Column({ length: 100 })
  @Index()
  collectionCode!: string;

  @Column({ type: 'uuid' })
  @Index()
  recordId!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  @Index()
  status!: CommitmentStatus;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz' })
  targetAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  warningAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  pausedAt?: Date;

  @Column({ type: 'int', default: 0 })
  totalPausedMinutes!: number;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', nullable: true })
  actualMinutes?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentageUsed?: number;

  @Column({ default: false })
  warningSent!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  warningSentAt?: Date;

  @Column({ default: false })
  breached!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  breachedAt?: Date;

  @Column({ type: 'jsonb', default: '[]' })
  history!: {
    timestamp: string;
    action: string;
    fromStatus?: string;
    toStatus?: string;
    details?: Record<string, unknown>;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// ============ Commitment Metrics ============

@Entity('commitment_metrics')
export class CommitmentMetrics {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  commitmentDefinitionId!: string;

  @ManyToOne(() => CommitmentDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commitment_definition_id' })
  commitmentDefinition!: CommitmentDefinition;

  @Column({ type: 'date' })
  @Index()
  periodDate!: Date;

  @Column({ length: 20, default: 'daily' })
  periodType!: string; // 'daily', 'weekly', 'monthly'

  @Column({ type: 'int', default: 0 })
  totalTracked!: number;

  @Column({ type: 'int', default: 0 })
  metCount!: number;

  @Column({ type: 'int', default: 0 })
  breachedCount!: number;

  @Column({ type: 'int', default: 0 })
  warningCount!: number;

  @Column({ type: 'int', default: 0 })
  cancelledCount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  complianceRate?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  avgResolutionMinutes?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  avgPercentageUsed?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
