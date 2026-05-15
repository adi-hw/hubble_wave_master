import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';
import { User } from './user.entity';

export type DecisionTableStatus = 'draft' | 'published' | 'deprecated';
export type DecisionInputType =
  | 'string'
  | 'integer'
  | 'boolean'
  | 'choice'
  | 'reference'
  | 'date';

export type DecisionRowOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'greater_than_or_equals'
  | 'less_than'
  | 'less_than_or_equals'
  | 'is_null'
  | 'is_not_null';

export interface DecisionRowCondition {
  inputId: string;
  operator: DecisionRowOperator;
  value?: unknown;
}

/**
 * Plan §8.2 + ADR-14 four-entity model. The compressed
 * single-entity model breaks typed IO the moment an input is a
 * reference field or choice list — these four entities preserve
 * type safety end-to-end.
 *
 * DecisionTable: the spec (name, inputs[], answer collection)
 * DecisionInput: typed input columns
 * DecisionRow: a single row of conditions + answer reference
 * Answer rows live in the configurable answerCollection (any
 * Collection in the instance) — the table doesn't own them.
 */
@Entity({ name: 'decision_tables', schema: 'automation' })
@Index(['code'], { unique: true })
@Index(['collectionId'])
@Index(['applicationId'])
@Index(['status'])
export class DecisionTable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /**
   * The Collection this table is scoped to (the trigger context).
   * Decision evaluation reads input values from a record of this
   * collection when invoked from a Flow Action.
   */
  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  /**
   * Optional code of the Collection that holds answer rows. When
   * set, DecisionRow.answerRecordId references a record of that
   * Collection. When null, rows can only return literal values
   * (DecisionRow.answerLiteral).
   */
  @Column({ name: 'answer_collection_code', type: 'varchar', length: 120, nullable: true })
  answerCollectionCode?: string | null;

  /**
   * Defines whether to stop at first match or collect all matches.
   * `first_match` (default) returns the first matching row.
   * `all_matches` returns the array of all matching rows' answers.
   */
  @Column({ name: 'hit_policy', type: 'varchar', length: 20, default: 'first_match' })
  hitPolicy!: 'first_match' | 'all_matches';

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: DecisionTableStatus;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'current_revision_id', type: 'uuid', nullable: true })
  currentRevisionId?: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /** ADR-7 provenance. See CollectionDefinition.source. */
  @Column({ name: 'source', type: 'varchar', length: 120, default: 'custom' })
  source!: string;

  @OneToMany(() => DecisionInput, (input) => input.table, { cascade: true })
  inputs?: DecisionInput[];

  @OneToMany(() => DecisionRow, (row) => row.table, { cascade: true })
  rows?: DecisionRow[];
}

export type DecisionTableRevisionStatus = 'draft' | 'published';

/**
 * Append-only edit history for DecisionTable. Mirrors the ADR-5
 * pattern used by CollectionDefinitionRevision so authoring
 * lifecycle is uniform across metadata entities.
 */
@Entity({ name: 'decision_table_revisions', schema: 'automation' })
@Index(['tableId'])
@Index(['status'])
@Index(['tableId', 'revision'], { unique: true })
export class DecisionTableRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId!: string;

  @ManyToOne(() => DecisionTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table?: DecisionTable;

  @Column({ type: 'integer' })
  revision!: number;

  @Column({ type: 'varchar', length: 20 })
  status!: DecisionTableRevisionStatus;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by' })
  publishedByUser?: User | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'decision_inputs', schema: 'automation' })
@Index(['tableId', 'position'], { unique: true })
export class DecisionInput {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId!: string;

  @ManyToOne(() => DecisionTable, (table) => table.inputs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table?: DecisionTable;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'input_type', type: 'varchar', length: 20 })
  inputType!: DecisionInputType;

  /**
   * For `choice` type — list of permitted string values. For
   * `reference` type — target collection code. For other types,
   * left null.
   */
  @Column({ type: 'jsonb', nullable: true })
  config?: Record<string, unknown> | null;

  @Column({ name: 'default_value', type: 'jsonb', nullable: true })
  defaultValue?: unknown;

  @Column({ type: 'integer' })
  position!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'decision_rows', schema: 'automation' })
@Index(['tableId', 'position'])
export class DecisionRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId!: string;

  @ManyToOne(() => DecisionTable, (table) => table.rows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table?: DecisionTable;

  @Column({ type: 'integer' })
  position!: number;

  /**
   * Condition list — all conditions AND'ed together. A row matches
   * when every condition's operator returns true against the
   * supplied input values.
   */
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  conditions!: DecisionRowCondition[];

  /** Reference to a record in the table's answerCollection. */
  @Column({ name: 'answer_record_id', type: 'uuid', nullable: true })
  answerRecordId?: string | null;

  /** Inline literal answer when the table has no answerCollection. */
  @Column({ name: 'answer_literal', type: 'jsonb', nullable: true })
  answerLiteral?: unknown;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
