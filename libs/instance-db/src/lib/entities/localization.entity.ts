import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type LocaleDirection = 'ltr' | 'rtl';
export type TranslationStatus = 'draft' | 'approved' | 'published';
export type TranslationRequestStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'failed';

@Entity('locales')
@Index(['code'], { unique: true })
export class Locale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 20 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'direction', type: 'varchar', length: 5, default: 'ltr' })
  direction!: LocaleDirection;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('translation_keys')
@Index(['namespace', 'key'], { unique: true })
export class TranslationKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'namespace', type: 'varchar', length: 120 })
  namespace!: string;

  @Column({ name: 'key', type: 'varchar', length: 200 })
  key!: string;

  @Column({ name: 'default_text', type: 'text' })
  defaultText!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('translation_values')
@Index(['translationKeyId', 'localeId'], { unique: true })
@Index(['translationKeyId'])
@Index(['localeId'])
export class TranslationValue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'translation_key_id', type: 'uuid' })
  translationKeyId!: string;

  @ManyToOne(() => TranslationKey, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'translation_key_id' })
  translationKey?: TranslationKey;

  @Column({ name: 'locale_id', type: 'uuid' })
  localeId!: string;

  @ManyToOne(() => Locale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locale_id' })
  locale?: Locale;

  @Column({ name: 'text', type: 'text' })
  text!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'draft' })
  status!: TranslationStatus;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('localization_bundles')
@Index(['localeCode'], { unique: true })
@Index(['localeId'])
export class LocalizationBundle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'locale_id', type: 'uuid' })
  localeId!: string;

  @ManyToOne(() => Locale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locale_id' })
  locale?: Locale;

  @Column({ name: 'locale_code', type: 'varchar', length: 20 })
  localeCode!: string;

  @Column({ name: 'entries', type: 'jsonb', default: () => `'{}'` })
  entries!: Record<string, Record<string, string>>;

  @Column({ name: 'checksum', type: 'varchar', length: 64 })
  checksum!: string;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by' })
  publishedByUser?: User | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('translation_requests')
@Index(['status'])
@Index(['localeId'])
@Index(['translationKeyId'])
export class TranslationRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'locale_id', type: 'uuid' })
  localeId!: string;

  @ManyToOne(() => Locale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locale_id' })
  locale?: Locale;

  @Column({ name: 'translation_key_id', type: 'uuid' })
  translationKeyId!: string;

  @ManyToOne(() => TranslationKey, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'translation_key_id' })
  translationKey?: TranslationKey;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status!: TranslationRequestStatus;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requested_by' })
  requestedByUser?: User | null;

  @Column({ name: 'reviewer_ids', type: 'jsonb', default: () => `'[]'` })
  reviewerIds!: string[];

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt?: Date | null;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
