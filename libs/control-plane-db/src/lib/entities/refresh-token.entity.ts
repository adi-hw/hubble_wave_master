import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * RefreshToken entity — Control Plane refresh-token rotation registry.
 *
 * Login mints a refresh token alongside the short-lived access token. The
 * web-control-plane silently calls `POST /auth/refresh` when an access
 * token expires (401) to obtain a new pair without dropping the user back
 * to the login screen mid-action.
 *
 * Each refresh row carries a `family` id shared by every token in the
 * same logical session. On rotation, the parent row's `revokedAt` is
 * stamped and a child row is issued with the same family. Reuse of an
 * already-revoked token in a family triggers a wholesale family
 * revocation — that is the canonical token-theft signal.
 *
 * `tokenHash` stores SHA-256 of the raw refresh token; the raw value is
 * never persisted server-side.
 */
@Entity({ name: 'refresh_tokens', schema: 'identity' })
@Index(['tokenHash'], { unique: true })
@Index(['family'])
@Index(['userId'])
@Index(['expiresAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** SHA-256 of the raw refresh token; raw value never persisted. */
  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash!: string;

  /** Logical session id; rotates inherit, theft triggers family-wide revoke. */
  @Column({ type: 'uuid' })
  family!: string;

  /** Owner of the refresh token. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** When the refresh token was issued. */
  @CreateDateColumn({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;

  /** Hard expiry — refresh after this time is rejected even if not revoked. */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** When the token was revoked (rotation, logout, or family-wide reuse). */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  /** Why the token was revoked. */
  @Column({ name: 'revoke_reason', type: 'varchar', length: 64, nullable: true })
  revokeReason?: string | null;

  /** Successor token id, set on rotation for chain tracking. */
  @Column({ name: 'replaced_by', type: 'uuid', nullable: true })
  replacedBy?: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;
}
