import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ConditionExpression } from './shared-types';

export type ProtectionType = 'read_only' | 'hidden' | 'masked' | 'encrypted' | 'immutable_after_create';
export type ProtectionScope = 'all' | 'role' | 'group' | 'condition';
export type ProtectionSource = 'platform' | 'module' | 'tenant';

/**
 * Defines field-level protection rules that control field visibility and editability.
 * Works in conjunction with ACLs to provide fine-grained field security.
 */
@Entity('field_protection_rule')
@Index(['tenantId', 'code'], { unique: true })
@Index(['targetTable', 'targetField', 'isActive'])
@Index(['protectionType'])
export class FieldProtectionRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string; // NULL for platform rules

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'target_table', type: 'varchar', length: 100 })
  targetTable!: string;

  @Column({ name: 'target_field', type: 'varchar', length: 100 })
  targetField!: string;

  @Column({ name: 'protection_type', type: 'varchar', length: 30 })
  protectionType!: ProtectionType;

  @Column({ name: 'protection_scope', type: 'varchar', length: 30, default: 'all' })
  protectionScope!: ProtectionScope;

  /**
   * Role codes this rule applies to (for 'role' scope).
   */
  @Column({ name: 'applies_to_roles', type: 'jsonb', nullable: true })
  appliesToRoles?: string[];

  /**
   * Role codes this rule excludes (these roles bypass the protection).
   */
  @Column({ name: 'except_roles', type: 'jsonb', nullable: true })
  exceptRoles?: string[];

  /**
   * Group codes this rule applies to (for 'group' scope).
   */
  @Column({ name: 'applies_to_groups', type: 'jsonb', nullable: true })
  appliesToGroups?: string[];

  /**
   * Condition that must be met for protection to apply (for 'condition' scope).
   * Uses the same JSON Query format as business rules.
   */
  @Column({ name: 'condition_expression', type: 'jsonb', nullable: true })
  conditionExpression?: ConditionExpression;

  /**
   * Script to evaluate protection dynamically.
   */
  @Column({ name: 'condition_script', type: 'text', nullable: true })
  conditionScript?: string;

  // Masking configuration (for 'masked' protection type)
  @Column({ name: 'mask_pattern', type: 'varchar', length: 100, nullable: true })
  maskPattern?: string; // e.g., '****', 'XXX-XX-{last4}'

  @Column({ name: 'mask_character', type: 'char', nullable: true })
  maskCharacter?: string; // Default: '*'

  @Column({ name: 'visible_chars_start', type: 'int', nullable: true })
  visibleCharsStart?: number; // Number of chars visible at start

  @Column({ name: 'visible_chars_end', type: 'int', nullable: true })
  visibleCharsEnd?: number; // Number of chars visible at end

  // Encryption configuration (for 'encrypted' protection type)
  @Column({ name: 'encryption_key_id', type: 'varchar', length: 100, nullable: true })
  encryptionKeyId?: string; // Reference to encryption key

  /**
   * Roles that can view the decrypted value.
   */
  @Column({ name: 'decrypt_roles', type: 'jsonb', nullable: true })
  decryptRoles?: string[];

  // Read-only configuration
  /**
   * Conditions under which the field becomes editable even if normally read-only.
   */
  @Column({ name: 'editable_conditions', type: 'jsonb', nullable: true })
  editableConditions?: ConditionExpression;

  // Audit configuration
  @Column({ name: 'audit_access', type: 'boolean', default: false })
  auditAccess!: boolean; // Log when this field is accessed

  @Column({ name: 'audit_changes', type: 'boolean', default: true })
  auditChanges!: boolean; // Log when this field is modified

  // UI hints
  @Column({ name: 'ui_message', type: 'text', nullable: true })
  uiMessage?: string; // Message to show user (e.g., "This field is protected")

  @Column({ name: 'ui_icon', type: 'varchar', length: 50, nullable: true })
  uiIcon?: string; // Icon to show (e.g., 'lock', 'eye-off')

  // Execution order for multiple rules on same field
  @Column({ name: 'execution_order', type: 'int', default: 100 })
  executionOrder!: number;

  // Metadata
  @Column({ type: 'varchar', length: 20, default: 'tenant' })
  source!: ProtectionSource;

  @Column({ name: 'platform_version', type: 'varchar', length: 20, nullable: true })
  platformVersion?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
