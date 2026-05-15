import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export type ConnectorKind = 'http' | 'smtp' | 'ldap';
export type ConnectorStatus = 'active' | 'disabled';

/**
 * Plan §8.1.10 starter framework. A Connector is a registered,
 * credentialed integration endpoint flow actions and automations
 * call through (HTTPRequest → connector + path; SendNotification
 * via SMTP connector). Credentials live in the platform vault
 * referenced by `credentialRef`; the connector row never persists
 * raw secrets.
 */
@Entity({ name: 'connectors', schema: 'automation' })
@Index(['code'], { unique: true })
@Index(['kind', 'status'])
export class Connector {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 20 })
  kind!: ConnectorKind;

  /**
   * Connector-kind-specific configuration. For HTTP: { baseUrl,
   * defaultHeaders, timeoutMs }. For SMTP: { host, port, secure,
   * fromEmail }. For LDAP: { url, baseDn, userFilter, ... }. Schema
   * enforced per-kind by the consuming service, not by this column.
   */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  config!: Record<string, unknown>;

  /**
   * Vault reference key (NOT the raw secret). The credential
   * lookup service resolves this against the platform vault; secrets
   * never enter the metadata DB.
   */
  @Column({ name: 'credential_ref', type: 'varchar', length: 255, nullable: true })
  credentialRef?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: ConnectorStatus;

  /** ADR-7 provenance. See CollectionDefinition.source. */
  @Column({ name: 'source', type: 'varchar', length: 120, default: 'custom' })
  source!: string;

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
}
