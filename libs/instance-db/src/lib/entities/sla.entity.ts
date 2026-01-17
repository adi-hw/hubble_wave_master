/**
 * SLA Entities
 * HubbleWave Platform - Phase 4
 *
 * Entities for SLA definitions, instances, and breach tracking.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';

// ═══════════════════════════════════════════════════════════════════
// BUSINESS HOURS
// ═══════════════════════════════════════════════════════════════════

export interface DaySchedule {
  start: string;
  end: string;
}

export interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface Holiday {
  date: string;
  name: string;
}

@Entity('business_hours')
export class BusinessHours {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone!: string;

  @Column({ type: 'jsonb' })
  schedule!: WeeklySchedule;

  @Column({ type: 'jsonb', default: [] })
  holidays!: Holiday[];

  @Column({ type: 'boolean', name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

// ═══════════════════════════════════════════════════════════════════
// SLA DEFINITION
// ═══════════════════════════════════════════════════════════════════

export type SLAType = 'response' | 'resolution' | 'custom';

export interface SLAEscalation {
  thresholdPercent: number;
  actions: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
}

@Entity('sla_definitions')
@Index(['collectionId'], { where: '"is_active" = true' })
export class SLADefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', name: 'collection_id', nullable: true })
  collectionId?: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ type: 'varchar', length: 50, name: 'sla_type', default: 'resolution' })
  slaType!: SLAType;

  @Column({ type: 'integer', name: 'target_minutes' })
  targetMinutes!: number;

  @Column({ type: 'integer', name: 'warning_threshold_1', default: 75 })
  warningThreshold1!: number;

  @Column({ type: 'integer', name: 'warning_threshold_2', default: 90 })
  warningThreshold2!: number;

  @Column({ type: 'uuid', name: 'business_hours_id', nullable: true })
  businessHoursId?: string;

  @ManyToOne(() => BusinessHours, { nullable: true })
  @JoinColumn({ name: 'business_hours_id' })
  businessHours?: BusinessHours;

  @Column({ type: 'jsonb', nullable: true })
  conditions?: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'pause_conditions', nullable: true })
  pauseConditions?: Record<string, unknown>;

  @Column({ type: 'jsonb', default: [] })
  escalations!: SLAEscalation[];

  @Column({ type: 'integer', default: 100 })
  priority!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => SLAInstance, (instance) => instance.slaDefinition)
  instances?: SLAInstance[];
}

// ═══════════════════════════════════════════════════════════════════
// SLA INSTANCE
// ═══════════════════════════════════════════════════════════════════

export type SLAInstanceState = 'active' | 'paused' | 'completed' | 'breached' | 'cancelled';

@Entity('sla_instances')
@Index(['collectionId', 'recordId'])
@Index(['state'])
@Index(['targetTime'], { where: '"state" = \'active\'' })
export class SLAInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'sla_definition_id' })
  slaDefinitionId!: string;

  @ManyToOne(() => SLADefinition, (definition) => definition.instances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sla_definition_id' })
  slaDefinition?: SLADefinition;

  @Column({ type: 'uuid', name: 'record_id' })
  recordId!: string;

  @Column({ type: 'uuid', name: 'collection_id', nullable: true })
  collectionId?: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  state!: SLAInstanceState;

  @Column({ type: 'integer', name: 'elapsed_seconds', default: 0 })
  elapsedSeconds!: number;

  @Column({ type: 'integer', name: 'remaining_seconds' })
  remainingSeconds!: number;

  @Column({ type: 'integer', name: 'target_seconds' })
  targetSeconds!: number;

  @Column({ type: 'timestamptz', name: 'start_time' })
  startTime!: Date;

  @Column({ type: 'timestamptz', name: 'pause_time', nullable: true })
  pauseTime?: Date;

  @Column({ type: 'timestamptz', name: 'complete_time', nullable: true })
  completeTime?: Date;

  @Column({ type: 'timestamptz', name: 'breach_time', nullable: true })
  breachTime?: Date;

  @Column({ type: 'timestamptz', name: 'target_time' })
  targetTime!: Date;

  @Column({ type: 'integer', name: 'total_pause_seconds', default: 0 })
  totalPauseSeconds!: number;

  @Column({ type: 'integer', name: 'pause_count', default: 0 })
  pauseCount!: number;

  @Column({ type: 'boolean', name: 'warning_1_sent', default: false })
  warning1Sent!: boolean;

  @Column({ type: 'timestamptz', name: 'warning_1_sent_at', nullable: true })
  warning1SentAt?: Date;

  @Column({ type: 'boolean', name: 'warning_2_sent', default: false })
  warning2Sent!: boolean;

  @Column({ type: 'timestamptz', name: 'warning_2_sent_at', nullable: true })
  warning2SentAt?: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

// ═══════════════════════════════════════════════════════════════════
// SLA BREACH
// ═══════════════════════════════════════════════════════════════════

@Entity('sla_breaches')
@Index(['collectionId', 'recordId'])
@Index(['createdAt'])
export class SLABreach {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'sla_instance_id', nullable: true })
  slaInstanceId?: string;

  @ManyToOne(() => SLAInstance, { nullable: true })
  @JoinColumn({ name: 'sla_instance_id' })
  slaInstance?: SLAInstance;

  @Column({ type: 'uuid', name: 'sla_definition_id', nullable: true })
  slaDefinitionId?: string;

  @ManyToOne(() => SLADefinition, { nullable: true })
  @JoinColumn({ name: 'sla_definition_id' })
  slaDefinition?: SLADefinition;

  @Column({ type: 'uuid', name: 'record_id' })
  recordId!: string;

  @Column({ type: 'uuid', name: 'collection_id', nullable: true })
  collectionId?: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ type: 'integer', name: 'target_seconds' })
  targetSeconds!: number;

  @Column({ type: 'integer', name: 'elapsed_seconds' })
  elapsedSeconds!: number;

  @Column({ type: 'integer', name: 'breach_amount_seconds' })
  breachAmountSeconds!: number;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'text', name: 'resolution_notes', nullable: true })
  resolutionNotes?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

// ═══════════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════════

export interface StateMachineState {
  id: string;
  name: string;
  displayName: string;
  isInitial?: boolean;
  isFinal?: boolean;
  color?: string;
  order?: number;
  onEntry?: Array<{ type: string; config: Record<string, unknown> }>;
  onExit?: Array<{ type: string; config: Record<string, unknown> }>;
}

export interface StateMachineTransition {
  id: string;
  fromState: string;
  toState: string;
  name: string;
  conditions?: Record<string, unknown>;
  requiredRole?: string;
  actions?: Array<{ type: string; config: Record<string, unknown> }>;
}

@Entity('state_machine_definitions')
@Index(['collectionId'], { where: '"is_active" = true' })
export class StateMachineDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', name: 'collection_id', nullable: true })
  collectionId?: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ type: 'varchar', length: 100, name: 'state_property' })
  stateProperty!: string;

  @Column({ type: 'jsonb', default: [] })
  states!: StateMachineState[];

  @Column({ type: 'jsonb', default: [] })
  transitions!: StateMachineTransition[];

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

// ═══════════════════════════════════════════════════════════════════
// STATE CHANGE HISTORY
// ═══════════════════════════════════════════════════════════════════

@Entity('state_change_history')
@Index(['collectionId', 'recordId', 'createdAt'])
export class StateChangeHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'record_id' })
  recordId!: string;

  @Column({ type: 'uuid', name: 'collection_id', nullable: true })
  collectionId?: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ type: 'uuid', name: 'state_machine_id', nullable: true })
  stateMachineId?: string;

  @ManyToOne(() => StateMachineDefinition, { nullable: true })
  @JoinColumn({ name: 'state_machine_id' })
  stateMachine?: StateMachineDefinition;

  @Column({ type: 'varchar', length: 100, name: 'from_state', nullable: true })
  fromState?: string;

  @Column({ type: 'varchar', length: 100, name: 'to_state' })
  toState!: string;

  @Column({ type: 'varchar', length: 100, name: 'transition_name', nullable: true })
  transitionName?: string;

  @Column({ type: 'uuid', name: 'changed_by', nullable: true })
  changedBy?: string;

  @Column({ type: 'text', name: 'change_reason', nullable: true })
  changeReason?: string;

  @Column({ type: 'integer', name: 'duration_in_state', nullable: true })
  durationInState?: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
