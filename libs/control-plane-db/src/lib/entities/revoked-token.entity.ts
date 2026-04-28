import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * RevokedToken entity - server-side access-token revocation list for the
 * Control Plane.
 *
 * The Control Plane issues short-lived JWT access tokens only (no refresh
 * flow). When an operator clicks "Sign out", the token's `jti` claim is
 * inserted here and consulted by `JwtStrategy.validate()` on every
 * subsequent request, so a leaked token cannot be replayed until natural
 * expiry. Rows are pruned by a periodic job once `expiresAt` has passed.
 */
@Entity('revoked_tokens')
@Index(['jti'], { unique: true })
@Index(['expiresAt'])
export class RevokedToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** JWT `jti` claim of the revoked token */
  @Column({ type: 'varchar', length: 64 })
  jti!: string;

  /** User who owned the revoked token (for audit + targeted invalidation) */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** Original token expiry; rows past this time may be safely purged */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** When the revocation was recorded */
  @CreateDateColumn({ name: 'revoked_at', type: 'timestamptz' })
  revokedAt!: Date;

  /** IP address that issued the logout */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  /** User agent that issued the logout */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;
}
