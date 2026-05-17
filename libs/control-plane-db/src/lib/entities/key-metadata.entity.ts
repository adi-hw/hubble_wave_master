import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type KeyProvider = 'aws-kms' | 'local-es256';
export type KeyAlgorithm = 'ES256';
export type KeyState =
  | 'pending'
  | 'active'
  | 'retiring'
  | 'retired'
  | 'compromised';

/**
 * `key_metadata` — Control-plane JWT signing key registry per canon §29.2.
 *
 * Mirrors the instance-plane entity (`libs/instance-db/src/lib/entities/
 * key-metadata.entity.ts`) but lives in the control-plane database (`public`
 * schema). The control-plane runs single-tenant (canon §18); `instanceId`
 * is always NULL on this side and exists only for schema parity with the
 * instance plane.
 *
 * The `state` column drives the key lifecycle:
 *   pending → active → retiring → retired   (normal flow)
 *                            ↘ compromised  (emergency, terminal)
 *
 * The JWKS endpoint (`/.well-known/jwks.json`) publishes only `active` and
 * `retiring` keys (§29.2). A partial unique index in the matching migration
 * enforces "exactly one active key" platform-wide.
 */
@Entity('key_metadata')
@Index('idx_key_metadata_state', ['state'])
export class KeyMetadata {
  @PrimaryColumn({ type: 'text' })
  kid!: string;

  @Column({ type: 'text' })
  provider!: KeyProvider;

  @Column({ name: 'kms_alias', type: 'text', nullable: true })
  kmsAlias?: string | null;

  @Column({ name: 'kms_arn', type: 'text', nullable: true })
  kmsArn?: string | null;

  @Column({ type: 'text', default: 'ES256' })
  algorithm!: KeyAlgorithm;

  @Column({ type: 'text' })
  state!: KeyState;

  @Column({ name: 'public_key_pem', type: 'text' })
  publicKeyPem!: string;

  @Column({ name: 'instance_id', type: 'uuid', nullable: true })
  instanceId?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt?: Date | null;

  @Column({ name: 'retiring_at', type: 'timestamptz', nullable: true })
  retiringAt?: Date | null;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt?: Date | null;

  @Column({ name: 'compromised_at', type: 'timestamptz', nullable: true })
  compromisedAt?: Date | null;
}
