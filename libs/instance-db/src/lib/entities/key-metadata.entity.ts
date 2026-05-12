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
 * `key_metadata` — JWT signing key registry per canon §29.2.
 *
 * One row per ES256 signing key the platform has ever minted. `kid` is the
 * stable public identifier — embedded in every JWT header and exposed via
 * `/.well-known/jwks.json`. KMS-specific identifiers (`kmsAlias`, `kmsArn`)
 * are stored alongside for ops/admin use but are never carried in tokens.
 *
 * The `state` column drives the key lifecycle:
 *   pending → active → retiring → retired   (normal flow)
 *                            ↘ compromised  (emergency, terminal)
 *
 * The JWKS endpoint publishes only `active` and `retiring` keys (§29.2).
 * `pending` keys are mid-rotation and not yet trusted; `retired` and
 * `compromised` keys are off-limits forever.
 *
 * A partial unique index enforces "exactly one active key per instance
 * scope" — see the migration. Per canon §5 SOFTEN, `instanceId` is NULL
 * in single-tenant deployments; the COALESCE in the constraint still
 * gives the same one-active-key guarantee.
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
